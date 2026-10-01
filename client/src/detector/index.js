import { scanFingerprints } from './fingerprints.js';
import {
  isProctorElement,
  scanHighZNodes,
  scanExtensionIframes,
  scanShadowRoots,
  checkNodeDelta,
} from './scanners.js';
import { setupListeners } from './listeners.js';
import { createBatcher } from './batcher.js';
import { startHeartbeat } from './heartbeat.js';

/** Start the browser-visible integrity detector for an active exam session. */
export function startDetector({ socket, sessionId, fingerprints = [], onExtensionStatus = () => {} }) {
  if (!sessionId) {
    console.warn('[Detector] startDetector called without sessionId.');
    return () => {};
  }

  const baselineBodyChildren = document.body
    ? [...document.body.children].filter(child => !isProctorElement(child)).length
    : 0;
  const batcher = createBatcher({ socket, sessionId });
  const activeDetections = new Map();
  const appearanceCounts = new Map();
  let stopped = false;

  const handleExtensionMessage = event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.source !== 'overlay-proctor-extension') return;
    if (event.data.type === 'EXTENSION_STATUS') {
      onExtensionStatus(Boolean(event.data.ok && event.data.connected));
      return;
    }
    if (event.data.type !== 'BROWSER_TAB_SWITCH') return;

    const metadata = event.data.metadata;
    if (!metadata || typeof metadata.url !== 'string') return;
    try {
      const parsed = new URL(metadata.url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      batcher.enqueue({
        code: 'BROWSER_TAB_SWITCH',
        severity: 'LOW',
        t: Date.now(),
        key: `browser-tab:${globalThis.crypto?.randomUUID?.() || Date.now()}`,
        meta: {
          url: `${parsed.origin}${parsed.pathname}`.slice(0, 200),
          title: typeof metadata.title === 'string' ? metadata.title.slice(0, 120) : '',
          isExamTab: metadata.isExamTab === true,
        },
      });
    } catch { /* Ignore malformed companion messages. */ }
  };
  window.addEventListener('message', handleExtensionMessage);
  window.postMessage({ source: 'overlay-proctor-page', type: 'SESSION_START', sessionId }, window.location.origin);

  const runDomScan = () => {
    if (stopped) return;
    try {
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
        const signature = JSON.stringify({ severity: signal.severity, weight: signal.weight, meta: signal.meta || {} });
        currentDetections.set(baseKey, signature);
        if (activeDetections.get(baseKey) === signature) continue;

        const occurrence = (appearanceCounts.get(baseKey) || 0) + 1;
        appearanceCounts.set(baseKey, occurrence);
        batcher.enqueue({ ...signal, key: `${signal.key || 'unkeyed'}:appearance:${occurrence}` });
      }
      activeDetections.clear();
      for (const [key, signature] of currentDetections) activeDetections.set(key, signature);
      if (appearanceCounts.size > 2000) {
        for (const key of appearanceCounts.keys()) {
          if (!currentDetections.has(key)) appearanceCounts.delete(key);
          if (appearanceCounts.size <= 1000) break;
        }
      }
    } catch (error) {
      console.warn('[Detector] DOM scan error:', error);
    }
  };

  runDomScan();
  let mutationTimer = null;
  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(records => {
      const relevant = records.some(record => {
        if (isProctorElement(record.target)) return false;
        if (record.type === 'attributes') return true;
        return [...record.addedNodes, ...record.removedNodes].some(node => !isProctorElement(node));
      });
      if (!relevant || mutationTimer !== null) return;
      mutationTimer = setTimeout(() => {
        mutationTimer = null;
        runDomScan();
      }, 200);
    })
    : null;

  observer?.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'id', 'src'],
  });
  const scanTimer = setInterval(runDomScan, 2000);
  const stopListeners = setupListeners(signal => batcher.enqueue(signal), () => batcher.flush());
  const stopHeartbeat = startHeartbeat({ socket, sessionId });

  return async function stop() {
    if (stopped) return batcher.flush();
    stopped = true;
    if (mutationTimer !== null) clearTimeout(mutationTimer);
    clearInterval(scanTimer);
    observer?.disconnect();
    stopListeners();
    stopHeartbeat();
    window.postMessage({ source: 'overlay-proctor-page', type: 'SESSION_STOP' }, window.location.origin);
    window.removeEventListener('message', handleExtensionMessage);
    onExtensionStatus(false);
    return batcher.stop();
  };
}

export default startDetector;
