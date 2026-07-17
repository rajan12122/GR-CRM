const express = require('express');
const router = express.Router();
const sheetsController = require('../controllers/sheetsController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

router.get('/sync/dashboard/metrics', authenticateToken, sheetsController.getSyncMetrics);
router.get('/sync/dashboard/jobs', authenticateToken, sheetsController.getSyncJobs);
router.post('/sync/dashboard/retry/:jobId', authenticateToken, sheetsController.retrySyncJob);
router.post('/sync/dashboard/reconcile-preview/:module', authenticateToken, (req, res, next) => {
  checkPermission('settings', 'edit')(req, res, next);
}, sheetsController.reconcilePreview);
router.post('/sync/dashboard/reconcile-confirm/:module', authenticateToken, (req, res, next) => {
  checkPermission('settings', 'edit')(req, res, next);
}, sheetsController.reconcileConfirm);

module.exports = router;
