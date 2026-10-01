const mongoose = require('mongoose');

const SENSITIVITIES = ['LOW', 'MEDIUM', 'HIGH'];

const thresholdSchema = new mongoose.Schema(
  {
    sensitivity: {
      type: String,
      enum: SENSITIVITIES,
      required: true,
      unique: true,
    },
    windowMs: {
      type: Number,
      required: true,
      default: 60000,
      min: 1000,
    },
    flagScore: {
      type: Number,
      required: true,
      default: 8,
      min: 1,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Threshold', thresholdSchema);
module.exports.SENSITIVITIES = SENSITIVITIES;
