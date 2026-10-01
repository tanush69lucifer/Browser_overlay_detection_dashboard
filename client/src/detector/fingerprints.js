import { DEFAULT_FINGERPRINTS } from './config.js';
import { getNodeIdentity } from './scanners.js';

function normalize(fp) {
  if (!fp || fp.isActive === false || fp.active === false) return null;
  const matcherType = fp.matcherType || (fp.selectors ? 'SELECTOR' : fp.prefixes ? 'IFRAME_SRC' : '');
  const matcher = fp.matcher
    || (Array.isArray(fp.selectors) ? fp.selectors.join(', ') : '')
    || fp.prefixes?.[0]
    || '';
  return matcherType && matcher ? { ...fp, matcherType, matcher } : null;
}

/** Find built-in and exam-configured fingerprints; emit only compact metadata. */
export function scanFingerprints(fingerprints = []) {
  const configured = Array.isArray(fingerprints) ? fingerprints : [];
  const list = [...DEFAULT_FINGERPRINTS, ...configured].map(normalize).filter(Boolean);
  const matches = [];

  for (const fp of list) {
    try {
      const tool = String(fp.tool || fp.name || 'UNKNOWN_TOOL').slice(0, 64);
      const severity = fp.allowed ? 'LOW' : (fp.severity || 'HIGH');
      const weight = fp.allowed ? 1 : (Number(fp.weight) || 10);
      if (fp.matcherType === 'SELECTOR') {
        for (const element of document.querySelectorAll(fp.matcher)) {
          if (element.closest('[data-proctor]')) continue;
          matches.push({
            code: 'KNOWN_FINGERPRINT', severity, weight, t: Date.now(),
            key: `${tool}:node:${getNodeIdentity(element)}`,
            meta: { tool, name: String(fp.name || tool).slice(0, 80), type: 'SELECTOR', allowed: Boolean(fp.allowed) },
          });
        }
      } else if (fp.matcherType === 'IFRAME_SRC') {
        for (const frame of document.querySelectorAll('iframe')) {
          if (frame.closest('[data-proctor]')) continue;
          const src = frame.getAttribute('src') || '';
          const prefixes = Array.isArray(fp.prefixes) ? fp.prefixes : [fp.matcher];
          if (!prefixes.some(prefix => src.startsWith(prefix) || src.includes(fp.matcher))) continue;
          matches.push({
            code: 'KNOWN_FINGERPRINT', severity, weight, t: Date.now(),
            key: `${tool}:node:${getNodeIdentity(frame)}`,
            meta: { tool, name: String(fp.name || tool).slice(0, 80), type: 'IFRAME_SRC', allowed: Boolean(fp.allowed) },
          });
          break;
        }
      } else if (fp.matcherType === 'GLOBAL_VAR' && window[fp.matcher] !== undefined) {
        matches.push({
          code: 'KNOWN_FINGERPRINT', severity, weight, t: Date.now(), key: `${tool}:global`,
          meta: { tool, name: String(fp.name || tool).slice(0, 80), type: 'GLOBAL_VAR', allowed: Boolean(fp.allowed) },
        });
      }
    } catch (error) {
      console.warn(`[Detector] Invalid fingerprint "${fp.name || fp.tool || 'unknown'}":`, error);
    }
  }
  return matches;
}
