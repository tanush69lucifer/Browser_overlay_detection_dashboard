const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const SENSITIVITIES = ['LOW', 'MEDIUM', 'HIGH'];

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  options: { type: [String], default: [] }, // empty = free-text answer
});

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 1000 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationMin: { type: Number, default: 60, min: 1 },
    sensitivity: { type: String, enum: SENSITIVITIES, default: 'MEDIUM' },
    candidateIds: [{ type: ObjectId, ref: 'User' }],
    proctorIds: [{ type: ObjectId, ref: 'User' }],
    fingerprintIds: [{ type: ObjectId, ref: 'Fingerprint' }],
    fingerprintSetId: { type: ObjectId, default: null },
    questions: { type: [questionSchema], default: [] },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

examSchema.index({ candidateIds: 1 });
examSchema.index({ proctorIds: 1 });
examSchema.index({ startAt: -1 });

module.exports = mongoose.model('Exam', examSchema);
module.exports.SENSITIVITIES = SENSITIVITIES;
