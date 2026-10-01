const Exam = require('../models/Exam');
const ApiError = require('./ApiError');

// Loads an exam for proctor/admin use. Proctors must be assigned to it.
async function loadExamForStaff(examId, user) {
  if (!['PROCTOR', 'ADMIN'].includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this resource');
  }
  const exam = await Exam.findById(examId).lean();
  if (!exam) throw new ApiError(404, 'NOT_FOUND', 'Exam not found');
  if (user.role === 'PROCTOR' && !exam.proctorIds.some((id) => String(id) === user.id)) {
    throw new ApiError(403, 'FORBIDDEN', 'You are not a proctor for this exam');
  }
  return exam;
}

module.exports = { loadExamForStaff };
