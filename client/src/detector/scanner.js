import { DETECTOR_CONFIG, SEVERITIES, SIGNAL_CODES } from './config.js';

function shortHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36).slice(0, 7);
}

function excluded(el) {
  try { return Boolean(el.closest('[data-proctor]')); } catch { return true; }
}

function signal(code, severity, key, meta = {}) {
  return { code, severity, key, t: Date.now(), meta };
}

export function createScanner() {
  const reportedOverlays = new WeakSet();
  const reportedShadowRoots = new WeakSet();
  const reportedIframes = new WeakSet();
  const reportedDeltas = new Set();
  let baseline = null;
  let initialTreeScanned = false;

  function checkNode(el) {
    if (!(el instanceof Element) || !el.isConnected || excluded(el)) return [];
    const signals = [];

    try {
      const style = window.getComputedStyle(el);
      const zIndex = Number.parseInt(style.zIndex, 10);
      const position = style.position;
      const rect = el.getBoundingClientRect();
      const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
      const areaPct = Math.round((Math.max(0, rect.width) * Math.max(0, rect.height) / viewportArea) * 10000) / 100;

      if ((position === 'fixed' || position === 'absolute') && Number.isFinite(zIndex) && zIndex > DETECTOR_CONFIG.zIndexThreshold && areaPct >= DETECTOR_CONFIG.minimumOverlayAreaPct && !reportedOverlays.has(el)) {
        reportedOverlays.add(el);
        const idClass = `${el.id || ''}.${typeof el.className === 'string' ? el.className : ''}`;
        const key = `${el.tagName}:${zIndex}:${shortHash(idClass)}`;
        signals.push(signal(SIGNAL_CODES.FIXED_HIGH_Z_NODE, SEVERITIES.MED, key, { zIndex, areaPct, tag: el.tagName.slice(0, 12) }));
      }
    } catch { /* Detached or restricted nodes are skipped safely. */ }

    if (el.shadowRoot && !reportedShadowRoots.has(el.shadowRoot)) {
      reportedShadowRoots.add(el.shadowRoot);
      signals.push(signal(SIGNAL_CODES.FOREIGN_SHADOW_ROOT, SEVERITIES.MED, `shadow:${el.tagName}:${shortHash(el.id || el.className || '')}`, { tag: el.tagName.slice(0, 12) }));
    }

    if (el.tagName === 'IFRAME' && !reportedIframes.has(el)) {
      const src = el.getAttribute('src') || '';
      if (src.startsWith('chrome-extension://') || src.startsWith('moz-extension://')) {
        reportedIframes.add(el);
        signals.push(signal(SIGNAL_CODES.EXTENSION_IFRAME, SEVERITIES.HIGH, `iframe:${shortHash(src)}`, { scheme: src.startsWith('moz-extension://') ? 'moz-extension' : 'chrome-extension' }));
      }
    }
    return signals;
  }

  function checkTopLevelCounts() {
    const countRelevantChildren = element => element ? Array.from(element.children).filter(child => !excluded(child)).length : 0;
    const counts = [countRelevantChildren(document.documentElement), countRelevantChildren(document.body)];
    if (!baseline) { baseline = counts; return []; }
    const signals = [];
    for (let index = 0; index < counts.length; index += 1) {
      const delta = counts[index] - baseline[index];
      const target = index === 0 ? 'html' : 'body';
      const key = `${target}:${baseline[index]}:${counts[index]}`;
      if (delta >= 2 && !reportedDeltas.has(key)) {
        reportedDeltas.add(key);
        signals.push(signal(SIGNAL_CODES.DOM_NODE_DELTA, SEVERITIES.LOW, `dom-delta:${key}`, { target, delta }));
      }
    }
    return signals;
  }

  function scanTopLevel(queuedNodes = []) {
    const signals = [];
    const nodes = new Set();
    const addTree = root => {
      if (!(root instanceof Element)) return;
      nodes.add(root);
      for (const child of root.querySelectorAll('*')) nodes.add(child);
      // Shadow roots are detected on their host in checkNode(); do not scan
      // their contents, which could include platform-owned UI in a proctor root.
    };
    if (!initialTreeScanned) {
      addTree(document.documentElement);
      initialTreeScanned = true;
    } else {
      for (const node of queuedNodes) addTree(node);
      for (const el of document.documentElement?.children || []) nodes.add(el);
      for (const el of document.body?.children || []) nodes.add(el);
    }
    for (const node of nodes) signals.push(...checkNode(node));
    signals.push(...checkTopLevelCounts());
    return signals;
  }

  return { checkNode, scanTopLevel };
}
