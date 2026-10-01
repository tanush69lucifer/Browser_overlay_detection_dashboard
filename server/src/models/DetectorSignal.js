const mongoose = require('mongoose');

const detectorSignalSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true, trim: true, maxlength: 64 },
  severity: { type: String, enum: ['LOW', 'MED', 'HIGH'], required: true },
  occurredAt: { type: Date, required: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
}, { timestamps: true });

detectorSignalSchema.index({ examId: 1, occurredAt: -1 });
detectorSignalSchema.index({ sessionId: 1, occurredAt: -1 });

module.exports = mongoose.model('DetectorSignal', detectorSignalSchema);
