const mongoose = require('mongoose');

const MATCHER_TYPES = ['SELECTOR', 'IFRAME_SRC', 'GLOBAL_VAR'];
const SEVERITIES = ['LOW', 'MED', 'HIGH'];

const fingerprintSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
<<<<<<< HEAD
    tool: { type: String, required: true, trim: true, maxlength: 100, index: true },
    matcherType: { type: String, enum: MATCHER_TYPES, required: true },
    matcher: { type: String, required: true, trim: true, maxlength: 500 },
    weight: { type: Number, required: true, default: 10, min: 1 },
    severity: { type: String, enum: SEVERITIES, required: true, default: 'HIGH' },
    description: { type: String, default: '', maxlength: 500 },
    isActive: { type: Boolean, default: true, index: true },
=======
    tool: { type: String, required: true, trim: true, maxlength: 100 },
    matcherType: { type: String, enum: MATCHER_TYPES, required: true },
    matcher: { type: String, required: true, trim: true },
    weight: { type: Number, min: 1, default: 10 },
    severity: { type: String, enum: SEVERITIES, default: 'HIGH' },
    description: { type: String, default: '', maxlength: 500 },
    isActive: { type: Boolean, default: true },
>>>>>>> origin/main
    allowed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

<<<<<<< HEAD
fingerprintSchema.index({ isActive: 1, tool: 1 });
=======
fingerprintSchema.index({ tool: 1 }, { unique: true });
fingerprintSchema.index({ isActive: 1 });
>>>>>>> origin/main

module.exports = mongoose.model('Fingerprint', fingerprintSchema);
module.exports.MATCHER_TYPES = MATCHER_TYPES;
module.exports.SEVERITIES = SEVERITIES;
