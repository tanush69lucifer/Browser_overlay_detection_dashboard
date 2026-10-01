import { DETECTOR_CONFIG } from './config.js';

export function startHeartbeat({ socket, sessionId }) {
  if (!socket?.emit) return () => {};
  const send = () => {
    try {
      socket.emit('heartbeat', { sessionId, focused: Boolean(document.hasFocus() && !document.hidden) });
    } catch { /* A heartbeat is best-effort; the socket reconnect lifecycle handles recovery. */ }
  };
  send();
  const timer = setInterval(send, DETECTOR_CONFIG.heartbeatIntervalMs);
  return () => clearInterval(timer);
}
