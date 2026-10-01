import api from './client';

export const getExams = (params = {}) => api.get('/exams', { params });
export const getExam = (examId) => api.get(`/exams/${examId}`);
export const startSession = (examId, payload = {}) => api.post(`/exams/${examId}/sessions`, payload);
export const endSession = (sessionId, answers = {}) => api.post(`/sessions/${sessionId}/end`, { answers });
export const getActiveFingerprints = () => api.get('/fingerprints/active');
