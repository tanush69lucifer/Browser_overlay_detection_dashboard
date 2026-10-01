const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const SESSION_STATUS = ['ONLINE', 'OFFLINE', 'ENDED'];
const SEVERITIES = ['NONE', 'LOW', 'MED', 'HIGH'];

const sessionSchema = new mongoose.Schema(
  {
    examId: { type: ObjectId, ref: 'Exam', required: true },
    candidateId: { type: ObjectId, ref: 'User', required: true },
    status: { type: String, enum: SESSION_STATUS, default: 'ONLINE' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    lastHeartbeat: { type: Date, default: Date.now },
    // Denormalised for fast grid rendering (updated by the flag writer)
    flagCount: { type: Number, default: 0 },
    maxSeverity: { type: String, enum: SEVERITIES, default: 'NONE' },
    userAgent: { type: String, default: '', maxlength: 300 },
    screen: { w: Number, h: Number },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// One attempt per candidate per exam; reopening the tab resumes the same session.
sessionSchema.index({ examId: 1, candidateId: 1 }, { unique: true });
sessionSchema.index({ examId: 1, status: 1 });

module.exports = mongoose.model('Session', sessionSchema);
module.exports.SESSION_STATUS = SESSION_STATUS;
module.exports.SEVERITIES = SEVERITIES;
