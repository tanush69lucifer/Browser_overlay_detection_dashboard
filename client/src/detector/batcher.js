import { DETECTOR_CONFIG, SEVERITIES } from './config.js';
import { post } from '../api/client.js';

export function createBatcher({ socket, sessionId }) {
  const buffer = [];
  let stopped = false;
  let inFlight = false;
  let offlineSince = null;
  let fallbackTimer = null;
  let fallbackInFlight = false;
  let flushTimer = null;
  let retryTimer = null;

  function scheduleFallback(delay = Math.max(0, offlineSince + DETECTOR_CONFIG.offlineFallbackMs - Date.now())) {
    if (fallbackTimer !== null || fallbackInFlight || !sessionId) return;
    fallbackTimer = setTimeout(() => {
      fallbackTimer = null;
      sendHttpFallback();
    }, delay);
  }
  function startOfflineClock() {
    if (stopped) return;
    if (offlineSince === null) offlineSince = Date.now();
    scheduleFallback();
  }
  function clearOfflineClock() {
    offlineSince = null;
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  function push(signal) {
    if (stopped || !signal || typeof signal.code !== 'string') return;
    const safe = { code: signal.code, severity: signal.severity || SEVERITIES.LOW, t: Number(signal.t) || Date.now(), meta: signal.meta || {} };
    if (signal.key) safe.key = String(signal.key).slice(0, 100);
    if (buffer.length >= DETECTOR_CONFIG.maxSignalBuffer) {
      const lowIndex = buffer.findIndex(item => item.severity === SEVERITIES.LOW);
      if (lowIndex !== -1) buffer.splice(lowIndex, 1);
      else return;
    }
    buffer.push(safe);
    if (!socket?.connected) startOfflineClock();
    if (safe.severity === SEVERITIES.HIGH) flush();
  }

  function flush() {
    if (!buffer.length || inFlight || stopped && !socket?.connected) return;
    if (!socket?.connected) { startOfflineClock(); return; }
    inFlight = true;
    const batch = buffer.splice(0, buffer.length);
    let settled = false;
    const timeout = setTimeout(() => settle(false), DETECTOR_CONFIG.ackTimeoutMs);
    function settle(ok) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      inFlight = false;
      if (ok) {
        clearOfflineClock();
        if (buffer.length) flush();
      } else {
        buffer.unshift(...batch);
        startOfflineClock();
        if (!stopped) retryTimer = setTimeout(() => { retryTimer = null; flush(); }, 1000);
      }
    }
    try {
      socket.emit('signals:batch', { sessionId, signals: batch }, response => settle(Boolean(response?.ok ?? response?.success ?? true)));
    } catch { settle(false); }
  }

  async function sendHttpFallback() {
    if (!buffer.length || !sessionId || fallbackInFlight) return;
    fallbackInFlight = true;
    const batch = buffer.splice(0, buffer.length);
    try {
      await post(`/sessions/${encodeURIComponent(sessionId)}/signals`, { signals: batch }, { timeoutMs: 5000 });
      clearOfflineClock();
    } catch {
      buffer.unshift(...batch);
      if (socket?.connected && !stopped) flush();
      else if (!stopped) {
        // Retry later without spinning if the API is also unreachable.
        fallbackInFlight = false;
        offlineSince = Date.now();
        scheduleFallback(DETECTOR_CONFIG.offlineFallbackMs);
      }
    } finally {
      fallbackInFlight = false;
    }
  }

  flushTimer = setInterval(flush, DETECTOR_CONFIG.batchFlushMs);
  if (socket?.on) {
    socket.on('connect', flush);
    socket.on('disconnect', startOfflineClock);
  }
  return {
    push,
    flush,
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(flushTimer);
      clearTimeout(fallbackTimer);
      clearTimeout(retryTimer);
      socket?.off?.('connect', flush);
      socket?.off?.('disconnect', startOfflineClock);
      if (socket?.connected) flush();
      else sendHttpFallback();
    }
  };
}
