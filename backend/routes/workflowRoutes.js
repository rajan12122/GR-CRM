const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflowController');
const { authenticateToken } = require('../middleware/auth');

router.post('/leads', authenticateToken, workflowController.onboardLead);
router.post('/queries', authenticateToken, workflowController.createQuery);
router.post('/pitches', authenticateToken, workflowController.recordPitch);
router.post('/deals/close', authenticateToken, workflowController.closeDeal);
router.get('/properties/:id/interest', authenticateToken, workflowController.getPropertyInterest);

module.exports = router;
