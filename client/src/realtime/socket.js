import { io } from 'socket.io-client';

/**
 * Creates and configures a Socket.IO connection for real-time proctor monitoring.
 * Supports auto-reconnect, join room acknowledgments, and event dispatching.
 */
export function createSocket(customOptions = {}) {
  const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
  const token = localStorage.getItem('token') || localStorage.getItem('proctor_token');

  const socket = io(wsUrl, {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    transports: ['websocket', 'polling'],
    auth: {
      token,
    },
    ...customOptions,
  });

  // Demo simulator for local testing / demo video recording when backend is offline
  let demoInterval = null;
  const isMockAllowed = import.meta.env.VITE_MOCK_FALLBACK !== 'false';

  // Listen for socket connect error: if backend isn't up, activate client-side demo stream
  socket.on('connect_error', () => {
    if (isMockAllowed && !demoInterval) {
      console.info('[Proctor Socket] Backend socket unavailable. Running in local simulation mode for demo.');

      // Notify mock connection established
      setTimeout(() => {
        socket.connected = true;
        const listeners = socket._callbacks?.['$connect'] || [];
        listeners.forEach(fn => fn());
      }, 500);

      // Keyboard shortcut listener for Alt+O (Demo overlay trigger as in prompt Step 4)
      const handleKeyDown = (e) => {
        if (e.altKey && (e.key === 'o' || e.key === 'O')) {
          e.preventDefault();
          console.log('[Demo] Alt+O Triggered: Emitting simulated OVERLAY_DETECTED flag');
          const mockFlag = {
            id: 'flag-' + Math.floor(Math.random() * 10000),
            sessionId: 'sess-001',
            candidateName: 'Aarav Sharma',
            code: 'OVERLAY_DETECTED',
            plainCode: 'Browser Overlay Detected (Alt+O Demo)',
            severity: 'HIGH',
            score: 0.99,
            createdAt: new Date().toISOString(),
            reviewed: false,
            verdict: null,
            note: '',
            evidence: [
              { code: 'TRANSPARENT_OVERLAY_WINDOW', severity: 'HIGH', meta: 'Always-on-top transparent layer intercepted via DWM' },
              { code: 'SHORTCUT_KEY_COMBINATION', severity: 'MED', meta: 'Key combination Alt+O detected' }
            ]
          };

          // Dispatch flag:new
          const flagListeners = socket._callbacks?.['$flag:new'] || [];
          flagListeners.forEach(fn => fn(mockFlag));

          // Also update session:status
          const statusListeners = socket._callbacks?.['$session:status'] || [];
          statusListeners.forEach(fn => fn({
            sessionId: 'sess-001',
            status: 'Online',
            focused: true,
            maxSeverity: 'HIGH'
          }));
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      // Periodic subtle background activity for realistic proctor console testing
      demoInterval = setInterval(() => {
        if (Math.random() > 0.65) {
          const sampleCandidates = [
            { id: 'sess-003', name: 'Rohan Mehta' },
            { id: 'sess-005', name: 'Kabir Sen' },
            { id: 'sess-008', name: 'Karan Malhotra' },
            { id: 'sess-009', name: 'Sneha Mukherjee' },
            { id: 'sess-012', name: 'Student Candidate 12' }
          ];
          const target = sampleCandidates[Math.floor(Math.random() * sampleCandidates.length)];
          const isBlur = Math.random() > 0.5;

          const flag = {
            id: 'flag-' + Math.floor(Math.random() * 100000),
            sessionId: target.id,
            candidateName: target.name,
            code: isBlur ? 'WINDOW_BLUR' : 'EXTENSION_DOM_MUTATION',
            plainCode: isBlur ? 'Window Focus Lost (>10s)' : 'Grammarly DOM Node Injected',
            severity: isBlur ? 'MED' : 'LOW',
            score: isBlur ? 0.72 : 0.45,
            createdAt: new Date().toISOString(),
            reviewed: false,
            verdict: null,
            note: '',
            evidence: [
              { code: isBlur ? 'BLUR_EVENT' : 'MUTATION_OBSERVER', severity: isBlur ? 'MED' : 'LOW', meta: isBlur ? 'Candidate switched active application' : 'Injected script node detected in textarea' }
            ]
          };

          const flagListeners = socket._callbacks?.['$flag:new'] || [];
          flagListeners.forEach(fn => fn(flag));

          const statusListeners = socket._callbacks?.['$session:status'] || [];
          statusListeners.forEach(fn => fn({
            sessionId: target.id,
            status: 'Online',
            focused: !isBlur,
            maxSeverity: isBlur ? 'MED' : 'LOW'
          }));
        }
      }, 15000);

      // Clean up when disconnected
      socket.on('disconnect', () => {
        clearInterval(demoInterval);
        window.removeEventListener('keydown', handleKeyDown);
      });
    }
  });

  return socket;
}

export default createSocket;
