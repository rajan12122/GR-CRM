const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticateToken } = require('../middleware/auth');

router.post('/log', authenticateToken, locationController.logLocation);
router.get('/path/:employeeId', authenticateToken, locationController.getEmployeePath);
router.get('/active', authenticateToken, locationController.getActiveLocations);

module.exports = router;
