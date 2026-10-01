const { performance } = require('node:perf_hooks');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { io } = require('socket.io-client');

const baseUrl = (process.env.LOADTEST_URL || 'http://localhost:5000').replace(/\/$/, '');
const apiUrl = (process.env.LOADTEST_API_URL || `${baseUrl}/api/v1`).replace(/\/$/, '');
const clients = Number(process.env.LOADTEST_CLIENTS || 500);
const mode = process.env.LOADTEST_MODE || 'benchmark';
const execFileAsync = promisify(execFile);

async function runHealthLoad() {
  const started = performance.now();
  const results = await Promise.all(
    Array.from({ length: clients }, async () => {
      try {
        const response = await fetch(`${baseUrl}/health`);
        return response.ok;
      } catch {
        return false;
      }
    })
  );
  const passed = results.filter(Boolean).length;
  const elapsed = Math.round(performance.now() - started);
  console.log(`Health load test: ${passed}/${clients} passed in ${elapsed}ms`);
  if (passed !== clients) process.exitCode = 1;
}

async function runSignalLoad() {
  const tokens = (process.env.LOADTEST_TOKENS || '').split(',').filter(Boolean);
  const sessionIds = (process.env.LOADTEST_SESSION_IDS || '').split(',').filter(Boolean);
  if (tokens.length !== clients || sessionIds.length !== clients) {
    throw new Error(`Signal mode requires exactly ${clients} candidate tokens and session IDs`);
  }
  if (new Set(sessionIds).size !== sessionIds.length) {
    throw new Error('Signal mode requires one unique active candidate session per client');
  }

  const makeFlag = process.env.LOADTEST_FLAG_BURST === '1';
  const code = makeFlag ? 'EXTENSION_IFRAME' : 'WINDOW_BLUR';
  const started = performance.now();
  const results = await Promise.all(tokens.map(async (token, index) => {
    try {
      const response = await fetch(`${apiUrl}/sessions/${sessionIds[index]}/signals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signals: [{
            id: randomUUID(),
            code,
            severity: makeFlag ? 'HIGH' : 'LOW',
            t: Date.now(),
            meta: makeFlag ? { extensionOrigin: 'loadtest' } : { eventType: 'loadtest' },
          }],
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }));

  const passed = results.filter(Boolean).length;
  const elapsed = Math.round(performance.now() - started);
  console.log(`Signal burst: ${passed}/${clients} batches accepted in ${elapsed}ms (${makeFlag ? 'creates test flags' : 'low-severity signals only'})`);
  if (passed !== clients) process.exitCode = 1;
}

function percentile(samples, fraction) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted.length ? Math.round(sorted[Math.ceil(sorted.length * fraction) - 1]) : null;
}

function parseCsvNumbers(value, fallback) {
  if (!value) return fallback;
  const parts = String(value).split(',').map((part) => part.trim());
  const parsed = parts.map(Number);
  if (parsed.some((n) => !Number.isInteger(n) || n < 1)) throw new Error('LOADTEST_STAGES must be a comma-separated list of supported stage sizes');
  return parsed;
}

function summarize(samples) {
  const values = samples.filter(Number.isFinite);
  if (!values.length) return { count: 0, min: null, mean: null, p50: null, p95: null, p99: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    count: values.length,
    min: Math.round(sorted[0] * 100) / 100,
    mean: Math.round(avg * 100) / 100,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: Math.round(sorted[sorted.length - 1] * 100) / 100,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function parseCredentials(data) {
  const candidates = Array.isArray(data) ? data : data?.candidates;
  if (!Array.isArray(candidates)) throw new Error('Credentials file must contain a candidates array');
  const normalized = candidates.map((item) => ({ token: item?.token, sessionId: item?.sessionId }));
  if (normalized.some((item) => typeof item.token !== 'string' || !item.token || typeof item.sessionId !== 'string' || !item.sessionId)) {
    throw new Error('Each candidate credential needs a token and sessionId');
  }
  if (new Set(normalized.map((item) => item.sessionId)).size !== normalized.length) {
    throw new Error('Credentials file must use one unique session per candidate');
  }
  return {
    candidates: normalized,
    proctorToken: data?.proctorToken || '',
    examId: data?.examId || '',
  };
}

async function readCredentials() {
  const credentialPath = process.env.LOADTEST_CREDENTIALS_FILE
    ? path.resolve(process.env.LOADTEST_CREDENTIALS_FILE)
    : path.join(__dirname, 'credentials.json');
  try {
    return parseCredentials(JSON.parse(await fs.readFile(credentialPath, 'utf8')));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const tokens = (process.env.LOADTEST_TOKENS || '').split(',').filter(Boolean);
    const sessionIds = (process.env.LOADTEST_SESSION_IDS || '').split(',').filter(Boolean);
    if (!tokens.length && !sessionIds.length) {
      throw new Error(`Missing ${credentialPath}. Run "npm run loadtest:prepare" first, or provide LOADTEST_TOKENS and LOADTEST_SESSION_IDS.`);
    }
    return parseCredentials({
      candidates: tokens.map((token, index) => ({ token, sessionId: sessionIds[index] })),
      proctorToken: process.env.LOADTEST_PROCTOR_TOKEN || '',
      examId: process.env.LOADTEST_EXAM_ID || '',
    });
  }
}

function loadTestConfig() {
  const stages = parseCsvNumbers(process.env.LOADTEST_STAGES, [50, 100, 250, 500]);
  if (stages.some((n) => ![50, 100, 250, 500].includes(n))) {
    throw new Error('LOADTEST_STAGES can contain only 50, 100, 250, and 500');
  }
  const durationSeconds = Number(process.env.LOADTEST_DURATION_SECONDS || 30);
  const signalRate = Number(process.env.LOADTEST_SIGNAL_RATE || 10);
  const reconnectPercent = Number(process.env.LOADTEST_RECONNECT_PERCENT || 10);
  const rampSeconds = Number(process.env.LOADTEST_RAMP_SECONDS || 5);
  const maxAckP95Ms = Number(process.env.LOADTEST_MAX_ACK_P95_MS || 1500);
  const minConnectPercent = Number(process.env.LOADTEST_MIN_CONNECT_PERCENT || 99);
  const minReconnectPercent = Number(process.env.LOADTEST_MIN_RECONNECT_PERCENT || 99);
  const minAckPercent = Number(process.env.LOADTEST_MIN_ACK_PERCENT || 99);
  const sampleMs = Number(process.env.LOADTEST_SAMPLE_MS || 1000);
  const reconnectRampMs = Number(process.env.LOADTEST_RECONNECT_RAMP_MS || 5000);
  const maxInFlight = Number(process.env.LOADTEST_MAX_IN_FLIGHT || 500);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 5 || durationSeconds > 3600) throw new Error('LOADTEST_DURATION_SECONDS must be 5..3600');
  if (!Number.isFinite(rampSeconds) || rampSeconds < 0 || rampSeconds > 120) throw new Error('LOADTEST_RAMP_SECONDS must be 0..120');
  if (!Number.isFinite(signalRate) || signalRate < 0 || signalRate > 1000) throw new Error('LOADTEST_SIGNAL_RATE must be 0..1000 batches/sec');
  if (!Number.isFinite(reconnectPercent) || reconnectPercent < 0 || reconnectPercent > 100) throw new Error('LOADTEST_RECONNECT_PERCENT must be 0..100');
  if (![minConnectPercent, minReconnectPercent, minAckPercent].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) {
    throw new Error('Configured minimum success percentages must be between 0 and 100');
  }
  if (!Number.isFinite(maxAckP95Ms) || maxAckP95Ms < 0) throw new Error('LOADTEST_MAX_ACK_P95_MS must be a non-negative number');
  if (!Number.isFinite(sampleMs) || sampleMs < 500 || sampleMs > 10000) throw new Error('LOADTEST_SAMPLE_MS must be 500..10000');
  if (!Number.isFinite(reconnectRampMs) || reconnectRampMs < 0 || reconnectRampMs > 120000) throw new Error('LOADTEST_RECONNECT_RAMP_MS must be 0..120000');
  if (!Number.isInteger(maxInFlight) || maxInFlight < 1 || maxInFlight > 10000) throw new Error('LOADTEST_MAX_IN_FLIGHT must be 1..10000');
  return {
    stages: [...new Set(stages)].sort((a, b) => a - b),
    durationSeconds,
    signalRate,
    reconnectPercent,
    rampSeconds: Math.max(0, Math.min(rampSeconds, 120)),
    sampleMs,
    maxAckP95Ms,
    minConnectPercent,
    minReconnectPercent,
    minAckPercent,
    serverPid: Number.isInteger(Number(process.env.LOADTEST_SERVER_PID)) && Number(process.env.LOADTEST_SERVER_PID) > 0
      ? Number(process.env.LOADTEST_SERVER_PID)
      : null,
    reconnectRampMs,
    maxInFlight,
  };
}

function openAuthenticatedSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth: { token },
      reconnection: false,
      timeout: 15000,
      transports: ['websocket'],
    });
    const timeout = setTimeout(() => fail(new Error('connect timeout')), 20000);
    const clean = () => {
      clearTimeout(timeout);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
    };
    const fail = (error) => {
      clean();
      socket.disconnect();
      reject(error);
    };
    const onConnect = () => {
      clean();
      resolve(socket);
    };
    const onError = (error) => fail(error);
    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
  });
}

function joinCandidateSocket(socket, sessionId) {
  return new Promise((resolve, reject) => {
    socket.timeout(15000).emit('session:join', { sessionId }, (error, result) => {
      if (error) return reject(new Error('session:join acknowledgement timeout'));
      if (!result?.ok) return reject(new Error(result?.error || 'session join failed'));
      resolve(result);
    });
  });
}

async function connectAndJoin(candidate, timings) {
  const started = performance.now();
  let socket;
  try {
    socket = await openAuthenticatedSocket(candidate.token);
    await joinCandidateSocket(socket, candidate.sessionId);
    timings.push(performance.now() - started);
    return { ...candidate, socket, reconnecting: false };
  } catch (error) {
    if (socket) socket.disconnect();
    timings.push(performance.now() - started);
    throw error;
  }
}

function connectProctorObserver(token, examId, counters) {
  if (!token || !examId) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, { auth: { token }, reconnection: false, timeout: 15000, transports: ['websocket'] });
    let finished = false;
    const timeout = setTimeout(() => fail(new Error('observer connect timeout')), 20000);
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      socket.off('connect_error', onError);
    };
    const fail = (error) => {
      finish();
      socket.disconnect();
      reject(error);
    };
    const onError = (error) => fail(error);
    socket.on('signal:new', () => { counters.signals += 1; });
    socket.on('flag:new', () => { counters.flags += 1; });
    socket.once('connect_error', onError);
    socket.once('connect', () => {
      socket.timeout(15000).emit('proctor:join', { examId }, (error, result) => {
        if (error || !result?.ok) return fail(new Error(result?.error || 'proctor join failed'));
        finish();
        resolve(socket);
      });
    });
  });
}

function readLinuxProcess(pid) {
  const stat = require('node:fs').readFileSync(`/proc/${pid}/stat`, 'utf8');
  const close = stat.lastIndexOf(')');
  const fields = stat.slice(close + 2).trim().split(/\s+/);
  const rssPages = Number(fields[21]);
  return {
    cpuSeconds: (Number(fields[11]) + Number(fields[12])) / 100,
    rssBytes: rssPages * 4096,
  };
}

async function readServerProcess(pid) {
  if (!pid) return null;
  try {
    if (process.platform === 'win32') {
      const script = `$p=Get-Process -Id ${pid} -ErrorAction Stop; Write-Output "$($p.CPU)|$($p.WorkingSet64)"`;
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 2500 });
      const [cpu, rss] = stdout.trim().split('|').map(Number);
      return Number.isFinite(cpu) && Number.isFinite(rss) ? { cpuSeconds: cpu, rssBytes: rss } : null;
    }
    if (process.platform === 'linux') return readLinuxProcess(pid);
    const { stdout } = await execFileAsync('ps', ['-o', '%cpu=,rss=', '-p', String(pid)], { timeout: 2500 });
    const [cpuPercent, rssKb] = stdout.trim().split(/\s+/).map(Number);
    return Number.isFinite(cpuPercent) && Number.isFinite(rssKb) ? { cpuPercent, rssBytes: rssKb * 1024 } : null;
  } catch {
    return null;
  }
}

class ResourceSampler {
  constructor(serverPid, intervalMs) {
    this.serverPid = serverPid;
    this.intervalMs = intervalMs;
    this.samples = [];
    this.timer = null;
    this.startedAt = 0;
    this.cpuBaseline = null;
    this.previousServer = null;
    this.serverCpuPercent = [];
    this.previousSampleAt = 0;
    this.sampleRunning = false;
  }

  async sample() {
    if (this.sampleRunning) return;
    this.sampleRunning = true;
    const sampleStarted = performance.now();
    const cpu = process.cpuUsage();
    const cpuInterval = this.previousCpu
      ? { user: cpu.user - this.previousCpu.user, system: cpu.system - this.previousCpu.system }
      : cpu;
    const intervalMs = this.previousSampleAt ? Math.max(1, sampleStarted - this.previousSampleAt) : this.intervalMs;
    const cpuPercent = ((cpuInterval.user + cpuInterval.system) / 1000 / intervalMs) * 100;
    this.previousCpu = cpu;
    this.previousSampleAt = sampleStarted;
    const sample = {
      at: new Date().toISOString(),
      generatorRssBytes: process.memoryUsage().rss,
      generatorCpuPercentOneCore: cpuPercent,
      hostFreeMemoryBytes: os.freemem(),
      hostTotalMemoryBytes: os.totalmem(),
    };
    const server = await readServerProcess(this.serverPid);
    if (server) {
      sample.serverRssBytes = server.rssBytes;
      if (Number.isFinite(server.cpuPercent)) sample.serverCpuPercent = server.cpuPercent;
      else if (this.previousServer) {
        const deltaCpu = server.cpuSeconds - this.previousServer.cpuSeconds;
        const deltaWall = (performance.now() - this.previousServer.measuredAt) / 1000;
        if (deltaWall > 0 && deltaCpu >= 0) {
          sample.serverCpuPercent = (deltaCpu / deltaWall / os.cpus().length) * 100;
        }
      }
      this.previousServer = { ...server, measuredAt: performance.now() };
    }
    if (Number.isFinite(sample.serverCpuPercent)) this.serverCpuPercent.push(sample.serverCpuPercent);
    this.samples.push(sample);
    this.sampleRunning = false;
  }

  async start() {
    this.startedAt = performance.now();
    this.cpuBaseline = process.cpuUsage();
    this.previousCpu = this.cpuBaseline;
    await this.sample();
    this.timer = setInterval(() => { void this.sample(); }, this.intervalMs);
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.sample();
    const maxOf = (key) => Math.max(0, ...this.samples.map((sample) => sample[key]).filter(Number.isFinite));
    const avgOf = (key) => {
      const values = this.samples.map((sample) => sample[key]).filter(Number.isFinite);
      return values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
    };
    return {
      samples: this.samples.length,
      generatorCpuPercentOneCore: { mean: avgOf('generatorCpuPercentOneCore'), peak: maxOf('generatorCpuPercentOneCore') },
      generatorRssBytes: { mean: avgOf('generatorRssBytes'), peak: maxOf('generatorRssBytes') },
      serverCpuPercent: this.serverCpuPercent.length
        ? { mean: avgOf('serverCpuPercent'), peak: maxOf('serverCpuPercent') }
        : null,
      serverRssBytes: this.serverPid && this.samples.some((sample) => Number.isFinite(sample.serverRssBytes))
        ? { peak: maxOf('serverRssBytes') }
        : null,
      hostFreeMemoryBytes: { minimum: Math.min(...this.samples.map((sample) => sample.hostFreeMemoryBytes)) },
    };
  }
}

function emitLoadSignal(connection, latencySamples) {
  const started = performance.now();
  const signal = {
    id: randomUUID(),
    code: 'WINDOW_BLUR',
    severity: 'LOW',
    t: Date.now(),
    meta: { eventType: 'loadtest' },
  };
  return new Promise((resolve) => {
    connection.socket.timeout(15000).emit('signals:batch', {
      sessionId: connection.sessionId,
      signals: [signal],
    }, (error, result) => {
      const latencyMs = performance.now() - started;
      latencySamples.push(latencyMs);
      resolve({ ok: !error && result?.ok === true, latencyMs });
    });
  });
}

async function reconnectConnection(connection, reconnectLatency) {
  connection.socket.disconnect();
  await delay(200);
  try {
    const replacement = await connectAndJoin(connection, reconnectLatency);
    connection.socket = replacement.socket;
    connection.reconnecting = false;
    connection.socket.emit('heartbeat', { focused: true });
    return true;
  } catch (error) {
    connection.reconnecting = false;
    connection.reconnectError = error.message;
    return false;
  }
}

async function runStage(target, credentials, config) {
  const stageStart = new Date();
  const stageClock = performance.now();
  const connectLatencies = [];
  const signalLatencies = [];
  const reconnectLatencies = [];
  const observerCounts = { signals: 0, flags: 0 };
  const resources = new ResourceSampler(config.serverPid, config.sampleMs);
  await resources.start();
  let observer = null;
  let observerError = '';
  if (credentials.proctorToken && credentials.examId) {
    try {
      observer = await connectProctorObserver(credentials.proctorToken, credentials.examId, observerCounts);
    } catch (error) {
      observerError = error.message;
    }
  }

  const candidateInputs = credentials.candidates.slice(0, target);
  const rampMs = config.rampSeconds * 1000;
  const connections = new Array(target);
  const connectionErrors = [];
  await Promise.all(candidateInputs.map(async (candidate, index) => {
    if (rampMs) await delay((index / Math.max(1, target - 1)) * rampMs);
    try {
      connections[index] = await connectAndJoin(candidate, connectLatencies);
    } catch (error) {
      connectionErrors.push({ index: index + 1, message: error.message });
    }
  }));
  const connected = connections.filter(Boolean);
  const connectElapsedMs = performance.now() - stageClock;
  let attemptedBatches = 0;
  let acknowledgedBatches = 0;
  let rejectedBatches = 0;
  let backpressureSkips = 0;
  let inFlight = 0;
  let roundRobin = 0;
  let nextSendAt = performance.now();
  let heartbeatTimer = null;
  let signalTimer = null;
  let reconnectPromise = Promise.resolve({ attempts: 0, successes: 0 });

  const reconnectCount = Math.min(connected.length, Math.floor(target * config.reconnectPercent / 100));
  const reconnectTargets = connected.slice(0, reconnectCount);
  const reconnectAt = Math.max(1000, Math.floor(config.durationSeconds * 500));
  const runReconnects = async () => {
    let successes = 0;
    await Promise.all(reconnectTargets.map(async (connection, index) => {
      connection.reconnecting = true;
      if (config.reconnectRampMs) await delay((index / Math.max(1, reconnectTargets.length - 1)) * config.reconnectRampMs);
      if (await reconnectConnection(connection, reconnectLatencies)) successes += 1;
    }));
    return { attempts: reconnectTargets.length, successes };
  };
  if (reconnectCount) reconnectPromise = delay(reconnectAt).then(runReconnects);

  const runMs = config.durationSeconds * 1000;
  const stageActiveStart = performance.now();
  if (config.signalRate > 0) {
    const intervalMs = 1000 / config.signalRate;
    signalTimer = setInterval(() => {
      const now = performance.now();
      let scheduled = 0;
      while (now >= nextSendAt && scheduled < 25) {
        nextSendAt += intervalMs;
        scheduled += 1;
        if (inFlight >= config.maxInFlight) {
          backpressureSkips += 1;
          continue;
        }
        const ready = connected.filter((item) => item && !item.reconnecting && item.socket.connected);
        if (!ready.length) {
          backpressureSkips += 1;
          continue;
        }
        const connection = ready[roundRobin % ready.length];
        roundRobin += 1;
        attemptedBatches += 1;
        inFlight += 1;
        void emitLoadSignal(connection, signalLatencies).then((result) => {
          if (result.ok) acknowledgedBatches += 1;
          else rejectedBatches += 1;
        }).finally(() => { inFlight -= 1; });
      }
    }, Math.max(5, Math.min(50, intervalMs)));
  }
  heartbeatTimer = setInterval(() => {
    for (const connection of connected) {
      if (connection && !connection.reconnecting && connection.socket.connected) {
        connection.socket.emit('heartbeat', { focused: true });
      }
    }
  }, 10000);

  await delay(runMs);
  clearInterval(signalTimer);
  clearInterval(heartbeatTimer);
  const reconnections = await reconnectPromise;
  // Let acknowledgements already in the client queue return before closing sockets.
  const drainDeadline = performance.now() + 16000;
  while (inFlight > 0 && performance.now() < drainDeadline) await delay(50);
  for (const connection of connected) connection.socket.disconnect();
  if (observer) observer.disconnect();
  const resourceSummary = await resources.stop();
  const elapsedSeconds = (performance.now() - stageActiveStart) / 1000;
  const ackPercent = attemptedBatches ? (acknowledgedBatches / attemptedBatches) * 100 : 100;
  const connectPercent = target ? (connected.length / target) * 100 : 0;
  const reconnectPercent = reconnections.attempts ? (reconnections.successes / reconnections.attempts) * 100 : 100;
  const latency = summarize(signalLatencies);
  const checks = {
    connected: connectPercent >= config.minConnectPercent,
    acknowledged: ackPercent >= config.minAckPercent,
    ackP95: latency.p95 === null || latency.p95 <= config.maxAckP95Ms,
    reconnected: reconnectPercent >= config.minReconnectPercent,
    observerJoined: config.signalRate === 0 || Boolean(observer),
    serverEmittedSignal: config.signalRate === 0 || (observedSignals !== null && observedSignals > 0),
  };
  const observedSignals = observer ? observerCounts.signals : null;
  return {
    target,
    connected: connected.length,
    connectionPercent: Math.round(connectPercent * 100) / 100,
    connectElapsedMs: Math.round(connectElapsedMs),
    connectLatencyMs: summarize(connectLatencies),
    connectionErrors: connectionErrors.slice(0, 20),
    reconnectErrors: connected.filter((connection) => connection.reconnectError)
      .slice(0, 20).map((connection, index) => ({ index: index + 1, message: connection.reconnectError })),
    durationSeconds: Math.round(elapsedSeconds * 100) / 100,
    configuredSignalBatchesPerSecond: config.signalRate,
    attemptedBatches,
    acknowledgedBatches,
    rejectedBatches,
    scheduledButSkipped: backpressureSkips,
    ackPercent: Math.round(ackPercent * 100) / 100,
    attemptedBatchRatePerSecond: Math.round((attemptedBatches / elapsedSeconds) * 100) / 100,
    observedServerSignalEvents: observedSignals,
    observedServerSignalRatePerSecond: observedSignals === null ? null : Math.round((observedSignals / elapsedSeconds) * 100) / 100,
    observerError,
    signalAckLatencyMs: latency,
    reconnects: {
      attempted: reconnections.attempts,
      succeeded: reconnections.successes,
      failed: reconnections.attempts - reconnections.successes,
      percent: Math.round(reconnectPercent * 100) / 100,
      latencyMs: summarize(reconnectLatencies),
    },
    resources: resourceSummary,
    checks,
    passed: Object.values(checks).every(Boolean),
    startedAt: stageStart.toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

function markdownReport(report) {
  const rows = report.stages.map((stage) => [
    stage.target,
    `${stage.connected}/${stage.target} (${stage.connectionPercent}%)`,
    `${stage.acknowledgedBatches}/${stage.attemptedBatches}`,
    `${stage.attemptedBatchRatePerSecond}/s attempted`,
    `${stage.signalAckLatencyMs.p50 ?? '—'} / ${stage.signalAckLatencyMs.p95 ?? '—'} / ${stage.signalAckLatencyMs.p99 ?? '—'} ms`,
    `${stage.reconnects.succeeded}/${stage.reconnects.attempted}`,
    stage.resources.serverCpuPercent ? `${stage.resources.serverCpuPercent.mean.toFixed(1)}% / ${stage.resources.serverCpuPercent.peak.toFixed(1)}%` : 'Not sampled',
    stage.resources.serverRssBytes ? `${(stage.resources.serverRssBytes.peak / 1048576).toFixed(1)} MB peak` : 'Not sampled',
    stage.passed ? 'PASS' : 'FAIL',
  ].map((value) => String(value).replaceAll('|', '\\|')));
  const table = [
    '| Sessions | Connected | Batch ACKs | Actual batch rate | ACK p50 / p95 / p99 | Reconnects | Server CPU avg / peak | Server RSS peak | Result |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
  const generator = report.stages.at(-1)?.resources;
  return [
    '# Browser Overlay Dashboard load-test report',
    '',
    `- Run: ${report.startedAt} to ${report.finishedAt}`,
    `- Target: ${report.baseUrl}`,
    `- Host: ${report.host.platform} ${report.host.arch}; Node ${report.runtime.nodeVersion}; ${report.host.cpuCount} logical CPUs (${report.host.cpuModel}); ${(report.host.totalMemoryBytes / 1073741824).toFixed(1)} GB RAM`,
    `- Stages: ${report.config.stages.join(', ')}`,
    `- Soak duration: ${report.config.durationSeconds}s per stage; signal target ${report.config.signalRate} batches/s`,
    `- Reconnect selection: ${report.config.reconnectPercent}% per stage`,
    `- Overall: **${report.passed ? 'PASS' : 'FAIL'}** (${report.stages.filter((stage) => stage.passed).length}/${report.stages.length} stages passed configured thresholds)`,
    '',
    table,
    '',
    '## Measurement notes',
    '',
    '- ACK latency is measured by the load generator from `signals:batch` emit until server acknowledgement; p50/p95/p99 include acknowledged and rejected completed callbacks. Timed-out callbacks are recorded as rejected.',
    '- Observed server signal events are counted by an authenticated proctor observer in the exam room. This is the count actually emitted to the live feed, not just attempted batches.',
    `- Server CPU/RSS ${report.config.serverPid ? 'were sampled from the configured server PID' : 'were not sampled: set LOADTEST_SERVER_PID to the API process PID'}. Load-generator CPU/RSS and host free memory are sampled separately.`,
    '- This is a benchmark run, not a production capacity guarantee. Record machine size, MongoDB/Redis placement, network path, app version, and environment alongside results before comparing runs.',
    '',
    '## Per-stage resource samples',
    '',
    ...report.stages.map((stage) => `- **${stage.target} sessions:** generator CPU mean/peak ${stage.resources.generatorCpuPercentOneCore.mean.toFixed(1)}%/${stage.resources.generatorCpuPercentOneCore.peak.toFixed(1)}% of one core; generator RSS peak ${(stage.resources.generatorRssBytes.peak / 1048576).toFixed(1)} MB; host free memory minimum ${(stage.resources.hostFreeMemoryBytes.minimum / 1073741824).toFixed(2)} GB.`),
    '',
  ].join('\n');
}

async function writeBenchmarkReport(report) {
  const reportDir = process.env.LOADTEST_REPORT_DIR
    ? path.resolve(process.env.LOADTEST_REPORT_DIR)
    : path.join(__dirname, 'reports');
  await fs.mkdir(reportDir, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(reportDir, `loadtest-${stamp}.json`);
  const markdownPath = path.join(reportDir, `loadtest-${stamp}.md`);
  await Promise.all([
    fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    fs.writeFile(markdownPath, markdownReport(report), 'utf8'),
  ]);
  return { jsonPath, markdownPath };
}

async function runBenchmark() {
  const config = loadTestConfig();
  const credentials = await readCredentials();
  const maxStage = Math.max(...config.stages);
  if (credentials.candidates.length < maxStage) {
    throw new Error(`Need ${maxStage} candidate credentials; found ${credentials.candidates.length}. Run npm run loadtest:prepare.`);
  }
  const startedAt = new Date().toISOString();
  const stages = [];
  for (const target of config.stages) {
    console.log(`\n[loadtest] ${target} sessions · ${config.durationSeconds}s · ${config.signalRate} signal batches/s · reconnect ${config.reconnectPercent}%`);
    const stage = await runStage(target, credentials, config);
    stages.push(stage);
    console.log(`[loadtest] ${target}: ${stage.connected}/${target} connected; ${stage.acknowledgedBatches}/${stage.attemptedBatches} ACKed at ${stage.attemptedBatchRatePerSecond}/s attempted; p50/p95/p99 ${stage.signalAckLatencyMs.p50}/${stage.signalAckLatencyMs.p95}/${stage.signalAckLatencyMs.p99}ms; server emitted ${stage.observedServerSignalEvents ?? 'unobserved'}; reconnect ${stage.reconnects.succeeded}/${stage.reconnects.attempted}; ${stage.passed ? 'PASS' : 'FAIL'}`);
  }
  const report = {
    schemaVersion: 1,
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl,
    apiUrl,
    runtime: { nodeVersion: process.version },
    host: { platform: process.platform, arch: process.arch, cpuCount: os.cpus().length, cpuModel: os.cpus()[0]?.model || 'unknown', totalMemoryBytes: os.totalmem() },
    config: {
      stages: config.stages,
      durationSeconds: config.durationSeconds,
      signalRate: config.signalRate,
      reconnectPercent: config.reconnectPercent,
      rampSeconds: config.rampSeconds,
      sampleMs: config.sampleMs,
      reconnectRampMs: config.reconnectRampMs,
      maxInFlight: config.maxInFlight,
      serverPid: config.serverPid,
      thresholds: {
        minConnectPercent: config.minConnectPercent,
        minAckPercent: config.minAckPercent,
        maxAckP95Ms: config.maxAckP95Ms,
        minReconnectPercent: config.minReconnectPercent,
      },
    },
    stages,
    passed: stages.every((stage) => stage.passed),
  };
  const files = await writeBenchmarkReport(report);
  console.log(`\nActual benchmark report: ${files.markdownPath}`);
  console.log(`Machine-readable results: ${files.jsonPath}`);
  console.log(`Overall result: ${report.passed ? 'PASS' : 'FAIL'}`);
  if (!report.passed) process.exitCode = 1;
}

function connectCandidate(token, sessionId) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth: { token },
      reconnection: false,
      timeout: 60000,
      transports: ['websocket'],
    });
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('connect timeout'));
    }, 65000);
    socket.once('connect', () => {
      socket.timeout(20000).emit('session:join', { sessionId }, (error, result) => {
        clearTimeout(timeout);
        if (error || !result?.ok) {
          socket.disconnect();
          reject(new Error(result?.error || 'session join failed'));
          return;
        }
        resolve(socket);
      });
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(error);
    });
  });
}

function emitBatch(socket, sessionId) {
  const started = performance.now();
  const signal = {
    id: randomUUID(),
    code: 'WINDOW_BLUR',
    severity: 'LOW',
    t: Date.now(),
    meta: { eventType: 'loadtest' },
  };
  return new Promise((resolve) => {
    socket.timeout(20000).emit('signals:batch', { sessionId, signals: [signal] }, (error, result) => {
      resolve({
        accepted: !error && result?.ok === true,
        latencyMs: performance.now() - started,
      });
    });
  });
}

async function runSocketLoad() {
  const tokens = (process.env.LOADTEST_TOKENS || '').split(',').filter(Boolean);
  const sessionIds = (process.env.LOADTEST_SESSION_IDS || '').split(',').filter(Boolean);
  if (tokens.length !== clients || sessionIds.length !== clients) {
    throw new Error(`Socket mode requires exactly ${clients} candidate tokens and session IDs`);
  }
  if (new Set(sessionIds).size !== sessionIds.length) {
    throw new Error('Socket mode requires one unique active candidate session per client');
  }

  const started = performance.now();
  const connections = await Promise.all(tokens.map(async (token, index) => {
    try {
      return { socket: await connectCandidate(token, sessionIds[index]), sessionId: sessionIds[index] };
    } catch (error) {
      return { error: error.message };
    }
  }));
  const connected = connections.filter((result) => result.socket);
  const connectionElapsed = Math.round(performance.now() - started);
  const acknowledgements = await Promise.all(
    connected.map(({ socket, sessionId }) => emitBatch(socket, sessionId))
  );
  const accepted = acknowledgements.filter((result) => result.accepted).length;
  const latencies = acknowledgements.filter((result) => result.accepted).map((result) => result.latencyMs);

  for (const { socket } of connected) socket.disconnect();
  console.log(`Socket load: ${connected.length}/${clients} candidate sessions connected and joined in ${connectionElapsed}ms`);
  console.log(`Signal batches: ${accepted}/${connected.length} acknowledged; ack latency p50=${percentile(latencies, 0.5)}ms, p95=${percentile(latencies, 0.95)}ms`);
  if (connected.length !== clients || accepted !== clients) process.exitCode = 1;
}

async function run() {
  if (!Number.isInteger(clients) || clients < 1 || clients > 1000) {
    throw new Error('LOADTEST_CLIENTS must be an integer from 1 to 1000');
  }
  if (mode === 'health') return runHealthLoad();
  if (mode === 'signals') return runSignalLoad();
  if (mode === 'socket') return runSocketLoad();
  if (mode === 'benchmark') return runBenchmark();
  throw new Error('LOADTEST_MODE must be "benchmark", "health", "signals", or "socket"');
}

run().catch((error) => {
  console.error('Load test failed:', error.message);
  process.exitCode = 1;
});
