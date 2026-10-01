// Integrity routes mounted at /api/v1
// Owner: Sohil. Flags, fingerprints, thresholds, report, and HTTP signal fallback.

const router = require('express').Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const validate = require('../middlewares/validate');

const {
  idParamSchema,
  sensitivityParamSchema,
  patchFlagSchema,
  signalsBatchSchema,
  createFingerprintSchema,
  updateFingerprintSchema,
  updateThresholdSchema,
  reportQuerySchema,
  paginationQuerySchema,
} = require('../validators/integrity.validators');

const flagsController = require('../controllers/flags.controller');
const fingerprintsController = require('../controllers/fingerprints.controller');
const reportController = require('../controllers/report.controller');

// Flags
router.get(
  '/sessions/:id/flags',
  requireAuth,
  requireRole('PROCTOR'),
  validate(idParamSchema, 'params'),
  flagsController.getSessionFlags
);

router.patch(
  '/flags/:id',
  requireAuth,
  requireRole('PROCTOR'),
  validate(idParamSchema, 'params'),
  validate(patchFlagSchema, 'body'),
  flagsController.patchFlag
);

// HTTP signal fallback
router.post(
  '/sessions/:id/signals',
  requireAuth,
  requireRole('CANDIDATE'),
  validate(idParamSchema, 'params'),
  validate(signalsBatchSchema, 'body'),
  flagsController.postSignals
);

// Fingerprints
router.get(
  '/fingerprints/active',
  requireAuth,
  fingerprintsController.getActiveFingerprints
);

router.get(
  '/admin/fingerprints',
  requireAuth,
  requireRole('ADMIN'),
  validate(paginationQuerySchema, 'query'),
  fingerprintsController.listFingerprints
);

router.post(
  '/admin/fingerprints',
  requireAuth,
  requireRole('ADMIN'),
  validate(createFingerprintSchema, 'body'),
  fingerprintsController.createFingerprint
);

router.patch(
  '/admin/fingerprints/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateFingerprintSchema, 'body'),
  fingerprintsController.updateFingerprint
);

// Thresholds
router.get(
  '/admin/thresholds',
  requireAuth,
  requireRole('ADMIN'),
  fingerprintsController.listThresholds
);

router.patch(
  '/admin/thresholds/:sensitivity',
  requireAuth,
  requireRole('ADMIN'),
  validate(sensitivityParamSchema, 'params'),
  validate(updateThresholdSchema, 'body'),
  fingerprintsController.updateThreshold
);

// Exam integrity report
router.get(
  '/exams/:id/report',
  requireAuth,
  requireRole('PROCTOR', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(reportQuerySchema, 'query'),
  reportController.getExamReport
);

module.exports = router;
