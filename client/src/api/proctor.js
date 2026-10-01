import apiClient from './client';

/**
 * Proctor API service layer
 * Provides endpoints for assigned exams, candidate sessions, live flags, verdicts, and reports.
 */

// Retrieve all exams assigned to the logged-in proctor
export const getMyExams = async () => {
  const response = await apiClient.get('/exams');
  return response.data;
};

// Retrieve single exam metadata
export const getExam = async (examId) => {
  const response = await apiClient.get(`/exams/${examId}`);
  return response.data;
};

// Retrieve candidate sessions for an exam with limit (default 500)
export const getExamSessions = async (examId, { limit = 500 } = {}) => {
  const response = await apiClient.get(`/exams/${examId}/sessions`, {
    params: { limit },
  });
  return response.data;
};

// Retrieve specific candidate session details
export const getSession = async (sessionId) => {
  const response = await apiClient.get(`/sessions/${sessionId}`);
  return response.data;
};

// Retrieve flag timeline for a candidate session
export const getSessionFlags = async (sessionId) => {
  const response = await apiClient.get(`/sessions/${sessionId}/flags`);
  return response.data;
};

// Update flag with proctor note, verdict ('SUSPICIOUS' | 'CLEARED'), or reviewed state
export const updateFlag = async (flagId, updates) => {
  const response = await apiClient.patch(`/flags/${flagId}`, updates);
  return response.data;
};

// Retrieve comprehensive exam integrity report
export const getReport = async (examId) => {
  const response = await apiClient.get(`/exams/${examId}/report`);
  return response.data;
};

// Download exam integrity report as CSV blob
export const downloadReportCsv = async (examId) => {
  const response = await apiClient.get(`/exams/${examId}/report/csv`, {
    responseType: 'blob',
  });
  return response.data;
};

export default {
  getMyExams,
  getExam,
  getExamSessions,
  getSession,
  getSessionFlags,
  updateFlag,
  getReport,
  downloadReportCsv,
};
