import api from '../api/client.js';
import { DETECTOR_CONFIG } from './config.js';

const MAX_BATCH_SIZE = 50;

export function createBatcher({ socket, sessionId }) {
  const storageKey = `proctor:signalQueue:${sessionId}`;
  let queue = [];
  let timer = null;
  let stopped = false;
  let flushPromise = null;

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(stored)) queue = stored.slice(-DETECTOR_CONFIG.maxSignalBuffer);
  } catch (error) {
    console.warn('[Detector] Unable to restore queued signals:', error);
  }

  const persist = () => {
    try {
      if (queue.length) localStorage.setItem(storageKey, JSON.stringify(queue));
      else localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('[Detector] Unable to persist queued signals:', error);
    }
  };

  const sendSocket = payload => new Promise(resolve => {
    if (!socket?.connected) return resolve(false);
    let settled = false;
    const timeout = setTimeout(() => finish(false), DETECTOR_CONFIG.ackTimeoutMs);
    const finish = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(Boolean(ok));
    };
    try {
      socket.emit('signals:batch', payload, ack => finish(ack?.ok === true));
    } catch (error) {
      console.warn('[Detector] Socket emission failed:', error);
      finish(false);
    }
  });

  const flush = async (forceHttp = false) => {
    if (flushPromise) {
      await flushPromise;
      if (queue.length && (forceHttp || !stopped)) return flush(forceHttp);
      return queue.length === 0;
    }
    if (!queue.length) return true;
    if (stopped && !forceHttp) return false;

    const current = (async () => {
      while (queue.length) {
        const batch = queue.slice(0, MAX_BATCH_SIZE);
        let delivered = forceHttp ? false : await sendSocket({ sessionId, signals: batch });
        if (!delivered) {
          try {
            await api.post(`/sessions/${sessionId}/signals`, { signals: batch });
            delivered = true;
          } catch (error) {
            console.warn('[Detector] Signal fallback failed; keeping signals queued:', error?.message || error);
            persist();
            return false;
          }
        }
        if (delivered) {
          queue.splice(0, batch.length);
          persist();
        }
      }
      return true;
    })();
    flushPromise = current;
    try {
      return await current;
    } finally {
      if (flushPromise === current) flushPromise = null;
    }
  };

  const enqueue = signal => {
    if (stopped || !signal) return;
    if (queue.length >= DETECTOR_CONFIG.maxSignalBuffer) {
      const lowIndex = queue.findIndex(item => item.severity === 'LOW');
      if (lowIndex >= 0) queue.splice(lowIndex, 1);
      else queue.shift();
    }
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    queue.push({ ...signal, id });
    persist();
    if (signal.severity === 'HIGH' || queue.length >= MAX_BATCH_SIZE) void flush();
  };

  timer = setInterval(() => void flush(), DETECTOR_CONFIG.batchFlushMs);
  return {
    enqueue,
    flush: () => flush(),
    stop: async () => {
      if (stopped) return queue.length === 0;
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      persist();
      // Start the HTTP request before the caller disconnects its session socket.
      return flush(true);
    },
  };
}
