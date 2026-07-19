const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');
const { authenticateToken, checkPermission } = require('../middleware/auth');
const { readMetadata } = require('../config/db');

router.get('/metadata', authenticateToken, dataController.getMetadata);

router.get('/360/:module/:id', authenticateToken, dataController.getEntity360);

router.get('/data/:module', authenticateToken, (req, res, next) => {
  const { module } = req.params;
  const metadata = readMetadata();
  const db = require('../config/db').readDb();
  if (!metadata.modules[module] && !Array.isArray(db[module])) {
    return res.status(404).json({ message: `Module '${module}' does not exist.` });
  }
  next();
}, (req, res, next) => {
  const { module } = req.params;
  const metadata = readMetadata();
  if (!metadata.modules[module]) return next();
  checkPermission(module, 'view')(req, res, next);
}, dataController.listData);

router.get('/data/:module/:id', authenticateToken, dataController.getDataById);

router.post('/data/:module', authenticateToken, (req, res, next) => {
  const { module } = req.params;
  const metadata = readMetadata();
  if (!metadata.modules[module]) return next();
  checkPermission(module, 'create')(req, res, next);
}, dataController.createData);

router.put('/data/:module/:id', authenticateToken, (req, res, next) => {
  const { module } = req.params;
  const metadata = readMetadata();
  if (!metadata.modules[module]) return next();
  checkPermission(module, 'edit')(req, res, next);
}, dataController.updateData);

router.delete('/data/:module/:id', authenticateToken, (req, res, next) => {
  const { module } = req.params;
  const metadata = readMetadata();
  if (!metadata.modules[module]) return next();
  checkPermission(module, 'delete')(req, res, next);
}, dataController.deleteData);

router.get('/public/lookup/:module', dataController.getLookup);
router.get('/search', authenticateToken, dataController.searchAll);
router.get('/templates', authenticateToken, (req, res) => {
  const db = require('../config/db').readDb();
  const defaultTemplates = {
    whatsapp: "Hi [Client Name], based on your requirements, here is a matching listing: [Property Name] (Price: ₹[Price]). Let me know when you'd like to visit!",
    email_subject: "Matching Property Listing - Gagan Realtech",
    email_body: "Hi [Client Name],\n\nBased on your requirements, here is a property listing you might like:\n\nProperty Name: [Property Name]\nPrice: ₹[Price]\nLocality: [Locality]\nSector: [Sector]\n\nBest regards,\nGagan Realtech Team",
    sms: "Hi [Client Name], matching listing found: [Property Name] (Price: ₹[Price]) in [Locality]. Contact us!"
  };
  res.json(db.templates || defaultTemplates);
});

router.post('/templates', authenticateToken, (req, res) => {
  const db = require('../config/db').readDb();
  db.templates = req.body;
  require('../config/db').writeDb(db);
  res.json({ success: true, templates: db.templates });
});

module.exports = router;
