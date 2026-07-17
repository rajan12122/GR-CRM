const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/auth');

router.post('/customer-summary', authenticateToken, aiController.getCustomerSummary);
router.post('/lead-scoring', authenticateToken, aiController.getLeadScoring);
router.post('/property-recommendations', authenticateToken, aiController.getPropertyRecommendations);
router.post('/generate-content', authenticateToken, aiController.generateContent);
router.post('/daily-evening-summary', authenticateToken, aiController.getDailyBriefing);
router.post('/insights', authenticateToken, aiController.getInsights);
router.post('/chat', authenticateToken, aiController.copilotChat);

module.exports = router;
