import { scanFingerprints } from './fingerprints';
import { scanHighZNodes, scanExtensionIframes, scanShadowRoots, checkNodeDelta } from './scanners';
import { setupListeners } from './listeners';
import { createBatcher } from './batcher';

/**
 * Client Integrity & Browser Overlay Detector
 * Owner: Sumit Chaudhary (sumit-chaudhary11)
 *
 * Contract per SPEC.md Section 8:
 * startDetector({ socket, sessionId, fingerprints }) -> stop()
 *
 * Runs all detection mechanisms:
 * 1. Fingerprint matching (KNOWN_FINGERPRINT)
 * 2. Extension iframe detection (EXTENSION_IFRAME)
 * 3. High z-index fixed/absolute nodes (FIXED_HIGH_Z_NODE)
 * 4. Open shadow roots and foreign HTML children (FOREIGN_SHADOW_ROOT)
 * 5. Top-level body node delta growth (DOM_NODE_DELTA)
 * 6. Window blur & visibility tracking (WINDOW_BLUR, TAB_HIDDEN)
 * 7. Large paste clipboard length tracking (LARGE_PASTE)
 * 8. DevTools window gap heuristics (DEVTOOLS_OPEN)
 *
 * Batches signals (2.5s or immediate HIGH flush), delivers via Socket.IO with HTTP fallback,
 * and maintains 12s candidate heartbeat.
 */
export function startDetector({ socket, sessionId, fingerprints = [] }) {
  if (!sessionId) {
    console.warn('[Detector] startDetector called without sessionId. Aborting.');
    return () => {};
  }

  // 1. Establish baseline DOM metrics
  const baselineBodyChildren = document.body ? document.body.children.length : 0;

  // 2. Initialize Signal Batcher & Dispatcher
  const batcher = createBatcher({ socket, sessionId });

  // 3. Core DOM scan routine
  const runDomScan = () => {
    try {
      const fpSignals = scanFingerprints(fingerprints);
      fpSignals.forEach((s) => batcher.enqueue(s));

      const highZSignals = scanHighZNodes();
      highZSignals.forEach((s) => batcher.enqueue(s));

      const iframeSignals = scanExtensionIframes();
      iframeSignals.forEach((s) => batcher.enqueue(s));

      const shadowSignals = scanShadowRoots();
      shadowSignals.forEach((s) => batcher.enqueue(s));

      const deltaSignals = checkNodeDelta(baselineBodyChildren);
      deltaSignals.forEach((s) => batcher.enqueue(s));
    } catch (err) {
      console.warn('[Detector] DOM scan error:', err);
    }
  };

  // Perform immediate initial sweep
  runDomScan();

  // 4. Setup MutationObserver for real-time DOM injection monitoring
  let mutationDebounceTimer = null;
  const observer = new MutationObserver(() => {
    if (mutationDebounceTimer) return;
    mutationDebounceTimer = setTimeout(() => {
      mutationDebounceTimer = null;
      runDomScan();
    }, 250);
  });

  try {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'src'],
      });
    }
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
      });
    }
  } catch (obsErr) {
    console.warn('[Detector] MutationObserver initialization error:', obsErr);
  }

  // 5. Periodic background sweep timer (every 3 seconds)
  const periodicScanTimer = setInterval(runDomScan, 3000);

  // 6. Setup event listeners (blur, visibility, paste, devtools gap)
  const stopListeners = setupListeners((signal) => {
    batcher.enqueue(signal);
  });

  // 7. Setup 12-second candidate heartbeat per SPEC Section 6
  const sendHeartbeat = () => {
    try {
      const isFocused = document.hasFocus() && !document.hidden;
      if (socket && socket.connected) {
        socket.emit('heartbeat', {
          sessionId,
          focused: isFocused,
        });
      }
    } catch (hbErr) {
      console.warn('[Detector] Heartbeat dispatch failed:', hbErr);
    }
  };

  sendHeartbeat();
  const heartbeatTimer = setInterval(sendHeartbeat, 12000);

  console.info(`[Detector] Integrity monitoring started for session: ${sessionId}`);

  // 8. Return cleanup teardown function
  return function stop() {
    console.info(`[Detector] Stopping detector for session: ${sessionId}`);

    if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
    observer.disconnect();
    clearInterval(periodicScanTimer);
    clearInterval(heartbeatTimer);
    stopListeners();
    batcher.stop();
  };
}

export default startDetector;
