import api from './client';

export const getUsers = (params = {}) => api.get('/users', { params });
export const createCandidate = (payload) => api.post('/auth/register', { ...payload, role: 'CANDIDATE' });
export const createProctor = (payload) => api.post('/auth/register', { ...payload, role: 'PROCTOR' });
export const createExam = (payload) => api.post('/exams', payload);
export const updateExam = (examId, payload) => api.patch(`/exams/${examId}`, payload);
export const getFingerprints = (params = {}) => api.get('/admin/fingerprints', { params });
export const createFingerprint = (payload) => api.post('/admin/fingerprints', payload);
export const updateFingerprint = (fingerprintId, payload) => api.patch(`/admin/fingerprints/${fingerprintId}`, payload);
export const getThresholds = () => api.get('/admin/thresholds');
export const updateThreshold = (sensitivity, payload) => api.patch(`/admin/thresholds/${sensitivity}`, payload);
