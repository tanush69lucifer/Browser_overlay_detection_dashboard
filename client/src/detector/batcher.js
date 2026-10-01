import api from '../api/client.js';
import { DETECTOR_CONFIG } from './config.js';

const MAX_BATCH_SIZE = 50;
const LOCAL_DEDUPE_MS = 6000;

export function createBatcher({ socket, sessionId }) {
  let queue = [];
  const recent = new Map();
  let timer = null;
  let stopped = false;
  let flushPromise = null;

  const sendSocket = payload => new Promise(resolve => {
    if (!socket?.connected || typeof socket.emit !== 'function') return resolve(false);
    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(Boolean(ok));
    };
    const timeout = setTimeout(() => finish(false), DETECTOR_CONFIG.ackTimeoutMs);
    try {
      socket.emit('signals:batch', payload, ack => finish(ack?.ok === true));
    } catch {
      finish(false);
    }
  });

  const flush = async ({ final = false } = {}) => {
    if (flushPromise) {
      await flushPromise;
      if (final && queue.length) return flush({ final: true });
      return;
    }
    if (queue.length === 0 || (!final && stopped)) return;
    const currentFlush = (async () => {
      // Leave the batch in the queue until a transport confirms acceptance.
      while (queue.length) {
        const batch = queue.slice(0, MAX_BATCH_SIZE);
        const payload = { sessionId, signals: batch };
        let delivered = final ? false : await sendSocket(payload);
        if (!delivered) {
          try {
            await api.post(`/sessions/${sessionId}/signals`, { signals: batch });
            delivered = true;
          } catch (error) {
            console.warn('[Detector] Signal delivery failed; retaining batch for retry:', error?.message || error);
            break;
          }
        }
        if (delivered) queue.splice(0, batch.length);
      }
    })();
    flushPromise = currentFlush;
    try { await currentFlush; }
    finally { if (flushPromise === currentFlush) flushPromise = null; }
  };

  const enqueue = signal => {
    if (stopped || !signal) return;
    const now = Date.now();
    if (signal.key) {
      const dedupeKey = `${signal.code}:${signal.key}`;
      const last = recent.get(dedupeKey) || 0;
      if (now - last < LOCAL_DEDUPE_MS) return;
      recent.set(dedupeKey, now);
    }
    if (recent.size > 500) {
      for (const [key, timestamp] of recent) if (now - timestamp > LOCAL_DEDUPE_MS) recent.delete(key);
    }
    if (queue.length >= DETECTOR_CONFIG.maxSignalBuffer) {
      const lowIndex = queue.findIndex(item => item.severity === 'LOW');
      if (lowIndex >= 0) queue.splice(lowIndex, 1);
      else if (signal.severity === 'LOW') return;
      else queue.shift();
    }
    queue.push(signal);
    if (signal.severity === 'HIGH' || signal.code === 'WINDOW_BLUR' || signal.code === 'TAB_HIDDEN' || queue.length >= MAX_BATCH_SIZE) void flush();
  };

  timer = setInterval(() => void flush(), DETECTOR_CONFIG.batchFlushMs);
  return {
    enqueue,
    flush: () => flush(),
    stop: async () => {
      if (stopped) return;
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      await flush({ final: true });
      recent.clear();
    },
  };
}
