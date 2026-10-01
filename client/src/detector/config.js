export const SIGNAL_CODES = Object.freeze({
  FIXED_HIGH_Z_NODE: 'FIXED_HIGH_Z_NODE',
  KNOWN_FINGERPRINT: 'KNOWN_FINGERPRINT',
  FOREIGN_SHADOW_ROOT: 'FOREIGN_SHADOW_ROOT',
  EXTENSION_IFRAME: 'EXTENSION_IFRAME',
  DOM_NODE_DELTA: 'DOM_NODE_DELTA',
  WINDOW_BLUR: 'WINDOW_BLUR',
  TAB_HIDDEN: 'TAB_HIDDEN',
  TAB_VISIBLE: 'TAB_VISIBLE',
  PASTE_EVENT: 'PASTE_EVENT',
  FULLSCREEN_EXIT: 'FULLSCREEN_EXIT',
  DEVTOOLS_OPEN: 'DEVTOOLS_OPEN'
});

export const SEVERITIES = Object.freeze({ LOW: 'LOW', MED: 'MED', HIGH: 'HIGH' });
export const DETECTOR_CONFIG = Object.freeze({
  zIndexThreshold: 9999,
  minimumOverlayAreaPct: 5,
  devtoolsGapPx: 160,
  batchFlushMs: 2500,
  scanIntervalMs: 2000,
  heartbeatIntervalMs: 12000,
  maxSignalBuffer: 200,
  offlineFallbackMs: 10000,
  ackTimeoutMs: 5000
});
