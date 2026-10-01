const mongoose = require('mongoose');

const MATCHER_TYPES = ['SELECTOR', 'IFRAME_SRC', 'GLOBAL_VAR', 'EXTENSION_RESOURCE'];
const SEVERITIES = ['LOW', 'MED', 'HIGH'];

const fingerprintSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  tool: { type: String, required: true, trim: true, maxlength: 100, index: true },
  matcherType: { type: String, enum: MATCHER_TYPES, required: true },
  matcher: { type: String, required: true, trim: true, maxlength: 500 },
  resourcePath: { type: String, trim: true, maxlength: 200, default: '' },
  weight: { type: Number, required: true, default: 10, min: 1 },
  severity: { type: String, enum: SEVERITIES, required: true, default: 'HIGH' },
  description: { type: String, default: '', maxlength: 500 },
  isActive: { type: Boolean, default: true, index: true },
  allowed: { type: Boolean, default: false },
}, { timestamps: true });

fingerprintSchema.index({ isActive: 1, tool: 1 });

module.exports = mongoose.model('Fingerprint', fingerprintSchema);
module.exports.MATCHER_TYPES = MATCHER_TYPES;
module.exports.SEVERITIES = SEVERITIES;
