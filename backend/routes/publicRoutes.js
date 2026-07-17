const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { readDb, writeDb, readMetadata } = require('../config/db');
const { syncToSheets } = require('../services/sheetsService');
const hooks = require('../services/businessHooksService');

// Metadata file path helper
const metadataPath = path.join(__dirname, '../config/metadata.json');

// Memory rate limit cache
const ipRequests = {};
function ipRateLimiter(windowMs, maxRequests) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    if (!ipRequests[ip]) {
      ipRequests[ip] = [];
    }
    ipRequests[ip] = ipRequests[ip].filter(time => now - time < windowMs);
    if (ipRequests[ip].length >= maxRequests) {
      return res.status(429).json({ success: false, message: 'Too many requests from this network. Please try again in 15 minutes.' });
    }
    ipRequests[ip].push(now);
    next();
  };
}

router.get('/update-check', (req, res) => {
  try {
    const configPath = path.join(__dirname, '../config/update-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return res.json(config);
    }
    res.status(404).json({ error: "Update configuration not found." });
  } catch (err) {
    res.status(500).json({ error: "Failed to load update configuration." });
  }
});

router.get('/metadata', (req, res) => {
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const publicMetadata = {
      modules: metadata.modules,
      chips: metadata.chips
    };
    res.json(publicMetadata);
  } catch (err) {
    res.status(500).json({ error: "Failed to load metadata" });
  }
});

router.get('/lookup/:module', (req, res) => {
  try {
    const { module } = req.params;
    const db = readDb();
    if (!db[module] || !Array.isArray(db[module])) {
      return res.json([]);
    }
    const lookupList = db[module]
      .filter(rec => !rec.deletedAt)
      .map(rec => ({
        id: rec.id,
        name: rec.name || rec.contact_person_name || rec.contactName || rec.title || rec.id
      }));
    res.json(lookupList);
  } catch (err) {
    res.status(500).json({ error: "Failed to load lookup list." });
  }
});

router.post('/lead-intake', ipRateLimiter(15 * 60 * 1000, 10), (req, res) => {
  const { website_url, name, phone, locality, sector, propertyType, optionType, size, plc, budget, queryType = 'Buy Property' } = req.body;
  
  if (website_url) {
    console.warn(`[Anti-Spam] Honeypot triggered from IP: ${req.ip}`);
    return res.status(200).json({ success: true, message: "Welcome back! Your new requirements query has been registered." });
  }

  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ message: 'Name must be at least 2 characters long.' });
  }

  const cleanPhone = String(phone || '').trim();
  if (!cleanPhone || cleanPhone.length !== 10 || isNaN(Number(cleanPhone))) {
    return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
  }

  const spamPattern = /<[^>]*>|http|https|www\./i;
  if (spamPattern.test(name) || spamPattern.test(locality) || spamPattern.test(sector)) {
    console.warn(`[Anti-Spam] Suspicious content blocked from IP: ${req.ip}`);
    return res.status(400).json({ message: 'Invalid characters or links detected in submission.' });
  }

  const db = readDb();
  if (!db.leads) db.leads = [];
  
  const existingCust = (db.customers || []).find(c => c.phone && String(c.phone).trim() === cleanPhone && !c.deletedAt);
  const existingLead = (db.leads || []).find(l => l.phone && String(l.phone).trim() === cleanPhone && !l.deletedAt);
  
  if (existingCust || existingLead) {
    const matchedId = existingCust ? existingCust.id : existingLead.id;
    const queryId = `QRY-${String((db.queries || []).length + 1).padStart(3, '0')}`;
    const newQuery = {
      id: queryId,
      uuid: crypto.randomUUID(),
      customerId: matchedId,
      assignedEmployeeId: existingCust ? (existingCust.assignedEmployeeId || 'EMP-001') : (existingLead.assignedEmployeeId || 'EMP-001'),
      date: new Date().toLocaleDateString('en-IN'),
      status: 'Pending Approval',
      queryType: queryType,
      stage: 'New Query',
      budget: budget || '',
      demand: '',
      r_c_i: propertyType || '',
      propertyType: optionType || '',
      locality: locality || '',
      sector_block: sector || '',
      size: size || '',
      remarks: `Auto-created query from public requirement form (Duplicate check match). PLC preferred: ${plc || 'None'}`
    };
    
    if (!db.queries) db.queries = [];
    db.queries.push(newQuery);

    db.follow_ups = db.follow_ups || [];
    const followUpId = `FOLLOW-${String((db.follow_ups || []).length + 1).padStart(3, '0')}`;
    const newFollowUp = {
      id: followUpId,
      uuid: crypto.randomUUID(),
      customerId: matchedId,
      queryId: queryId,
      employeeId: existingCust ? (existingCust.assignedEmployeeId || 'EMP-001') : (existingLead.assignedEmployeeId || 'EMP-001'),
      date: new Date().toLocaleDateString('en-IN'),
      time: '12:00 PM',
      status: 'Pending Call',
      pipelineAction: 'Fresh Lead',
      remarks: `Auto-scheduled follow up for requirements form Query ${queryId}.`
    };
    db.follow_ups.push(newFollowUp);
    try { syncToSheets('follow_ups'); } catch(e) {}

    writeDb(db);
    try { syncToSheets('queries'); } catch(e) {}
    
    return res.json({ success: true, message: "Welcome back! Your new requirements query has been registered under your profile.", query: newQuery });
  }

  const existingIds = (db.leads || []).map(r => r.id).filter(id => id && String(id).startsWith('LEAD'));
  let maxNum = 0;
  existingIds.forEach(id => {
    const parts = id.split('-');
    const num = parseInt(parts[1]);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  });
  
  const nextNum = maxNum > 0 ? maxNum + 1 : (db.leads || []).length + 1;
  const leadId = `LEAD-${String(nextNum).padStart(3, '0')}`;
  
  const newLead = {
    id: leadId,
    uuid: crypto.randomUUID(),
    name,
    phone: cleanPhone,
    locality,
    sector_block: sector,
    propertyType: optionType,
    r_c_i: propertyType,
    size,
    budget,
    status: 'Open',
    leadType: queryType === 'Sell Property' ? 'Seller' : 'Buyer',
    assignedEmployeeId: 'EMP-001',
    dateAdded: new Date().toISOString().split('T')[0]
  };
  
  db.leads.push(newLead);
  try { syncToSheets('leads'); } catch(e) {}

  const queryId = `QRY-${String((db.queries || []).length + 1).padStart(3, '0')}`;
  const newQuery = {
    id: queryId,
    uuid: crypto.randomUUID(),
    customerId: leadId,
    assignedEmployeeId: 'EMP-001',
    date: new Date().toLocaleDateString('en-IN'),
    status: 'Pending Approval',
    queryType: queryType,
    stage: 'New Query',
    budget: budget || '',
    demand: '',
    r_c_i: propertyType || '',
    propertyType: optionType || '',
    locality: locality || '',
    sector_block: sector || '',
    size: size || '',
    remarks: `Auto-created query from public requirement form. PLC preferred: ${plc || 'None'}`
  };
  if (!db.queries) db.queries = [];
  db.queries.push(newQuery);
  try { syncToSheets('queries'); } catch(e) {}

  db.follow_ups = db.follow_ups || [];
  const followUpId = `FOLLOW-${String((db.follow_ups || []).length + 1).padStart(3, '0')}`;
  const newFollowUp = {
    id: followUpId,
    uuid: crypto.randomUUID(),
    customerId: leadId,
    queryId: queryId,
    employeeId: 'EMP-001',
    date: new Date().toLocaleDateString('en-IN'),
    time: '12:00 PM',
    status: 'Pending Call',
    pipelineAction: 'Fresh Lead',
    remarks: `Auto-scheduled follow up for requirement form Lead/Query ${queryId}.`
  };
  db.follow_ups.push(newFollowUp);
  try { syncToSheets('follow_ups'); } catch(e) {}

  writeDb(db);
  res.json({ success: true, lead: newLead, query: newQuery });
});

router.post('/quick-add', ipRateLimiter(15 * 60 * 1000, 10), (req, res) => {
  const { website_url, module, payload, key } = req.body;

  if (website_url) {
    return res.status(200).json({ success: true, message: "Record added successfully." });
  }

  if (key !== 'gagan_employee_intake_2026') {
    return res.status(403).json({ error: "Invalid access token." });
  }

  const allowedModules = ['leads', 'customers', 'properties', 'queries'];
  if (!allowedModules.includes(module)) {
    return res.status(403).json({ error: "Access denied. Action not allowed on this module from the public intake portal." });
  }

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: "Invalid payload." });
  }

  delete payload.password;
  delete payload.passwordHash;
  delete payload.tokenVersion;

  if (payload.phone) {
    const cleanPhone = String(payload.phone).trim();
    if (cleanPhone.length > 0 && (cleanPhone.length !== 10 || isNaN(Number(cleanPhone)))) {
      return res.status(400).json({ error: "Phone number must be exactly 10 digits." });
    }
  }

  const db = readDb();
  if (!db[module]) db[module] = [];

  const prefixMap = {
    employees: 'EMP',
    customers: 'CUST',
    leads: 'LEAD',
    properties: 'PROP',
    projects: 'PROJ',
    site_visits: 'VISIT',
    follow_ups: 'FOLLOW',
    remarks: 'REM',
    tasks: 'TASK',
    sales: 'SALE',
    documents: 'DOC',
    attendance: 'ATT',
    daily_prices: 'PRICE',
    salaries: 'SAL',
    queries: 'QRY',
    deals: 'DEAL',
    property_pitch_history: 'PITCH',
    dealer_calls: 'CALL',
    dealer_meetings: 'MEET'
  };
  const prefix = prefixMap[module] || module.substring(0, 4).toUpperCase();
  
  const existingIds = (db[module] || []).map(r => r.id).filter(id => id && String(id).startsWith(prefix));
  let maxNum = 0;
  existingIds.forEach(id => {
    const parts = id.split('-');
    const num = parseInt(parts[1]);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  });
  
  const nextNum = maxNum > 0 ? maxNum + 1 : (db[module] || []).length + 1;
  payload.id = `${prefix}-${String(nextNum).padStart(3, '0')}`;
  payload.uuid = payload.uuid || crypto.randomUUID();
  
  if (payload.phone && (module === 'customers' || module === 'leads')) {
    const cleanPhone = String(payload.phone).trim();
    const existingCust = (db.customers || []).find(r => r.phone && String(r.phone).trim() === cleanPhone && !r.deletedAt);
    const existingLead = (db.leads || []).find(r => r.phone && String(r.phone).trim() === cleanPhone && !r.deletedAt);
    
    if (existingCust || existingLead) {
      const matchedId = existingCust ? existingCust.id : existingLead.id;
      const queryId = `QRY-${String((db.queries || []).length + 1).padStart(3, '0')}`;
      const queryType = payload.leadType === 'Seller' ? 'Sell Property' : 'Buy Property';
      
      const newQuery = {
        id: queryId,
        uuid: crypto.randomUUID(),
        customerId: matchedId,
        assignedEmployeeId: payload.assignedEmployeeId || (existingCust ? existingCust.assignedEmployeeId : existingLead.assignedEmployeeId) || 'EMP-001',
        date: new Date().toLocaleDateString('en-IN'),
        status: 'Pending Approval',
        queryType: queryType,
        stage: 'New Query',
        budget: payload.budget || '',
        demand: payload.demand || '',
        r_c_i: payload.r_c_i || '',
        propertyType: payload.propertyType || '',
        locality: payload.locality || '',
        sector_block: payload.sector_block || '',
        size: payload.size || '',
        remarks: payload.remarks || payload.initial_notes || 'Auto-created query due to duplicate lead/customer submission via Quick-Add portal.'
      };
      
      if (!db.queries) db.queries = [];
      db.queries.push(newQuery);

      db.follow_ups = db.follow_ups || [];
      const followUpId = `FOLLOW-${String((db.follow_ups || []).length + 1).padStart(3, '0')}`;
      const newFollowUp = {
        id: followUpId,
        uuid: crypto.randomUUID(),
        customerId: matchedId,
        queryId: queryId,
        employeeId: payload.assignedEmployeeId || (existingCust ? existingCust.assignedEmployeeId : existingLead.assignedEmployeeId) || 'EMP-001',
        date: new Date().toLocaleDateString('en-IN'),
        time: '12:00 PM',
        status: 'Pending Call',
        pipelineAction: 'Fresh Lead',
        remarks: `Auto-scheduled follow up for Quick-Add Query ${queryId}.`
      };
      db.follow_ups.push(newFollowUp);
      try { syncToSheets('follow_ups'); } catch(e) {}

      writeDb(db);
      try { syncToSheets('queries'); } catch(e) {}
      
      return res.json({
        success: true,
        message: `Customer already exists. Created Query (${queryId}) linked to customer profile instead.`,
        record: newQuery
      });
    }
  }

  if (module === 'leads' && !payload.dateAdded) {
    payload.dateAdded = new Date().toISOString().split('T')[0];
  }

  db[module].push(payload);
  if (module === 'follow_ups') {
    hooks.handleFollowUpPipelineAction(payload, db, req);
  } else if (module === 'queries') {
    hooks.handleQueryStageChange(payload, db, req);
  }
  writeDb(db);
  syncToSheets(module);
  
  res.json({ success: true, record: payload });
});

module.exports = router;
