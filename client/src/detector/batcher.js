import api from '../api/client.js';
import { DETECTOR_CONFIG } from './config.js';

const MAX_BATCH_SIZE = 50;
const ACK_TIMEOUT_MS = 5000;

export function createBatcher({ socket, sessionId }) {
  const storageKey = `proctor:signalQueue:${sessionId}`;
  let queue = [];
<<<<<<< HEAD
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
=======
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(stored)) queue = stored;
  } catch (error) {
    console.warn('[Detector] Unable to restore queued signals:', error);
  }
  let timer = null;
  let isStopped = false;
  let flushPromise = null;

  const persist = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(queue));
    } catch (error) {
      console.warn('[Detector] Unable to persist queued signals:', error);
    }
  };

  const flush = async (force = false) => {
    if (flushPromise) return flushPromise;
    if (queue.length === 0) return true;
    if (isStopped && !force) return false;

    let delivered = false;
    flushPromise = (async () => {
      const signalsToSend = queue.slice(0, MAX_BATCH_SIZE);
      const payload = { sessionId, signals: signalsToSend };

      if (socket?.connected) {
        delivered = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(false), ACK_TIMEOUT_MS);
          try {
            socket.emit('signals:batch', payload, (ack) => {
              clearTimeout(timeout);
              resolve(Boolean(ack?.ok));
            });
          } catch (error) {
            clearTimeout(timeout);
            console.warn('[Detector] Socket emission failed:', error);
            resolve(false);
          }
        });
      }

      if (!delivered) {
        try {
          await api.post(`/sessions/${sessionId}/signals`, { signals: signalsToSend });
          delivered = true;
        } catch (error) {
          console.warn('[Detector] HTTP signal fallback failed; signals remain queued:', error);
        }
      }

      if (delivered) {
        queue.splice(0, signalsToSend.length);
        persist();
      } else {
        persist();
      }
      return delivered;
    })();

    let deliveredBatch = false;
    try {
      deliveredBatch = await flushPromise;
    } finally {
      flushPromise = null;
    }

    if (deliveredBatch && queue.length > 0 && (!isStopped || force)) return flush(force);
    return queue.length === 0;
  };

  const enqueue = (signal) => {
    if (isStopped || !signal) return;
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    queue.push({ ...signal, id });
    persist();
    if (signal.severity === 'HIGH' || queue.length >= MAX_BATCH_SIZE) {
      void flush();
    }
  };

  // Periodic flush timer (2.5s)
  timer = setInterval(flush, FLUSH_INTERVAL_MS);

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    isStopped = true;
    persist();
    return flush(true);
>>>>>>> origin/main
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
