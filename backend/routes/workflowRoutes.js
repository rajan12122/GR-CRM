const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflowController');
const { authenticateToken } = require('../middleware/auth');

const { readDb, writeDb } = require('../config/db');

router.post('/leads', authenticateToken, workflowController.onboardLead);
router.post('/queries', authenticateToken, workflowController.createQuery);
router.post('/pitches', authenticateToken, workflowController.recordPitch);
router.post('/deals/close', authenticateToken, workflowController.closeDeal);
router.get('/properties/:id/interest', authenticateToken, workflowController.getPropertyInterest);

router.get('/leads/pending', authenticateToken, (req, res) => {
  const db = readDb();
  const userId = req.user ? req.user.id : null;
  const pendingLeads = (db.leads || []).filter(l => 
    (!userId || String(l.assignedEmployeeId) === String(userId)) && 
    (l.status === 'New' || l.status === 'Open' || l.status === 'Pending Intake')
  );
  res.json(pendingLeads);
});

router.post('/leads/:id/accept', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const lead = (db.leads || []).find(l => String(l.id) === String(id));
  if (lead) {
    lead.status = 'In-Progress';
    writeDb(db);
    return res.json({ success: true, lead });
  }
  res.status(404).json({ message: 'Lead not found' });
});

router.post('/leads/:id/drop', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const lead = (db.leads || []).find(l => String(l.id) === String(id));
  if (lead) {
    lead.status = 'Dropped';
    writeDb(db);
    return res.json({ success: true, lead });
  }
  res.status(404).json({ message: 'Lead not found' });
});

module.exports = router;
