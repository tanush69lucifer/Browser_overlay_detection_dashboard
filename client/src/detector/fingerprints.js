<<<<<<< HEAD
import { DEFAULT_FINGERPRINTS } from './config.js';

function normalize(fp) {
  if (!fp || fp.isActive === false || fp.active === false) return null;
  // Accept the documented server shape (matcher) and the local config shape
  // (selectors/prefixes). Keep custom active fingerprints alongside defaults.
  const matcherType = fp.matcherType || (fp.selectors ? 'SELECTOR' : fp.prefixes ? 'IFRAME_SRC' : '');
  const matcher = fp.matcher || (Array.isArray(fp.selectors) ? fp.selectors.join(', ') : '') || fp.prefixes?.[0] || '';
  if (!matcherType || !matcher) return null;
  return { ...fp, matcherType, matcher };
}

/** Return compact metadata only; never serialize matched page content. */
export function scanFingerprints(fingerprints = []) {
  const list = [...DEFAULT_FINGERPRINTS, ...(Array.isArray(fingerprints) ? fingerprints : [])]
    .map(normalize)
    .filter(Boolean);
=======
import { getNodeIdentity } from './scanners';

/**
 * Matches the active exam fingerprint set against the live document.
 * @param {Array} fingerprints - Fingerprints selected for the exam
 * @returns {Array} List of matched signals
 */
export function scanFingerprints(fingerprints = []) {
  const list = fingerprints;
>>>>>>> origin/main
  const matches = [];

  for (const fp of list) {
    try {
<<<<<<< HEAD
      let found = false;
      if (fp.matcherType === 'SELECTOR') {
        found = [...document.querySelectorAll(fp.matcher)].some(node => !node.closest('[data-proctor]'));
      } else if (fp.matcherType === 'IFRAME_SRC') {
        found = [...document.querySelectorAll('iframe')].some(frame => {
          if (frame.closest('[data-proctor]')) return false;
          const src = frame.getAttribute('src') || '';
          return src.startsWith('chrome-extension://') || src.startsWith('moz-extension://') || src.includes(fp.matcher);
        });
      } else if (fp.matcherType === 'GLOBAL_VAR') {
        found = typeof window !== 'undefined' && window[fp.matcher] !== undefined;
      }
      if (!found) continue;

      const tool = String(fp.tool || fp.name || 'UNKNOWN_TOOL').slice(0, 64);
      const allowed = Boolean(fp.allowed);
      matches.push({
        code: 'KNOWN_FINGERPRINT',
        severity: allowed ? 'LOW' : (fp.severity || 'HIGH'),
        weight: allowed ? 1 : (Number(fp.weight) || 10),
        t: Date.now(),
        key: tool,
        meta: { tool, name: String(fp.name || tool).slice(0, 80), type: fp.matcherType, allowed },
      });
    } catch {
      // Invalid or unsupported selectors are ignored without breaking scans.
=======
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
>>>>>>> origin/main
    }
  }
  return matches;
}
