// Socket.IO load test spawning concurrent candidate clients.
// Simulates concurrent candidates connecting, emitting session:join and signals:batch,
// measuring round-trip ack latency, throughput, and error rates.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');

const User = require('../src/models/User');
const Exam = require('../src/models/Exam');
const Session = require('../src/models/Session');

// CLI arguments or environment variables
const TARGET_CLIENTS = Number(process.argv[2]) || Number(process.env.CLIENTS) || 500;
const DURATION_SEC = Number(process.argv[3]) || Number(process.env.DURATION) || 60;
const RAMP_RATE_PER_SEC = 50;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'development_jwt_secret_sohil_scoring_test_key_12345';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/overlayproctor';

const SIGNAL_CODES_HIGH = ['KNOWN_FINGERPRINT', 'EXTENSION_IFRAME'];
const SIGNAL_CODES_OTHER = [
  'FIXED_HIGH_Z_NODE',
  'FOREIGN_SHADOW_ROOT',
  'DOM_NODE_DELTA',
  'WINDOW_BLUR',
  'TAB_HIDDEN',
  'LARGE_PASTE',
  'DEVTOOLS_OPEN',
];

function getRandomSignals() {
  const count = Math.floor(Math.random() * 3) + 1; // 1 to 3 signals
  const includeHigh = Math.random() < 0.1; // 10% include a HIGH
  const signals = [];

  for (let i = 0; i < count; i++) {
    const isHigh = includeHigh && i === 0;
    const code = isHigh
      ? SIGNAL_CODES_HIGH[Math.floor(Math.random() * SIGNAL_CODES_HIGH.length)]
      : SIGNAL_CODES_OTHER[Math.floor(Math.random() * SIGNAL_CODES_OTHER.length)];

    signals.push({
      code,
      t: Date.now(),
      key: `elem-${Math.random().toString(36).slice(2, 8)}`,
      meta: code === 'KNOWN_FINGERPRINT' ? { tool: 'sider' } : { len: 120 },
    });
  }
  return signals;
}

function getPercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function run() {
  console.log('='.repeat(70));
  console.log(`[LoadTest] Target: ${TARGET_CLIENTS} clients | Duration: ${DURATION_SEC}s | Server: ${SERVER_URL}`);
  console.log('='.repeat(70));

  await mongoose.connect(MONGO_URI);
  console.log('[LoadTest] Connected to MongoDB');

  // Load or create exam
  let exam = await Exam.findOne({ title: 'Load Test Exam' });
  if (!exam) {
    exam = await Exam.findOne();
    if (!exam) {
      exam = await Exam.create({
        title: 'Load Test Exam',
        startAt: new Date(),
        endAt: new Date(Date.now() + 24 * 3600 * 1000),
        durationMin: 120,
        sensitivity: 'MEDIUM',
      });
      console.log('[LoadTest] Created fallback Load Test Exam');
    }
  }

  // Load loadtest users
  let users = await User.find({ email: /^loadtest/i }).limit(TARGET_CLIENTS);
  if (users.length < TARGET_CLIENTS) {
    console.log(`[LoadTest] Found ${users.length} loadtest users in DB. Creating remaining up to ${TARGET_CLIENTS}...`);
    const toCreate = [];
    const passwordHash = await User.hashPassword('Load@123');
    for (let i = users.length + 1; i <= TARGET_CLIENTS; i++) {
      toCreate.push({
        name: `Load Test ${i}`,
        email: `loadtest${i}@demo.com`,
        passwordHash,
        role: 'CANDIDATE',
        isActive: true,
      });
    }
    if (toCreate.length > 0) {
      await User.insertMany(toCreate, { ordered: false }).catch(() => {});
      users = await User.find({ email: /^loadtest/i }).limit(TARGET_CLIENTS);
    }
  }

  console.log(`[LoadTest] Loaded ${users.length} users. Preparing candidate sessions and JWTs...`);

  // Ensure sessions exist
  const clientConfigs = [];
  for (const user of users) {
    const token = jwt.sign(
      { sub: String(user._id), role: user.role || 'CANDIDATE', name: user.name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    let session = await Session.findOne({ examId: exam._id, candidateId: user._id });
    if (!session) {
      session = await Session.create({
        examId: exam._id,
        candidateId: user._id,
        status: 'ONLINE',
        startedAt: new Date(),
      });
    }

    clientConfigs.push({
      userId: String(user._id),
      sessionId: String(session._id),
      token,
    });
  }

  console.log(`[LoadTest] Spawning ${clientConfigs.length} sockets (ramp ${RAMP_RATE_PER_SEC}/s)...`);

  const sockets = [];
  const intervals = [];
  let connectedCount = 0;
  let batchesSent = 0;
  let batchesAcked = 0;
  let errorCount = 0;
  const latencies = [];
  let windowBatches = 0;

  // Ramp up clients
  let spawned = 0;
  const startTime = Date.now();

  const spawnBatch = () => {
    const toSpawn = Math.min(RAMP_RATE_PER_SEC, clientConfigs.length - spawned);
    for (let i = 0; i < toSpawn; i++) {
      const cfg = clientConfigs[spawned++];
      const socket = io(SERVER_URL, {
        auth: { token: cfg.token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 3,
        timeout: 10000,
      });

      socket.on('connect', () => {
        connectedCount++;
        socket.emit('session:join', { sessionId: cfg.sessionId }, (ack) => {
          if (!ack || !ack.ok) errorCount++;
        });

        // Emit signal batches every 3 seconds
        const batchInterval = setInterval(() => {
          if (socket.connected) {
            const signals = getRandomSignals();
            const start = Date.now();
            batchesSent++;
            socket.emit('signals:batch', { sessionId: cfg.sessionId, signals }, (ack) => {
              const rtt = Date.now() - start;
              latencies.push(rtt);
              if (!ack || !ack.ok) {
                errorCount++;
              } else {
                batchesAcked++;
                windowBatches++;
              }
            });
          }
        }, 3000);

        intervals.push(batchInterval);
      });

      socket.on('disconnect', () => {
        connectedCount = Math.max(0, connectedCount - 1);
      });

      socket.on('connect_error', () => {
        errorCount++;
      });

      sockets.push(socket);
    }
  };

  const rampTimer = setInterval(() => {
    if (spawned < clientConfigs.length) {
      spawnBatch();
    } else {
      clearInterval(rampTimer);
    }
  }, 1000);
  spawnBatch();

  // Periodic metrics every 10 seconds
  const metricTimer = setInterval(() => {
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const rate = windowBatches / 10;
    windowBatches = 0;
    const p50 = getPercentile(latencies, 50);
    const p95 = getPercentile(latencies, 95);
    const p99 = getPercentile(latencies, 99);

    console.log(
      `[T+${String(elapsedSec).padStart(3, ' ')}s] ` +
        `Connected: ${String(connectedCount).padStart(4, ' ')} | ` +
        `Batches/s: ${rate.toFixed(1).padStart(5, ' ')} | ` +
        `p50: ${String(p50).padStart(3, ' ')}ms | ` +
        `p95: ${String(p95).padStart(3, ' ')}ms | ` +
        `p99: ${String(p99).padStart(3, ' ')}ms | ` +
        `Errors: ${errorCount}`
    );
  }, 10000);

  // Stop test after DURATION_SEC
  setTimeout(async () => {
    clearInterval(rampTimer);
    clearInterval(metricTimer);
    for (const iv of intervals) clearInterval(iv);

    for (const s of sockets) {
      s.disconnect();
    }

    const totalSec = (Date.now() - startTime) / 1000;
    const avgRate = batchesAcked / totalSec;
    const p50 = getPercentile(latencies, 50);
    const p95 = getPercentile(latencies, 95);
    const p99 = getPercentile(latencies, 99);
    const mem = process.memoryUsage();

    console.log('\n' + '='.repeat(70));
    console.log('FINAL LOAD TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Duration:            ${totalSec.toFixed(1)} seconds`);
    console.log(`Peak Connections:    ${connectedCount} sockets`);
    console.log(`Total Batches Sent:  ${batchesSent}`);
    console.log(`Total Batches Acked: ${batchesAcked}`);
    console.log(`Average Throughput:  ${avgRate.toFixed(1)} batches/sec`);
    console.log(`Latency p50:         ${p50} ms`);
    console.log(`Latency p95:         ${p95} ms`);
    console.log(`Latency p99:         ${p99} ms`);
    console.log(`Total Errors:        ${errorCount}`);
    console.log(`Process Heap Used:   ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
    console.log(`Process RSS:         ${(mem.rss / 1024 / 1024).toFixed(1)} MB`);
    console.log('='.repeat(70));

    await mongoose.disconnect();
    process.exit(0);
  }, DURATION_SEC * 1000);
}

run().catch((err) => {
  console.error('[LoadTest] Fatal error:', err);
  process.exit(1);
});
