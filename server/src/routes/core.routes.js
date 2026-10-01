// OWNER: Tanush. Auth, users, exams, sessions. Mounted at /api/v1.
const router = require('express').Router();
const { requireAuth, optionalAuth, requireRole } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/core.validators');
const auth = require('../controllers/auth.controller');
const users = require('../controllers/users.controller');
const exams = require('../controllers/exams.controller');
const sessions = require('../controllers/sessions.controller');

// Auth
router.post('/auth/register', optionalAuth, validate(v.registerSchema), auth.register);
router.post('/auth/login', validate(v.loginSchema), auth.login);
router.get('/auth/me', requireAuth, auth.me);
router.post('/auth/logout', requireAuth, auth.logout);

// Users
router.get('/users', requireAuth, requireRole('ADMIN'), validate(v.userListQuery, 'query'), users.listUsers);

// Exams
router.post('/exams', requireAuth, requireRole('ADMIN'), validate(v.createExamSchema), exams.createExam);
router.get('/exams', requireAuth, validate(v.listQuery, 'query'), exams.listExams);
router.get('/exams/:id', requireAuth, exams.getExam);
router.patch('/exams/:id', requireAuth, requireRole('ADMIN'), validate(v.updateExamSchema), exams.updateExam);

// Sessions
router.post('/exams/:id/sessions', requireAuth, requireRole('CANDIDATE'), validate(v.startSessionSchema), sessions.startSession);
router.get('/exams/:id/sessions', requireAuth, requireRole('PROCTOR'), validate(v.sessionListQuery, 'query'), sessions.listExamSessions);
router.post('/sessions/:id/end', requireAuth, requireRole('CANDIDATE'), validate(v.endSessionSchema), sessions.endSession);
router.get('/sessions/:id', requireAuth, requireRole('PROCTOR'), sessions.getSession);

module.exports = router;
