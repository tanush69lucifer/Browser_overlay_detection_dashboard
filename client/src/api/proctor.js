import api from './client';

export const getExamSessions = (examId, params = {}) => api.get(`/exams/${examId}/sessions`, { params });
export const getSession = (sessionId) => api.get(`/sessions/${sessionId}`);
export const getSessionFlags = (sessionId) => api.get(`/sessions/${sessionId}/flags`);
export const getSessionSignals = (sessionId) => api.get(`/sessions/${sessionId}/signals`);
export const getExamSignals = (examId) => api.get(`/exams/${examId}/signals`);
export const reviewFlag = (flagId, payload) => api.patch(`/flags/${flagId}`, payload);
export const getExamReport = (examId) => api.get(`/exams/${examId}/report`);
export const downloadExamReport = (examId) =>
  api.get(`/exams/${examId}/report`, { params: { format: 'csv' }, responseType: 'blob' });
