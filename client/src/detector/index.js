<<<<<<< HEAD
import { DETECTOR_CONFIG } from './config.js';
import { scanFingerprints } from './fingerprints.js';
import { createScanner } from './scanner.js';
import { startFocusSignals } from './focus.js';
import { createBatcher } from './batcher.js';
import { startHeartbeat } from './heartbeat.js';

/** Start the browser-sandbox integrity detector for one active exam session. */
export function startDetector({ socket, sessionId, fingerprints = [] }) {
=======
import { scanFingerprints } from './fingerprints';
import {
  isProctorElement,
  scanHighZNodes,
  scanExtensionIframes,
  scanShadowRoots,
  checkNodeDelta,
} from './scanners';
import { setupListeners } from './listeners';
import { createBatcher } from './batcher';
import { startHeartbeat } from './heartbeat';

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
 * 7. Paste event metadata without inspecting clipboard contents (PASTE_EVENT)
 * 8. DevTools window gap heuristics (DEVTOOLS_OPEN)
 *
 * Batches signals (2.5s or immediate HIGH flush), delivers via Socket.IO with HTTP fallback,
 * and maintains 12s candidate heartbeat.
 */
export function startDetector({ socket, sessionId, fingerprints = [], onExtensionStatus = () => {} }) {
>>>>>>> origin/main
  if (!sessionId) {
    console.warn('[Detector] startDetector called without sessionId.');
    return () => {};
  }

<<<<<<< HEAD
  const batcher = createBatcher({ socket, sessionId });
  const scanner = createScanner();
  let stopped = false;
  let scanTimer = null;
  let mutationTimer = null;
  const queuedNodes = new Set();
=======
  // 1. Establish baseline DOM metrics
  const baselineBodyChildren = document.body
    ? [...document.body.children].filter((child) => !isProctorElement(child)).length
    : 0;

  // 2. Initialize Signal Batcher & Dispatcher
  const batcher = createBatcher({ socket, sessionId });
  const activeDetections = new Map();
  const appearanceCounts = new Map();
  const handleExtensionMessage = (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.source !== 'overlay-proctor-extension') return;

    if (event.data.type === 'EXTENSION_STATUS') {
      onExtensionStatus(Boolean(event.data.ok && event.data.connected));
      return;
    }
    if (event.data.type !== 'BROWSER_TAB_SWITCH') return;

    const metadata = event.data.metadata;
    if (!metadata || typeof metadata.url !== 'string') return;
    let url;
    try {
      const parsed = new URL(metadata.url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      url = `${parsed.origin}${parsed.pathname}`.slice(0, 200);
    } catch {
      return;
    }

    batcher.enqueue({
      code: 'BROWSER_TAB_SWITCH',
      severity: 'LOW',
      t: Date.now(),
      key: `browser-tab:${globalThis.crypto?.randomUUID?.() || Date.now()}`,
      meta: {
        url,
        title: typeof metadata.title === 'string' ? metadata.title.slice(0, 120) : '',
        isExamTab: metadata.isExamTab === true,
      },
    });
  };
  window.addEventListener('message', handleExtensionMessage);
  window.postMessage({
    source: 'overlay-proctor-page',
    type: 'SESSION_START',
    sessionId,
  }, window.location.origin);
>>>>>>> origin/main

  const enqueueAll = signals => signals.forEach(signal => batcher.enqueue(signal));
  const runScan = () => {
    if (stopped) return;
    try {
<<<<<<< HEAD
      enqueueAll(scanner.scanTopLevel([...queuedNodes]));
      queuedNodes.clear();
      enqueueAll(scanFingerprints(fingerprints));
    } catch (error) {
      console.warn('[Detector] DOM scan error:', error);
=======
      const detections = [
        ...scanFingerprints(fingerprints),
        ...scanHighZNodes(),
        ...scanExtensionIframes(),
        ...scanShadowRoots(),
        ...checkNodeDelta(baselineBodyChildren),
      ];
      const currentDetections = new Map();

      for (const signal of detections) {
        const baseKey = `${signal.code}:${signal.key || 'unkeyed'}`;
        const signature = JSON.stringify({
          severity: signal.severity,
          weight: signal.weight,
          meta: signal.meta || {},
        });
        currentDetections.set(baseKey, signature);

        if (activeDetections.get(baseKey) === signature) continue;

        const occurrence = (appearanceCounts.get(baseKey) || 0) + 1;
        appearanceCounts.set(baseKey, occurrence);
        batcher.enqueue({
          ...signal,
          key: `${signal.key || 'unkeyed'}:appearance:${occurrence}`,
        });
      }

      activeDetections.clear();
      for (const [key, signature] of currentDetections) {
        activeDetections.set(key, signature);
      }
    } catch (err) {
      console.warn('[Detector] DOM scan error:', err);
>>>>>>> origin/main
    }
  };

  // Initial snapshot sets the DOM baseline before injected nodes are counted.
  runScan();

<<<<<<< HEAD
  // MutationObserver is the fast path; periodic scans catch style/layout changes
  // that do not produce a DOM mutation. Both paths share one throttled scan.
  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof Element) queuedNodes.add(record.target);
        for (const node of record.addedNodes || []) if (node instanceof Element) queuedNodes.add(node);
      }
      if (mutationTimer === null) {
        mutationTimer = setTimeout(() => {
          mutationTimer = null;
          runScan();
        }, 150);
      }
    })
    : null;
=======
  // 4. Setup MutationObserver for real-time DOM injection monitoring
  let mutationDebounceTimer = null;
  const observer = new MutationObserver((records) => {
    const externalMutation = records.some((record) =>
      !isProctorElement(record.target)
      && (record.type === 'attributes'
        || [...record.addedNodes, ...record.removedNodes].some((node) => !isProctorElement(node)))
    );
    if (!externalMutation) return;
    if (mutationDebounceTimer) return;
    mutationDebounceTimer = setTimeout(() => {
      mutationDebounceTimer = null;
      runDomScan();
    }, 250);
  });
>>>>>>> origin/main

  if (observer && document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'id', 'src'],
    });
  }

<<<<<<< HEAD
  scanTimer = setInterval(runScan, DETECTOR_CONFIG.scanIntervalMs);
  const stopFocus = startFocusSignals(signal => batcher.enqueue(signal));
  const stopHeartbeat = startHeartbeat({ socket, sessionId });

  console.info(`[Detector] Integrity monitoring started for session: ${sessionId}`);
  return function stop() {
    if (stopped) return;
    stopped = true;
    if (mutationTimer !== null) clearTimeout(mutationTimer);
    if (scanTimer !== null) clearInterval(scanTimer);
    observer?.disconnect();
    stopFocus();
    stopHeartbeat();
    // Drain over HTTP before the caller disconnects the session socket.
    return batcher.stop();
=======
  // 5. Periodic background sweep timer (every 3 seconds)
  const periodicScanTimer = setInterval(runDomScan, 3000);

  // 6. Setup event listeners (blur, visibility, paste, devtools gap)
  const stopListeners = setupListeners(
    (signal) => batcher.enqueue(signal),
    () => batcher.flush()
  );

  // 7. Setup 12-second candidate heartbeat per SPEC Section 6
  const stopHeartbeat = startHeartbeat({ socket, sessionId });

  console.info(`[Detector] Integrity monitoring started for session: ${sessionId}`);

  // 8. Return cleanup teardown function
  const stop = async function stop() {
    console.info(`[Detector] Stopping detector for session: ${sessionId}`);

    if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
    observer.disconnect();
    clearInterval(periodicScanTimer);
    stopHeartbeat();
    stopListeners();
    window.postMessage({
      source: 'overlay-proctor-page',
      type: 'SESSION_STOP',
    }, window.location.origin);
    window.removeEventListener('message', handleExtensionMessage);
    onExtensionStatus(false);
    await batcher.stop();
>>>>>>> origin/main
  };
  stop.flush = () => batcher.flush();
  return stop;
}

export default startDetector;
