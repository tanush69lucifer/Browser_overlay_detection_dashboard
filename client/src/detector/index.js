import { DETECTOR_CONFIG } from './config.js';
import { scanFingerprints } from './fingerprints.js';
import { createScanner } from './scanner.js';
import { startFocusSignals } from './focus.js';
import { createBatcher } from './batcher.js';
import { startHeartbeat } from './heartbeat.js';

/** Start the browser-sandbox integrity detector for one active exam session. */
export function startDetector({ socket, sessionId, fingerprints = [] }) {
  if (!sessionId) {
    console.warn('[Detector] startDetector called without sessionId.');
    return () => {};
  }

  const batcher = createBatcher({ socket, sessionId });
  const scanner = createScanner();
  let stopped = false;
  let scanTimer = null;
  let mutationTimer = null;
  const queuedNodes = new Set();

  const enqueueAll = signals => signals.forEach(signal => batcher.enqueue(signal));
  const runScan = () => {
    if (stopped) return;
    try {
      enqueueAll(scanner.scanTopLevel([...queuedNodes]));
      queuedNodes.clear();
      enqueueAll(scanFingerprints(fingerprints));
    } catch (error) {
      console.warn('[Detector] DOM scan error:', error);
    }
  };

  // Initial snapshot sets the DOM baseline before injected nodes are counted.
  runScan();

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

  if (observer && document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'id', 'src'],
    });
  }

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
  };
}

export default startDetector;
