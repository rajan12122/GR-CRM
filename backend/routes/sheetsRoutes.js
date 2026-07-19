const express = require('express');
const router = express.Router();
const sheetsController = require('../controllers/sheetsController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

router.get('/dashboard/metrics', authenticateToken, sheetsController.getSyncMetrics);
router.get('/dashboard/jobs', authenticateToken, sheetsController.getSyncJobs);
router.post('/dashboard/retry/:jobId', authenticateToken, sheetsController.retrySyncJob);
router.post('/dashboard/reconcile-preview/:module', authenticateToken, (req, res, next) => {
  checkPermission('settings', 'edit')(req, res, next);
}, sheetsController.reconcilePreview);
router.post('/dashboard/reconcile-confirm/:module', authenticateToken, (req, res, next) => {
  checkPermission('settings', 'edit')(req, res, next);
}, sheetsController.reconcileConfirm);

router.post('/test-sheets', authenticateToken, sheetsController.testSheetsConnection);
router.post('/sync-now', authenticateToken, sheetsController.triggerFullSync);
router.post('/manual/push', authenticateToken, (req, res, next) => {
  checkPermission('settings', 'edit')(req, res, next);
}, sheetsController.manualPush);
router.post('/manual/pull', authenticateToken, (req, res, next) => {
  checkPermission('settings', 'edit')(req, res, next);
}, sheetsController.manualPull);

module.exports = router;
