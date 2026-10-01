import { getNodeIdentity } from './scanners';

/**
 * Matches the active exam fingerprint set against the live document.
 * @param {Array} fingerprints - Fingerprints selected for the exam
 * @returns {Array} List of matched signals
 */
export function scanFingerprints(fingerprints = []) {
  const list = fingerprints;
  const matches = [];

  for (const fp of list) {
    if (fp.isActive === false) continue;

    try {
      if (fp.matcherType === 'SELECTOR' && fp.matcher) {
        const found = document.querySelectorAll(fp.matcher);
        for (const element of found) {
          if (element.closest('[data-proctor]')) continue;
          matches.push({
            code: 'KNOWN_FINGERPRINT',
            severity: fp.allowed ? 'LOW' : (fp.severity || 'HIGH'),
            weight: fp.allowed ? 1 : (fp.weight || 10),
            t: Date.now(),
            key: `${fp.tool || 'UNKNOWN_TOOL'}:node:${getNodeIdentity(element)}`,
            meta: {
              tool: fp.tool,
              name: fp.name,
              type: 'SELECTOR',
              allowed: Boolean(fp.allowed),
            },
          });
        }
      } else if (fp.matcherType === 'IFRAME_SRC' && fp.matcher) {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          if (iframe.closest('[data-proctor]')) continue;
          const src = iframe.src || '';
          if (src.includes(fp.matcher)) {
            matches.push({
              code: 'KNOWN_FINGERPRINT',
              severity: fp.allowed ? 'LOW' : (fp.severity || 'HIGH'),
              weight: fp.allowed ? 1 : (fp.weight || 10),
              t: Date.now(),
              key: `${fp.tool || 'IFRAME_TOOL'}:node:${getNodeIdentity(iframe)}`,
              meta: {
                tool: fp.tool,
                name: fp.name,
                type: 'IFRAME_SRC',
              },
            });
            break;
          }
        }
      } else if (fp.matcherType === 'GLOBAL_VAR' && fp.matcher) {
        if (typeof window !== 'undefined' && window[fp.matcher] !== undefined) {
          matches.push({
            code: 'KNOWN_FINGERPRINT',
            severity: fp.allowed ? 'LOW' : (fp.severity || 'HIGH'),
            weight: fp.allowed ? 1 : (fp.weight || 10),
            t: Date.now(),
            key: `${fp.tool || fp.matcher}:global`,
            meta: {
              tool: fp.tool,
              name: fp.name,
              type: 'GLOBAL_VAR',
            },
          });
        }
      }
    } catch (error) {
      console.warn(`[Detector] Invalid fingerprint "${fp.name || fp.tool || 'unknown'}":`, error);
    }
  }

  return matches;
}
