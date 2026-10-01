// Signal codes, weights, severities and default thresholds per SPEC section 7.

const DEFAULT_WEIGHTS = {
  KNOWN_FINGERPRINT: 10,
  EXTENSION_IFRAME: 8,
  FIXED_HIGH_Z_NODE: 5,
  FOREIGN_SHADOW_ROOT: 4,
  DOM_NODE_DELTA: 2,
  WINDOW_BLUR: 1,
  TAB_HIDDEN: 2,
  LARGE_PASTE: 2,
  DEVTOOLS_OPEN: 2,
};

const DEFAULT_SEVERITY = {
  KNOWN_FINGERPRINT: 'HIGH',
  EXTENSION_IFRAME: 'HIGH',
  FIXED_HIGH_Z_NODE: 'MED',
  FOREIGN_SHADOW_ROOT: 'MED',
  DOM_NODE_DELTA: 'LOW',
  WINDOW_BLUR: 'LOW',
  TAB_HIDDEN: 'LOW',
  LARGE_PASTE: 'LOW',
  DEVTOOLS_OPEN: 'LOW',
};

const DEFAULT_THRESHOLDS = {
  LOW: { windowMs: 60000, flagScore: 15 },
  MEDIUM: { windowMs: 60000, flagScore: 8 },
  HIGH: { windowMs: 60000, flagScore: 4 },
};

const SEVERITY_RANK = {
  NONE: 0,
  LOW: 1,
  MED: 2,
  HIGH: 3,
};

module.exports = {
  DEFAULT_WEIGHTS,
  DEFAULT_SEVERITY,
  DEFAULT_THRESHOLDS,
  SEVERITY_RANK,
};
