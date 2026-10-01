const mongoose = require('mongoose');

const MATCHER_TYPES = ['SELECTOR', 'IFRAME_SRC', 'GLOBAL_VAR'];
const SEVERITIES = ['LOW', 'MED', 'HIGH'];

const fingerprintSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    tool: { type: String, required: true, trim: true, maxlength: 100 },
    matcherType: {
      type: String,
      enum: MATCHER_TYPES,
      required: true,
    },
    matcher: { type: String, required: true, trim: true },
    weight: { type: Number, default: 10, min: 1 },
    severity: {
      type: String,
      enum: SEVERITIES,
      default: 'HIGH',
    },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    allowed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

fingerprintSchema.index({ tool: 1 });
fingerprintSchema.index({ isActive: 1 });

module.exports = mongoose.model('Fingerprint', fingerprintSchema);
module.exports.MATCHER_TYPES = MATCHER_TYPES;
module.exports.SEVERITIES = SEVERITIES;
