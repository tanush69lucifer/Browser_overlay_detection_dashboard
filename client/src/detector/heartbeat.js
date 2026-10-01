import { DETECTOR_CONFIG } from './config.js';

export function startHeartbeat({ socket, sessionId }) {
  if (!socket?.emit) return () => {};
  const send = () => {
    try {
      if (socket.connected) {
        socket.emit('heartbeat', { sessionId, focused: Boolean(document.hasFocus() && !document.hidden) });
      }
    } catch (error) {
      console.warn('[Detector] Heartbeat dispatch failed:', error);
    }
  };
  send();
  const timer = setInterval(send, DETECTOR_CONFIG.heartbeatIntervalMs);
  return () => clearInterval(timer);
}
