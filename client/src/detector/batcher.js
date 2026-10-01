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
const LOCAL_DEDUPE_MS = 6000;

export function createBatcher({ socket, sessionId }) {
  let queue = [];
  const recentDispatches = new Map(); // key -> last dispatch timestamp
  let timer = null;
  let isStopped = false;

  // Flush queued signals to server
  const flush = async () => {
    if (queue.length === 0 || isStopped) return;

    const signalsToSend = queue.splice(0, MAX_BATCH_SIZE);
    const payload = {
      sessionId,
      signals: signalsToSend,
    };

    // 1. Attempt delivery via Socket.IO if connected
    let deliveredViaSocket = false;
    if (socket && socket.connected) {
      try {
        socket.emit('signals:batch', payload, (ack) => {
          if (ack && ack.ok) {
            deliveredViaSocket = true;
          }
        });
        deliveredViaSocket = true;
      } catch (err) {
        console.warn('[Detector] Socket emission failed, falling back to HTTP:', err);
      }
    }

    // 2. HTTP Fallback per SPEC Section 5 (POST /sessions/:id/signals)
    if (!deliveredViaSocket) {
      try {
        await api.post(`/sessions/${sessionId}/signals`, { signals: signalsToSend });
      } catch (httpErr) {
        console.warn('[Detector] HTTP signal fallback error:', httpErr);
      }
    }
  };

  // Add signal to queue with local debouncing and immediate HIGH severity flush
  const enqueue = (signal) => {
    if (isStopped || !signal) return;

    // Local deduplication for keyed signals
    if (signal.key) {
      const dedupeKey = `${signal.code}:${signal.key}`;
      const lastSent = recentDispatches.get(dedupeKey) || 0;
      if (Date.now() - lastSent < LOCAL_DEDUPE_MS) {
        return; // Skip duplicate within debounce window
      }
      recentDispatches.set(dedupeKey, Date.now());
    }

    queue.push(signal);

    // Rule: Immediately flush on any HIGH severity signal (KNOWN_FINGERPRINT, EXTENSION_IFRAME)
    if (signal.severity === 'HIGH' || queue.length >= MAX_BATCH_SIZE) {
      flush();
    }
  };

  // Periodic flush timer (2.5s)
  timer = setInterval(flush, FLUSH_INTERVAL_MS);

  // Teardown and final flush
  const stop = () => {
    isStopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    // Final flush of remaining items
    if (queue.length > 0) {
      flush();
    }
    recentDispatches.clear();
  };

  return {
    enqueue,
    flush,
    stop,
  };
}
