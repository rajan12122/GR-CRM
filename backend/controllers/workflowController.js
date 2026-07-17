const { readDb, writeDb } = require('../config/db');
const { syncToSheets } = require('../services/sheetsService');
const { notifyUser } = require('../utils/notificationHelper');
const workflow = require('../services/crmWorkflowService');

function onboardLead(req, res) {
  try {
    const db = readDb();
    const lead = { ...req.body };
    if (!lead.id) lead.id = `LEAD-${String((db.leads || []).length + 1).padStart(3, '0')}`;
    
    workflow.prepareLead(db, lead, req.user);
    db.leads.push(lead);
    writeDb(db);
    
    // Sync affected modules to Google Sheets
    ['leads', 'customers', 'properties', 'property_listing_cycles', 'property_inspections', 'property_history', 'tasks'].forEach(m => {
      try { syncToSheets(m); } catch (e) {}
    });

    if (lead.assignedEmployeeId) {
      notifyUser(lead.assignedEmployeeId, 'lead-assigned', {
        leadId: lead.id,
        message: `New ${lead.leadType || 'Buyer'} Lead ${lead.id} has been assigned to you.`
      });
    }

    return res.status(201).json({ lead, customerId: lead.customerId || null });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

function createQuery(req, res) {
  try {
    const db = readDb();
    const query = { ...req.body, id: req.body.id || `QRY-${String((db.queries || []).length + 1).padStart(3, '0')}` };
    
    workflow.prepareQuery(db, query, req.user);
    db.queries.push(query);
    writeDb(db);
    
    ['queries', 'properties', 'property_listing_cycles', 'follow_ups', 'property_history'].forEach(m => {
      try { syncToSheets(m); } catch (e) {}
    });

    if (query.assignedEmployeeId) {
      notifyUser(query.assignedEmployeeId, 'query-assigned', {
        queryId: query.id,
        message: `New Buy/Sell Query ${query.id} has been assigned to you.`
      });
    }

    return res.status(201).json({ query });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

function recordPitch(req, res) {
  try {
    const db = readDb();
    const pitch = { ...req.body, id: req.body.id || `PITCH-${String((db.property_pitch_history || []).length + 1).padStart(3, '0')}` };
    
    workflow.recordPitch(db, pitch, req.user);
    db.property_pitch_history.push(pitch);
    writeDb(db);
    
    syncToSheets('property_pitch_history');
    return res.status(201).json(pitch);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

function closeDeal(req, res) {
  try {
    const db = readDb();
    const result = workflow.closeDeal(db, req.body, req.user, req);
    writeDb(db);
    
    ['deals', 'properties', 'customers', 'property_listing_cycles', 'property_history', 'property_ownership_history', 'audit_logs'].forEach(m => {
      try { syncToSheets(m); } catch (e) {}
    });
    
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

function getPropertyInterest(req, res) {
  try {
    const db = readDb();
    const propertyId = req.params.id;
    const pitches = (db.property_pitch_history || []).filter(p => String(p.propertyId) === String(propertyId) && !p.deletedAt);
    const visits = (db.site_visits || []).filter(v => String(v.propertyId) === String(propertyId) && !v.deletedAt);
    
    return res.json({
      propertyId,
      pitchCount: pitches.length,
      pitches,
      visits,
      filters: { feedbackCategories: workflow.FEEDBACK_CATEGORIES }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  onboardLead,
  createQuery,
  recordPitch,
  closeDeal,
  getPropertyInterest
};
