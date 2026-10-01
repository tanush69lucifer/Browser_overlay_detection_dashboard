const { performance } = require('node:perf_hooks');
const { randomUUID } = require('node:crypto');
const { io } = require('socket.io-client');

const baseUrl = (process.env.LOADTEST_URL || 'http://localhost:5001').replace(/\/$/, '');
const apiUrl = (process.env.LOADTEST_API_URL || `${baseUrl}/api/v1`).replace(/\/$/, '');
const clients = Number(process.env.LOADTEST_CLIENTS || 500);
const mode = process.env.LOADTEST_MODE || 'health';

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
  throw new Error('LOADTEST_MODE must be "health", "signals", or "socket"');
}

run().catch((error) => {
  console.error('Load test failed:', error.message);
  process.exitCode = 1;
});
