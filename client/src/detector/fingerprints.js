import { DEFAULT_FINGERPRINTS, SEVERITIES, SIGNAL_CODES } from './config.js';

function isExcluded(el) {
  try { return Boolean(el.closest('[data-proctor]')); } catch { return true; }
}

function normalized(definition) {
  if (!definition || typeof definition !== 'object') return null;
  const matcherType = String(definition.matcherType || '').toUpperCase();
  if (!['SELECTOR', 'IFRAME_SRC', 'GLOBAL_VAR'].includes(matcherType)) return null;
  return { ...definition, matcherType, tool: String(definition.tool || 'UNKNOWN').slice(0, 40) };
}

function matchesFingerprint(definition) {
  const matchers = definition.matcherType === 'SELECTOR'
    ? (definition.selectors || (definition.selector ? [definition.selector] : []))
    : definition.matcherType === 'IFRAME_SRC'
      ? (definition.prefixes || (definition.prefix ? [definition.prefix] : []))
      : (definition.variables || (definition.variable ? [definition.variable] : []));

  for (const matcherValue of matchers) {
    const matcher = String(matcherValue || '');
    if (!matcher) continue;
    if (definition.matcherType === 'SELECTOR') {
      try {
        for (const el of document.querySelectorAll(matcher)) {
          if (!isExcluded(el)) return { match: matcher, element: el };
        }
      } catch { /* Invalid server-provided selectors are ignored. */ }
    } else if (definition.matcherType === 'IFRAME_SRC') {
      for (const frame of document.querySelectorAll('iframe[src]')) {
        if (!isExcluded(frame) && (frame.getAttribute('src') || '').startsWith(matcher)) return { match: matcher, element: frame };
      }
    } else {
      try { if (matcher in window) return { match: matcher }; } catch { /* Ignore inaccessible globals. */ }
    }
  }
  return null;
}

export function createFingerprintChecker(serverFingerprints = []) {
  const definitions = [...DEFAULT_FINGERPRINTS, ...(Array.isArray(serverFingerprints) ? serverFingerprints : [])]
    .map(normalized).filter(Boolean);
  const active = new Map();

  return function checkFingerprints() {
    const signals = [];
    const seen = new Set();
    for (const definition of definitions) {
      const identity = `${definition.tool}:${definition.matcherType}:${definition.selectors?.join('|') || definition.prefixes?.join('|') || definition.variables?.join('|') || definition.selector || definition.prefix || definition.variable || ''}`;
      const result = matchesFingerprint(definition);
      if (result) {
        seen.add(identity);
        if (!active.has(identity)) {
          signals.push({ code: SIGNAL_CODES.KNOWN_FINGERPRINT, severity: SEVERITIES.HIGH, key: definition.tool, t: Date.now(), meta: { tool: definition.tool, matcherType: definition.matcherType, match: result.match.slice(0, 120) } });
        }
        active.set(identity, true);
      } else active.delete(identity);
    }
    for (const identity of [...active.keys()]) if (!seen.has(identity)) active.delete(identity);
    return signals;
  };
}
