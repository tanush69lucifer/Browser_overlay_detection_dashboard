const { randomUUID } = require('crypto');
const { DEFAULT_WEIGHTS, DEFAULT_SEVERITY } = require('../scoring/weights');

function toProctorSignal(signal, sessionId, candidate) {
  if (!signal || !Object.prototype.hasOwnProperty.call(DEFAULT_WEIGHTS, signal.code)) return null;

  const meta = {};
  if (signal.meta && typeof signal.meta === 'object' && !Array.isArray(signal.meta)) {
    for (const [key, value] of Object.entries(signal.meta).slice(0, 10)) {
      if (typeof value === 'string') {
        const maxLength = signal.code === 'BROWSER_TAB_SWITCH' && key === 'url' ? 200 : 120;
        meta[key.slice(0, 40)] = value.slice(0, maxLength);
      }
      else if (typeof value === 'number' && Number.isFinite(value)) meta[key.slice(0, 40)] = value;
      else if (typeof value === 'boolean') meta[key.slice(0, 40)] = value;
    }
  }

  const time = Number(signal.t);
  return {
    id: randomUUID(),
    sessionId: String(sessionId),
    candidate: { id: String(candidate.id), name: candidate.name || 'Candidate' },
    code: signal.code,
    severity: signal.severity || DEFAULT_SEVERITY[signal.code],
    t: Number.isFinite(time) ? time : Date.now(),
    meta,
  };
}

module.exports = toProctorSignal;
