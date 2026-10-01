import { DETECTOR_CONFIG, SIGNAL_CODES } from './config.js';
import { start as startObserver } from './observers.js';
import { createScanner } from './scanner.js';
import { createFingerprintChecker } from './fingerprints.js';
import { startFocusSignals } from './focus.js';
import { createBatcher } from './batcher.js';
import { startHeartbeat } from './heartbeat.js';

export function startDetector({ socket, sessionId, fingerprints = [] } = {}) {
  const nodeQueue = new Set();
  const scanner = createScanner();
  const checkFingerprints = createFingerprintChecker(fingerprints);
  const batcher = createBatcher({ socket, sessionId });
  const stopObserver = startObserver(node => nodeQueue.add(node));
  const stopFocus = startFocusSignals(signal => {
    batcher.push(signal);
    // Browsers throttle timers in background tabs, so send focus transitions now.
    if (signal.code === SIGNAL_CODES.WINDOW_BLUR || signal.code === SIGNAL_CODES.TAB_HIDDEN) batcher.flush();
  });
  const stopHeartbeat = startHeartbeat({ socket, sessionId });
  let stopped = false;

  const process = () => {
    const queued = [...nodeQueue];
    nodeQueue.clear();
    const signals = scanner.scanTopLevel(queued);
    signals.push(...checkFingerprints());
    for (const signal of signals) batcher.push(signal);
  };
  const timer = setInterval(process, DETECTOR_CONFIG.scanIntervalMs);
  process();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      stopObserver();
      clearInterval(timer);
      stopFocus();
      stopHeartbeat();
      nodeQueue.clear();
      batcher.stop();
    }
  };
}
