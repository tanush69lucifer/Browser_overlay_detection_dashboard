import api from './client';

export const getUsers = (params = {}) => api.get('/users', { params });
export const createExam = (payload) => api.post('/exams', payload);
export const updateExam = (examId, payload) => api.patch(`/exams/${examId}`, payload);
export const getFingerprints = () => api.get('/admin/fingerprints');
export const createFingerprint = (payload) => api.post('/admin/fingerprints', payload);
export const updateFingerprint = (fingerprintId, payload) => api.patch(`/admin/fingerprints/${fingerprintId}`, payload);
