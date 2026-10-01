const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const SEVERITIES = ['LOW', 'MED', 'HIGH'];
const VERDICTS = ['SUSPICIOUS', 'CLEARED'];

const flagSchema = new mongoose.Schema(
  {
    sessionId: { type: ObjectId, ref: 'Session', required: true, index: true },
    examId: { type: ObjectId, ref: 'Exam', required: true, index: true },
    candidateId: { type: ObjectId, ref: 'User', required: true },
    code: { type: String, required: true, trim: true },
    severity: { type: String, enum: SEVERITIES, required: true },
    score: { type: Number, required: true, min: 0 },
    evidence: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ signals: [] }),
    },
    raisedAt: { type: Date, default: Date.now },
    reviewed: { type: Boolean, default: false },
    reviewedBy: { type: ObjectId, ref: 'User', default: null },
    note: { type: String, default: '', maxlength: 1000 },
    verdict: {
      type: String,
      enum: VERDICTS,
      default: null,
    },
  },
  { timestamps: true }
);

flagSchema.index({ sessionId: 1, raisedAt: 1 });
flagSchema.index({ examId: 1, raisedAt: -1 });

module.exports = mongoose.model('Flag', flagSchema);
module.exports.SEVERITIES = SEVERITIES;
module.exports.VERDICTS = VERDICTS;
