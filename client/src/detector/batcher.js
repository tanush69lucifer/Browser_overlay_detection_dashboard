import api from '../api/client';

/**
 * Signal Batcher and Dispatcher.
 * Rules per SPEC Section 6 & 8:
 * - Emits `signals:batch` { sessionId, signals[] }
 * - Max 50 signals per batch
 * - Dispatched every 2.5 seconds
 * - Dispatched IMMEDIATELY on any HIGH signal
 * - Falls back to HTTP POST /sessions/:id/signals if socket is offline
 */

const FLUSH_INTERVAL_MS = 2500;
const MAX_BATCH_SIZE = 50;
const ACK_TIMEOUT_MS = 5000;

export function createBatcher({ socket, sessionId }) {
  const storageKey = `proctor:signalQueue:${sessionId}`;
  let queue = [];
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
  };

  return {
    enqueue,
    flush,
    stop,
  };
}
