const crypto = require('crypto');
const { readDb, writeDb, readMetadata, writeMetadata } = require('../config/db');
const repository = require('../repositories/dataRepository');
const hooks = require('../services/businessHooksService');
const { syncToSheets } = require('../services/sheetsService');
const { notifyUser } = require('../utils/notificationHelper');
const workflow = require('../services/crmWorkflowService');

function getMetadata(req, res) {
  const metadata = readMetadata();
  const { role } = req.user;

  if (role !== 'Admin' && metadata.fieldPermissions && metadata.fieldPermissions[role]) {
    const rolePermissions = metadata.fieldPermissions[role];
    const filteredModules = {};
    
    Object.keys(metadata.modules).forEach(modName => {
      const mod = metadata.modules[modName];
      const allowedFields = rolePermissions[modName];
      if (allowedFields) {
        const filteredFields = mod.fields.filter(f => allowedFields.includes(f.name) || f.name === 'id');
        filteredModules[modName] = { ...mod, fields: filteredFields };
      } else {
        filteredModules[modName] = mod;
      }
    });

    return res.json({
      ...metadata,
      modules: filteredModules
    });
  }

  res.json(metadata);
}

function listData(req, res) {
  const { module } = req.params;
  const { role } = req.user;
  const db = readDb();
  
  let records = db[module] || [];
  
  // Filter soft-deleted records
  records = records.filter(r => !r.deletedAt);

  if (role !== 'Admin') {
    if (module === 'leads') {
      const myFollowUpCustomerIds = (db.follow_ups || [])
        .filter(f => String(f.employeeId) === String(req.user.id) && !f.deletedAt)
        .map(f => String(f.customerId));
      const mySiteVisitCustomerIds = (db.site_visits || [])
        .filter(sv => String(sv.employeeId) === String(req.user.id) && !sv.deletedAt)
        .map(sv => String(sv.customerId));
      const myPitchCustomerIds = (db.property_pitch_history || [])
        .filter(p => String(p.employeeId) === String(req.user.id) && !p.deletedAt)
        .map(p => String(p.customerId));
      
      records = records.filter(r => 
        String(r.assignedEmployeeId) === String(req.user.id) ||
        myFollowUpCustomerIds.includes(String(r.id)) ||
        mySiteVisitCustomerIds.includes(String(r.id)) ||
        myPitchCustomerIds.includes(String(r.id))
      );
    } else if (module === 'follow_ups') {
      records = records.filter(r => String(r.employeeId) === String(req.user.id));
    } else if (module === 'queries') {
      const myFollowUpQueryIds = (db.follow_ups || [])
        .filter(f => String(f.employeeId) === String(req.user.id) && !f.deletedAt)
        .map(f => String(f.queryId));
      records = records.filter(r => 
        String(r.assignedEmployeeId) === String(req.user.id) ||
        myFollowUpQueryIds.includes(String(r.id))
      );
    } else if (module === 'property_pitch_history') {
      records = records.filter(r => String(r.employeeId) === String(req.user.id));
    } else if (module === 'site_visits') {
      records = records.filter(r => String(r.employeeId) === String(req.user.id));
    } else if (module === 'salaries') {
      records = records.filter(r => String(r.employeeId) === String(req.user.id));
    }
  }
  
  const metadata = readMetadata();
  if (role !== 'Admin' && metadata.fieldPermissions && metadata.fieldPermissions[role]) {
    const allowedFields = metadata.fieldPermissions[role][module];
    if (allowedFields) {
      const filteredRecords = records.map(record => {
        const filteredRecord = {};
        allowedFields.forEach(field => {
          if (record[field] !== undefined) {
            filteredRecord[field] = record[field];
          }
        });
        if (record.id) {
          filteredRecord.id = record.id;
        }
        if (record.uuid) {
          filteredRecord.uuid = record.uuid;
        }
        return filteredRecord;
      });
      return res.json(filteredRecords);
    }
  }

  res.json(records);
}

function getDataById(req, res) {
  const { module, id } = req.params;
  const record = repository.getById(module, id);
  if (!record || record.deletedAt) {
    return res.status(404).json({ message: `Record ${id} not found.` });
  }
  res.json(record);
}

async function createData(req, res) {
  const { module } = req.params;
  const db = readDb();
  const payload = req.body;

  if (module === 'employees') {
    delete payload.password;
    delete payload.passwordHash;
    delete payload.tokenVersion;
  }

  if (!payload.id) {
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
  }
  
  payload.uuid = payload.uuid || crypto.randomUUID();

  const metadata = readMetadata();
  const fields = metadata.modules[module].fields;
  fields.forEach(f => {
    if (f.name === 'dateAdded' && !payload[f.name]) {
      payload[f.name] = new Date().toISOString().split('T')[0];
    }
    if (f.name === 'last_updated') {
      payload[f.name] = new Date().toLocaleString('en-IN');
    }
    if (f.name === 'created_by' && !payload[f.name]) {
      payload[f.name] = req.user.name;
    }
    if (f.name === 'date' && !payload[f.name]) {
      payload[f.name] = new Date().toLocaleDateString('en-IN');
    }
    if (f.name === 'pipelineAction' && !payload[f.name] && module === 'follow_ups') {
      payload[f.name] = 'Fresh Lead';
    }
    if (f.name === 'stage' && !payload[f.name] && module === 'queries') {
      payload[f.name] = 'New Query';
    }
    if (f.name === 'status' && !payload[f.name] && module === 'property_pitch_history') {
      payload[f.name] = 'Pitched';
    }
    if (f.name === 'pitchDate' && !payload[f.name] && module === 'property_pitch_history') {
      payload[f.name] = new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN');
    }
    if (f.name === 'employeeName' && !payload[f.name] && (module === 'property_pitch_history' || module === 'dealer_calls')) {
      payload[f.name] = req.user.name;
    }
    if (f.name === 'employeeId' && !payload[f.name] && module === 'property_pitch_history') {
      payload[f.name] = req.user.id;
    }
    if (f.name === 'assignedEmployeeId' && !payload[f.name] && module === 'dealer_meetings') {
      payload[f.name] = req.user.id;
    }
  });

  if (payload.phone && (module === 'customers' || module === 'leads')) {
    const cleanPhone = String(payload.phone).trim();
    const existingCust = (db.customers || []).find(r => r.phone && String(r.phone).trim() === cleanPhone && !r.deletedAt);
    if (existingCust) {
      const queryId = `QRY-${String((db.queries || []).length + 1).padStart(3, '0')}`;
      const queryType = payload.leadType === 'Seller' ? 'Sell Property' : 'Buy Property';
      
      const newQuery = {
        id: queryId,
        uuid: crypto.randomUUID(),
        customerId: existingCust.id,
        assignedEmployeeId: payload.assignedEmployeeId || existingCust.assignedEmployeeId || 'EMP-001',
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
        remarks: payload.remarks || payload.initial_notes || 'Auto-created query due to duplicate lead/customer submission.'
      };
      
      if (!db.queries) db.queries = [];
      db.queries.push(newQuery);

      if (newQuery.queryType !== 'Sell Property') {
        db.follow_ups = db.follow_ups || [];
        const followUpId = `FOLLOW-${String((db.follow_ups || []).length + 1).padStart(3, '0')}`;
        const newFollowUp = {
          id: followUpId,
          uuid: crypto.randomUUID(),
          customerId: existingCust.id,
          queryId: queryId,
          employeeId: payload.assignedEmployeeId || existingCust.assignedEmployeeId || 'EMP-001',
          date: new Date().toLocaleDateString('en-IN'),
          time: '12:00 PM',
          status: 'Pending Call',
          pipelineAction: 'Fresh Lead',
          remarks: `Auto-scheduled follow up for auto-created duplicate check Query ${queryId}.`
        };
        db.follow_ups.push(newFollowUp);
        try { syncToSheets('follow_ups'); } catch(e) {}
      }
      
      const log = {
        id: `LOG-${Date.now()}`,
        employeeName: req.user.name,
        action: `Detected duplicate phone ${cleanPhone}. Created Query ${queryId} for existing customer ${existingCust.id}`,
        dateTime: new Date().toLocaleString()
      };
      if (!db.activity_logs) db.activity_logs = [];
      db.activity_logs.unshift(log);
      
      writeDb(db);
      try { syncToSheets('queries'); } catch(e) {}
      
      return res.status(201).json({
        __is_redirected_query: true,
        message: `Customer already exists. Created Query (${queryId}) linked to customer ${existingCust.name} (${existingCust.id}) instead.`,
        data: newQuery
      });
    }
  }

  if (payload.phone) {
    const cleanPhone = String(payload.phone).trim();
    const isDuplicate = (db[module] || []).some(r => r.phone && String(r.phone).trim() === cleanPhone && !r.deletedAt);
    if (isDuplicate) {
      return res.status(400).json({ message: `Phone number '${payload.phone}' is already registered in this module.` });
    }
  }

  if (module === 'dealers' && payload.contact_num) {
    const cleanContact = String(payload.contact_num).trim();
    const existingDealer = (db.dealers || []).find(r => r.contact_num && String(r.contact_num).trim() === cleanContact && !r.deletedAt);
    if (existingDealer) {
      return res.status(201).json(existingDealer);
    }
  }

  if (module === 'leads') {
    try { workflow.prepareLead(db, payload, req.user); } catch (error) { return res.status(400).json({ message: error.message }); }
    payload.assignmentStatus = 'accepted';
    payload.assignmentTime = null;
    payload.droppedBy = [];
    if (payload.assignedEmployeeId) {
      setTimeout(() => {
        notifyUser(payload.assignedEmployeeId, 'new-lead', { leadId: payload.id, leadName: payload.name || payload.person_name || 'New Lead' });
      }, 500);
    }
  }
  if (module === 'queries') {
    try { workflow.prepareQuery(db, payload, req.user); } catch (error) { return res.status(400).json({ message: error.message }); }
  }

  if (!db[module]) db[module] = [];
  db[module].push(payload);

  if (module === 'queries' && !payload.uuid) {
    hooks.handleQueryStageChange(payload, db, req);
    if (module === 'queries' && payload.queryType !== 'Sell Property') {
      db.follow_ups = db.follow_ups || [];
      const followUpId = `FOLLOW-${String((db.follow_ups || []).length + 1).padStart(3, '0')}`;
      const newFollowUp = {
        id: followUpId,
        uuid: crypto.randomUUID(),
        customerId: payload.customerId,
        queryId: payload.id,
        employeeId: payload.assignedEmployeeId || 'EMP-001',
        date: new Date().toLocaleDateString('en-IN'),
        time: '12:00 PM',
        status: 'Pending Call',
        pipelineAction: 'Fresh Lead',
        remarks: `Auto-scheduled follow up for new Query ${payload.id}: ${payload.remarks || 'No notes'}`
      };
      db.follow_ups.push(newFollowUp);
      try { syncToSheets('follow_ups'); } catch(e) {}
    }
  }
  if (module === 'deals' && payload.status === 'Closed') {
    return res.status(400).json({ message: 'Use POST /api/workflows/deals/close to close a deal and transfer ownership.' });
  }
  if (module === 'property_pitch_history') {
    try { workflow.recordPitch(db, payload, req.user); } catch (error) { db[module].pop(); return res.status(400).json({ message: error.message }); }
  }
  if (module === 'leads') {
    if (payload.assignedEmployeeId) {
      hooks.syncAssignedEmployeeUniversally('leads', payload.id, payload.assignedEmployeeId, db);
    }
  }
  if (module === 'customers' && payload.assignedEmployeeId) {
    hooks.syncAssignedEmployeeUniversally('customers', payload.id, payload.assignedEmployeeId, db);
  }
  if (module === 'follow_ups' && payload.employeeId) {
    hooks.syncAssignedEmployeeUniversally('follow_ups', payload.id, payload.employeeId, db);
  }
  if (module === 'follow_ups') hooks.handleFollowUpPipelineAction(payload, db, req);
  if (module === 'dealer_calls') hooks.handleDealerCallInsertion(payload, db);
  if (module === 'dealers') hooks.handleDealerVisitAssignment(payload, db, req);
  if ((module === 'leads' || module === 'follow_ups' || module === 'queries') && payload.pitchedPropertyId) {
    hooks.handleAutomatedPitchLogging(payload, db, req);
  }

  if (module === 'site_visits' && payload.employeeId) {
    notifyUser(payload.employeeId, 'visit-assigned', {
      visitId: payload.id,
      message: `New Site Visit ${payload.id} scheduled/assigned to you.`
    });
  }
  if (module === 'dealer_meetings' && payload.assignedEmployeeId) {
    notifyUser(payload.assignedEmployeeId, 'meeting-assigned', {
      meetingId: payload.id,
      message: `New Dealer Meeting ${payload.id} assigned to you.`
    });
  }
  if (module === 'queries' && payload.assignedEmployeeId && payload.status === 'Approved') {
    notifyUser(payload.assignedEmployeeId, 'query-approved', {
      queryId: payload.id,
      message: `Your Property Query ${payload.id} has been Approved.`
    });
  }
  if (module === 'documents') {
    notifyUser('EMP-001', 'pending-docs-alert', {
      docId: payload.id,
      message: `New document "${payload.name}" uploaded. Verification pending.`
    });
  }
  
  const log = {
    id: `LOG-${Date.now()}`,
    employeeName: req.user.name,
    action: `Created record ${payload.id} in ${module}`,
    dateTime: new Date().toLocaleString()
  };
  if (!db.activity_logs) db.activity_logs = [];
  db.activity_logs.unshift(log);

  writeDb(db);
  syncToSheets(module);
  res.status(201).json(payload);
}

async function updateData(req, res) {
  const { module, id } = req.params;
  const db = readDb();
  const payload = req.body;

  if (module === 'employees') {
    delete payload.password;
    delete payload.passwordHash;
    delete payload.tokenVersion;
  }

  const index = db[module].findIndex(rec => String(rec.id) === String(id));
  if (index === -1) return res.status(404).json({ message: `Record ${id} not found.` });
  const oldPayload = { ...db[module][index] };

  if (payload.phone) {
    const cleanPhone = String(payload.phone).trim();
    const isDuplicate = db[module].some(r => r.phone && String(r.phone).trim() === cleanPhone && String(r.id) !== String(id) && !r.deletedAt);
    if (isDuplicate) {
      return res.status(400).json({ message: `Phone number '${payload.phone}' is already registered in this module.` });
    }
  }

  const metadata = readMetadata();
  const fields = metadata.modules[module].fields;
  fields.forEach(f => {
    if (f.name === 'last_updated') {
      payload[f.name] = new Date().toLocaleString('en-IN');
    }
  });

  if (module === 'leads') {
    const oldLead = db[module][index];
    if (payload.assignedEmployeeId && payload.assignedEmployeeId !== oldLead.assignedEmployeeId) {
      payload.assignmentStatus = 'accepted';
      payload.assignmentTime = null;
      payload.droppedBy = [];
      setTimeout(() => {
        notifyUser(payload.assignedEmployeeId, 'new-lead', { leadId: id, leadName: payload.name || payload.person_name || 'New Lead' });
      }, 500);
    }
  }

  if (module === 'projects') {
    const oldProj = db.projects[index];
    const trackFields = ['pricing_details', 'plc_percent', 'status', 'configurations_sizes', 'total_land_area'];
    const historyEntries = [];
    
    trackFields.forEach(f => {
      const oldVal = oldProj[f];
      const newVal = payload[f];
      if (newVal !== undefined && String(oldVal || '').trim() !== String(newVal || '').trim()) {
        historyEntries.push({
          id: `PRJH-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          projectId: id,
          field: f,
          fieldName: metadata.modules.projects.fields.find(field => field.name === f)?.label || f,
          oldValue: oldVal || 'None',
          newValue: newVal || 'None',
          date: new Date().toLocaleDateString('en-IN'),
          employeeName: req.user.name
        });
      }
    });
    
    if (historyEntries.length > 0) {
      db.project_history = db.project_history || [];
      db.project_history.push(...historyEntries);
    }
  }

  if (module === 'properties') {
    const oldProp = db.properties[index];
    const trackFields = ['demand', 'status', 'locality', 'sector_block', 'size', 'propertyType'];
    const historyEntries = [];
    
    trackFields.forEach(f => {
      const oldVal = oldProp[f];
      const newVal = payload[f];
      if (newVal !== undefined && String(oldVal || '').trim() !== String(newVal || '').trim()) {
        historyEntries.push({
          id: `PROPH-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          propertyId: id,
          field: f,
          fieldName: metadata.modules.properties.fields.find(field => field.name === f)?.label || f,
          oldValue: oldVal || 'None',
          newValue: newVal || 'None',
          date: new Date().toLocaleDateString('en-IN'),
          employeeName: req.user.name
        });
      }
    });
    
    if (historyEntries.length > 0) {
      db.property_history = db.property_history || [];
      db.property_history.push(...historyEntries);
    }
  }

  db[module][index] = { ...db[module][index], ...payload, id };

  if (module === 'properties') {
    hooks.syncPropertyDetailsUniversally(id, db);
    try { syncToSheets('leads'); } catch(e) {}
    try { syncToSheets('customers'); } catch(e) {}
    try { syncToSheets('queries'); } catch(e) {}
    try { syncToSheets('follow_ups'); } catch(e) {}
  }

  if (module === 'site_visits') {
    const sv = db[module][index];
    if (sv && sv.linkedFollowUpId) {
      const fup = (db.follow_ups || []).find(f => f.id === sv.linkedFollowUpId);
      if (fup && fup.date !== sv.date) {
        fup.date = sv.date;
        try { syncToSheets('follow_ups'); } catch(e) {}
      }
    }
  }

  if (module === 'queries') hooks.handleQueryStageChange(db[module][index], db, req);
  if (module === 'deals') hooks.handleDealStatusChange(db[module][index], db, req);
  if (module === 'property_pitch_history') hooks.handlePitchStatusChange(db[module][index], db, req);
  if (module === 'leads') {
    hooks.handleLeadStatusChange(db[module][index], db, req);
    if (db[module][index].assignmentStatus === 'accepted') {
      hooks.createFollowUpForLead(db[module][index], db);
    }
    if (db[module][index].assignedEmployeeId) {
      hooks.syncAssignedEmployeeUniversally('leads', id, db[module][index].assignedEmployeeId, db);
    }
  }
  if (module === 'customers' && db[module][index].assignedEmployeeId) {
    hooks.syncAssignedEmployeeUniversally('customers', id, db[module][index].assignedEmployeeId, db);
  }
  if (module === 'follow_ups' && db[module][index].employeeId) {
    hooks.syncAssignedEmployeeUniversally('follow_ups', id, db[module][index].employeeId, db);
  }
  if (module === 'follow_ups') hooks.handleFollowUpPipelineAction(db[module][index], db, req);
  if (module === 'dealer_calls') hooks.handleDealerCallInsertion(db[module][index], db);
  if (module === 'dealers') hooks.handleDealerVisitAssignment(db[module][index], db, req, oldPayload);
  if ((module === 'leads' || module === 'follow_ups' || module === 'queries') && db[module][index].pitchedPropertyId) {
    hooks.handleAutomatedPitchLogging(db[module][index], db, req);
  }

  const updatedRec = db[module][index];
  if (module === 'site_visits' && updatedRec.employeeId) {
    notifyUser(updatedRec.employeeId, 'visit-assigned', {
      visitId: updatedRec.id,
      message: `Site Visit ${updatedRec.id} has been updated/assigned to you.`
    });
  }
  if (module === 'dealer_meetings' && updatedRec.assignedEmployeeId) {
    notifyUser(updatedRec.assignedEmployeeId, 'meeting-assigned', {
      meetingId: updatedRec.id,
      message: `Dealer Meeting ${updatedRec.id} has been updated/assigned to you.`
    });
  }
  if (module === 'queries' && updatedRec.assignedEmployeeId && updatedRec.status === 'Approved') {
    notifyUser(updatedRec.assignedEmployeeId, 'query-approved', {
      queryId: updatedRec.id,
      message: `Your Property Query ${updatedRec.id} has been Approved.`
    });
  } else if (module === 'properties') {
    hooks.syncPropertyDetailsUniversally(id, db);
  }

  const log = {
    id: `LOG-${Date.now()}`,
    employeeName: req.user.name,
    action: `Updated record ${id} in ${module}`,
    dateTime: new Date().toLocaleString()
  };
  if (!db.activity_logs) db.activity_logs = [];
  db.activity_logs.unshift(log);

  writeDb(db);
  try { syncToSheets(module); } catch(e) { console.error(`Sheets sync error on update ${module}:`, e); }
  res.json(db[module][index]);
}

function deleteData(req, res) {
  try {
    const { module, id } = req.params;
    const db = readDb();

    if (!db[module]) return res.status(404).json({ message: `Module ${module} is empty.` });

    const index = db[module].findIndex(rec => String(rec.id) === String(id) || String(rec.uuid) === String(id));
    if (index === -1) return res.status(404).json({ message: `Record ${id} not found.` });

    const record = db[module][index];
    record.deletedAt = new Date().toISOString();
    record.deletedBy = req.user.id;
    record.deletionReason = req.body?.reason || 'Archived through CRM delete action';
    
    hooks.log(db, req.user, `Archived record ${id} in ${module}`, { module, id, deletionReason: record.deletionReason });
    workflow.audit(db, req.user, 'status', 'Active', 'Archived', `Soft delete record ${id} in module ${module}`, req);
    
    writeDb(db);
    try { syncToSheets(module); } catch(e) { console.error(`Sheets sync error on delete ${module}:`, e); }
    try { syncToSheets('audit_logs'); } catch(e) {}
    
    return res.json({ success: true, message: `Record ${id} archived successfully.`, data: record });
  } catch (err) {
    console.error(`Error deleting record from ${req.params.module}:`, err);
    return res.status(500).json({ message: 'Internal server error during deletion.' });
  }
}

function bulkDeleteData(req, res) {
  try {
    const { module } = req.params;
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No record IDs provided for bulk deletion.' });
    }

    const db = readDb();
    if (!db[module]) return res.status(404).json({ message: `Module ${module} is empty.` });

    let deletedCount = 0;
    const idSet = new Set(ids.map(String));

    db[module].forEach(record => {
      if (idSet.has(String(record.id)) || idSet.has(String(record.uuid))) {
        if (!record.deletedAt) {
          record.deletedAt = new Date().toISOString();
          record.deletedBy = req.user.id;
          record.deletionReason = 'Archived through CRM bulk delete action';
          deletedCount++;
        }
      }
    });

    if (deletedCount > 0) {
      hooks.log(db, req.user, `Bulk archived ${deletedCount} records in ${module}`, { module, count: deletedCount });
      writeDb(db);
      try { syncToSheets(module); } catch(e) {}
    }

    return res.json({ success: true, message: `Successfully archived ${deletedCount} records.`, count: deletedCount });
  } catch (err) {
    console.error(`Error bulk deleting records from ${req.params.module}:`, err);
    return res.status(500).json({ message: 'Internal server error during bulk deletion.' });
  }
}

function getLookup(req, res) {
  try {
    const { module } = req.params;
    const db = readDb();
    if (!db[module]) return res.json([]);
    
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
}

function searchAll(req, res) {
  const { q } = req.query;
  if (!q || q.trim() === '') {
    return res.json({ results: {}, connections: {} });
  }

  const query = q.toLowerCase().trim();
  const keywords = query.split(/\s+/).filter(word => word.length > 0);
  const db = readDb();
  const metadata = readMetadata();
  const results = {};

  Object.keys(metadata.modules).forEach(moduleName => {
    const userRole = req.user.role;
    const permissions = metadata.rolesPermissions[userRole] || {};
    const modulePerms = permissions[moduleName] || [];
    if (userRole !== 'Admin' && !modulePerms.includes('view')) {
      return;
    }

    const records = db[moduleName] || [];
    const matchedRecords = records.filter(rec => {
      if (rec.deletedAt) return false;
      return keywords.every(word => {
        return Object.keys(rec).some(key => {
          if (userRole !== 'Admin' && metadata.fieldPermissions && metadata.fieldPermissions[userRole]) {
            const allowed = metadata.fieldPermissions[userRole][moduleName];
            if (allowed && !allowed.includes(key)) return false;
          }
          const val = rec[key];
          if (val === undefined || val === null) return false;
          return String(val).toLowerCase().includes(word);
        });
      });
    });

    if (matchedRecords.length > 0) {
      let filtered = matchedRecords;
      if (userRole !== 'Admin' && metadata.fieldPermissions && metadata.fieldPermissions[userRole]) {
        const allowed = metadata.fieldPermissions[userRole][moduleName];
        if (allowed) {
          filtered = matchedRecords.map(rec => {
            const resRec = {};
            allowed.forEach(f => {
              if (rec[f] !== undefined) resRec[f] = rec[f];
            });
            if (rec.id) resRec.id = rec.id;
            return resRec;
          });
        }
      }
      results[moduleName] = filtered;
    }
  });

  const matchedCustomerIds = new Set();
  const matchedPropertyIds = new Set();
  const matchedDealIds = new Set();
  const matchedDealerIds = new Set();

  if (results.customers) {
    results.customers.forEach(c => matchedCustomerIds.add(c.id));
  }
  if (results.leads) {
    results.leads.forEach(l => {
      if (l.phone) {
        const cleanP = String(l.phone).trim();
        const cust = (db.customers || []).find(c => c.phone && String(c.phone).trim() === cleanP && !c.deletedAt);
        if (cust) matchedCustomerIds.add(cust.id);
      }
    });
  }
  if (results.properties) {
    results.properties.forEach(p => matchedPropertyIds.add(p.id));
  }
  if (results.deals) {
    results.deals.forEach(d => matchedDealIds.add(d.id));
  }
  if (results.sales) {
    results.sales.forEach(s => matchedDealIds.add(s.id));
  }
  if (results.dealers) {
    results.dealers.forEach(d => matchedDealerIds.add(d.id));
  }

  if (matchedCustomerIds.size > 0) {
    results.queries = results.queries || [];
    (db.queries || []).forEach(q => {
      if (matchedCustomerIds.has(q.customerId) && !results.queries.some(r => r.id === q.id) && !q.deletedAt) {
        results.queries.push(q);
      }
    });

    results.deals = results.deals || [];
    (db.deals || []).forEach(d => {
      if ((matchedCustomerIds.has(d.customerId) || matchedCustomerIds.has(d.sellerCustomerId)) && !results.deals.some(r => r.id === d.id) && !d.deletedAt) {
        results.deals.push(d);
      }
    });

    results.site_visits = results.site_visits || [];
    (db.site_visits || []).forEach(v => {
      if (matchedCustomerIds.has(v.customerId) && !results.site_visits.some(r => r.id === v.id) && !v.deletedAt) {
        results.site_visits.push(v);
      }
    });

    results.properties = results.properties || [];
    (db.properties || []).forEach(p => {
      if (matchedCustomerIds.has(p.current_owner_id) && !results.properties.some(r => r.id === p.id) && !p.deletedAt) {
        results.properties.push(p);
      }
    });
  }

  if (matchedPropertyIds.size > 0) {
    results.deals = results.deals || [];
    (db.deals || []).forEach(d => {
      if (matchedPropertyIds.has(d.propertyId) && !results.deals.some(r => r.id === d.id) && !d.deletedAt) {
        results.deals.push(d);
      }
    });

    results.site_visits = results.site_visits || [];
    (db.site_visits || []).forEach(v => {
      if (matchedPropertyIds.has(v.propertyId) && !results.site_visits.some(r => r.id === v.id) && !v.deletedAt) {
        results.site_visits.push(v);
      }
    });

    results.customers = results.customers || [];
    (db.properties || []).forEach(p => {
      if (matchedPropertyIds.has(p.id) && p.current_owner_id && !p.deletedAt) {
        const owner = (db.customers || []).find(c => String(c.id) === String(p.current_owner_id));
        if (owner && !results.customers.some(r => r.id === owner.id)) {
          results.customers.push(owner);
        }
      }
    });
  }

  Object.keys(results).forEach(k => {
    if (results[k].length === 0) {
      delete results[k];
    }
  });

  const connections = {};
  
  const allEmployees = db.employees || [];
  const allCustomers = db.customers || [];
  const allProperties = db.properties || [];
  const allSiteVisits = db.site_visits || [];
  const allFollowUps = db.follow_ups || [];
  const allAttendance = db.attendance || [];
  const allTasks = db.tasks || [];
  const allSales = db.sales || [];
  const allLeaves = db.leaves || [];
  const allRemarks = db.remarks || [];
  const allDocs = db.documents || [];

  const getConnectedData = (type, id) => {
    const data = {};
    if (type === 'employees') {
      data.attendance = allAttendance.filter(a => a.employeeId === id);
      data.leaves = allLeaves.filter(l => l.employeeId === id);
      data.customers = allCustomers.filter(c => c.assignedEmployeeId === id && !c.deletedAt);
      data.properties = allProperties.filter(p => p.assignedEmployeeId === id && !p.deletedAt);
      data.tasks = allTasks.filter(t => t.assignedTo === id && !t.deletedAt);
      data.remarks = allRemarks.filter(r => r.targetModule === 'employees' && r.targetId === id);
      data.documents = allDocs.filter(d => d.targetModule === 'employees' && d.targetId === id && !d.deletedAt);
    } else if (type === 'customers') {
      const cust = allCustomers.find(c => String(c.id) === String(id) && !c.deletedAt);
      data.employee = allEmployees.find(e => String(e.id) === String(cust && cust.assignedEmployeeId));
      data.site_visits = allSiteVisits.filter(s => String(s.customerId) === String(id) && !s.deletedAt).map(sv => ({
        ...sv,
        property: allProperties.find(p => String(p.id) === String(sv.propertyId) && !p.deletedAt)
      }));
      data.follow_ups = allFollowUps.filter(f => String(f.customerId) === String(id) && !f.deletedAt);
      data.tasks = allTasks.filter(t => !t.deletedAt && (t.title.toLowerCase().includes(String(id).toLowerCase()) || (t.description && t.description.toLowerCase().includes(String(id).toLowerCase()))));
      data.sales = allSales.filter(s => String(s.customerId) === String(id) && !s.deletedAt).map(sa => ({
        ...sa,
        property: allProperties.find(p => String(p.id) === String(sa.propertyId) && !p.deletedAt)
      }));
      data.remarks = allRemarks.filter(r => r.targetModule === 'customers' && String(r.targetId) === String(id));
      data.documents = allDocs.filter(d => d.targetModule === 'customers' && String(d.targetId) === String(id) && !d.deletedAt);
    } else if (type === 'properties') {
      const prop = allProperties.find(p => String(p.id) === String(id) && !p.deletedAt);
      data.employee = allEmployees.find(e => String(e.id) === String(prop && prop.assignedEmployeeId));
      data.site_visits = allSiteVisits.filter(s => String(s.propertyId) === String(id) && !s.deletedAt).map(sv => ({
        ...sv,
        customer: allCustomers.find(c => String(c.id) === String(sv.customerId) && !c.deletedAt)
      }));
      data.sales = allSales.filter(s => String(s.propertyId) === String(id) && !s.deletedAt);
      data.remarks = allRemarks.filter(r => r.targetModule === 'properties' && String(r.targetId) === String(id));
      data.documents = allDocs.filter(d => d.targetModule === 'properties' && String(d.targetId) === String(id) && !d.deletedAt);
      data.viewsCount = data.site_visits.length;
      data.viewedBy = data.site_visits.map(v => v.customer).filter(Boolean);
    }
    return data;
  };

  const firstModule = Object.keys(results)[0];
  if (firstModule && ['employees', 'customers', 'properties'].includes(firstModule) && results[firstModule].length === 1) {
    const record = results[firstModule][0];
    connections[record.id] = getConnectedData(firstModule, record.id);
  }

  res.json({ results, connections });
}

function getEntity360(req, res) {
  const { module, id } = req.params;
  const db = readDb();
  
  const allEmployees = db.employees || [];
  const allCustomers = db.customers || [];
  const allProperties = db.properties || [];
  const allSiteVisits = db.site_visits || [];
  const allFollowUps = db.follow_ups || [];
  const allAttendance = db.attendance || [];
  const allTasks = db.tasks || [];
  const allSales = db.sales || [];
  const allLeaves = db.leaves || [];
  const allRemarks = db.remarks || [];
  const allDocs = db.documents || [];
  const allQueries = db.queries || [];
  const allDeals = db.deals || [];
  const allPitches = db.property_pitch_history || [];
  const allDealerCalls = db.dealer_calls || [];
  const allDealerMeetings = db.dealer_meetings || [];

  const data = {};
  data.timeline = hooks.generateDynamicTimeline(module, id, db);

  if (module === 'employees') {
    data.attendance = allAttendance.filter(a => String(a.employeeId) === String(id));
    data.leaves = allLeaves.filter(l => String(l.employeeId) === String(id));
    data.customers = allCustomers.filter(c => String(c.assignedEmployeeId) === String(id) && !c.deletedAt);
    data.properties = allProperties.filter(p => String(p.assignedEmployeeId) === String(id) && !p.deletedAt);
    data.tasks = allTasks.filter(t => String(t.assignedTo) === String(id) && !t.deletedAt);
    data.remarks = allRemarks.filter(r => r.targetModule === 'employees' && String(r.targetId) === String(id));
    data.documents = allDocs.filter(d => d.targetModule === 'employees' && String(d.targetId) === String(id) && !d.deletedAt);
    data.salaries = (db.salaries || []).filter(s => String(s.employeeId) === String(id));
    data.referrals = (db.leads || []).filter(l => l.referrer_type === 'employees' && String(l.referrer_id) === String(id) && !l.deletedAt);
  } else if (module === 'customers') {
    const cust = allCustomers.find(c => String(c.id) === String(id) && !c.deletedAt);
    data.employee = allEmployees.find(e => String(e.id) === String(cust && cust.assignedEmployeeId));
    data.site_visits = allSiteVisits.filter(s => String(s.customerId) === String(id) && !s.deletedAt).map(sv => ({
      ...sv,
      property: allProperties.find(p => String(p.id) === String(sv.propertyId) && !p.deletedAt)
    }));
    data.follow_ups = allFollowUps.filter(f => String(f.customerId) === String(id) && !f.deletedAt);
    data.sales = allSales.filter(s => String(s.customerId) === String(id) && !s.deletedAt).map(sa => ({
      ...sa,
      property: allProperties.find(p => String(p.id) === String(sa.propertyId) && !p.deletedAt)
    }));
    data.remarks = allRemarks.filter(r => r.targetModule === 'customers' && String(r.targetId) === String(id));
    data.documents = allDocs.filter(d => d.targetModule === 'customers' && String(d.targetId) === String(id) && !d.deletedAt);
    
    const cleanPhone = String(cust ? cust.phone : '').trim();
    const cleanEmail = String(cust ? cust.email : '').trim().toLowerCase();
    data.leads = (db.leads || []).filter(l => {
      if (l.deletedAt) return false;
      const p = String(l.phone).trim();
      const e = String(l.email || '').trim().toLowerCase();
      return p === cleanPhone || (cleanEmail && e === cleanEmail);
    });
    data.queries = allQueries.filter(q => String(q.customerId) === String(id) && !q.deletedAt);
    data.properties = allProperties.filter(p => String(p.current_owner_id) === String(id) && !p.deletedAt);
    data.propertiesOwned = data.properties;
    data.deals = allDeals.filter(d => (String(d.customerId) === String(id) || String(d.sellerCustomerId) === String(id)) && !d.deletedAt);
    data.purchaseHistory = allDeals.filter(d => String(d.customerId) === String(id) && d.status === 'Closed' && !d.deletedAt);
    data.saleHistory = allDeals.filter(d => String(d.sellerCustomerId) === String(id) && d.status === 'Closed' && !d.deletedAt);
    data.pitches = allPitches.filter(p => {
      if (String(p.customerId) !== String(id) || p.deletedAt) return false;
      const propExists = allProperties.some(pr => String(pr.id) === String(p.propertyId) && !pr.deletedAt);
      const projExists = (db.projects || []).some(pj => String(pj.id) === String(p.propertyId) && !pj.deletedAt);
      return propExists || projExists;
    });
    data.referrals = (db.leads || []).filter(l => l.referrer_type === 'customers' && String(l.referrer_id) === String(id) && !l.deletedAt);
    data.payments = [];
  } else if (module === 'properties') {
    const prop = allProperties.find(p => String(p.id) === String(id) && !p.deletedAt);
    data.employee = allEmployees.find(e => String(e.id) === String(prop && prop.assignedEmployeeId));
    data.site_visits = allSiteVisits.filter(s => String(s.propertyId) === String(id) && !s.deletedAt).map(sv => ({
      ...sv,
      customer: allCustomers.find(c => String(c.id) === String(sv.customerId) && !c.deletedAt)
    }));
    data.sales = allSales.filter(s => String(s.propertyId) === String(id) && !s.deletedAt);
    data.remarks = allRemarks.filter(r => r.targetModule === 'properties' && String(r.targetId) === String(id));
    data.documents = allDocs.filter(d => d.targetModule === 'properties' && String(d.targetId) === String(id) && !d.deletedAt);
    
    if (prop && prop.ownership_documents) {
      const oldOwnerDocs = (prop.ownership_documents.old_owner || []).map(d => ({ ...d, uploadedBy: 'System', dateAdded: prop.date, id: `DOC-OLD-${d.name}` }));
      const newOwnerDocs = (prop.ownership_documents.new_owner || []).map(d => ({ ...d, uploadedBy: 'System', dateAdded: prop.date, id: `DOC-NEW-${d.name}` }));
      data.documents = [...data.documents, ...oldOwnerDocs, ...newOwnerDocs];
    }
    
    data.viewsCount = data.site_visits.length;
    data.viewedBy = data.site_visits.map(v => v.customer).filter(Boolean);
    
    data.currentOwner = allCustomers.find(c => String(c.id) === String(prop && prop.current_owner_id) && !c.deletedAt);
    data.ownerHistory = prop ? [...(prop.owner_history || [])] : [];
    const closedDeals = allDeals.filter(d => String(d.propertyId) === String(id) && d.status === 'Closed' && !d.deletedAt);
    closedDeals.forEach(d => {
      const alreadyLogged = data.ownerHistory.some(h => 
        String(h.saleDate) === String(d.registrationDate)
      );
      if (!alreadyLogged) {
        const sellerCust = allCustomers.find(c => String(c.id) === String(d.sellerCustomerId) && !c.deletedAt);
        const sellerName = sellerCust ? sellerCust.name : (d.sellerCustomerId || prop.contact_person_name || 'Previous Owner');
        data.ownerHistory.push({
          ownerId: d.sellerCustomerId || 'N/A',
          ownerName: sellerName,
          purchaseDate: '',
          purchasePrice: '',
          saleDate: d.registrationDate || new Date().toISOString().split('T')[0],
          salePrice: d.salePrice || ''
        });
      }
    });
    data.deals = allDeals.filter(d => String(d.propertyId) === String(id) && !d.deletedAt);
    data.buyerHistory = data.deals.map(d => allCustomers.find(c => String(c.id) === String(d.customerId) && !c.deletedAt)).filter(Boolean);
    data.sellerHistory = data.deals.map(d => allCustomers.find(c => String(c.id) === String(d.sellerCustomerId) && !c.deletedAt)).filter(Boolean);
    data.pitches = allPitches.filter(p => String(p.propertyId) === String(id) && !p.deletedAt).map(p => ({
      ...p,
      customer: allCustomers.find(c => String(c.id) === String(p.customerId) && !c.deletedAt) || (db.leads || []).find(l => String(l.id) === String(p.customerId) && !l.deletedAt)
    }));
    data.history = (db.property_history || []).filter(h => String(h.propertyId) === String(id));
  } else if (module === 'dealers') {
    data.remarks = allRemarks.filter(r => r.targetModule === 'dealers' && String(r.targetId) === String(id));
    data.documents = allDocs.filter(d => d.targetModule === 'dealers' && String(d.targetId) === String(id) && !d.deletedAt);
    data.calls = allDealerCalls.filter(c => String(c.dealerId) === String(id) && !c.deletedAt);
    data.meetings = allDealerMeetings.filter(m => String(m.dealerId) === String(id) && !m.deletedAt).map(m => ({
      ...m,
      assignedEmployeeName: allEmployees.find(e => String(e.id) === String(m.assignedEmployeeId))?.name || m.assignedEmployeeId
    }));
    data.properties = allProperties.filter(p => String(p.dealerId) === String(id) && !p.deletedAt);
    data.referrals = (db.leads || []).filter(l => l.referrer_type === 'dealers' && String(l.referrer_id) === String(id) && !l.deletedAt);
  } else if (module === 'dealer_meetings') {
    const meeting = allDealerMeetings.find(m => String(m.id) === String(id) && !m.deletedAt);
    data.meeting = meeting;
    if (meeting) {
      const dealerId = meeting.dealerId;
      data.dealer = (db.dealers || []).find(d => String(d.id) === String(dealerId) && !d.deletedAt);
      data.calls = allDealerCalls.filter(c => String(c.dealerId) === String(dealerId) && !c.deletedAt);
      data.remarks = allRemarks.filter(r => (r.targetModule === 'dealers' && String(r.targetId) === String(dealerId)) || (r.targetModule === 'dealer_meetings' && String(r.targetId) === String(id)));
      data.documents = allDocs.filter(d => (d.targetModule === 'dealers' && String(d.targetId) === String(dealerId) || (d.targetModule === 'dealer_meetings' && String(d.targetId) === String(id))) && !d.deletedAt);
    }
  } else if (module === 'projects') {
    const proj = (db.projects || []).find(p => String(p.id) === String(id) && !p.deletedAt);
    data.project = proj;
    data.remarks = allRemarks.filter(r => r.targetModule === 'projects' && String(r.targetId) === String(id));
    data.documents = allDocs.filter(d => d.targetModule === 'projects' && String(d.targetId) === String(id) && !d.deletedAt);
    data.pitches = allPitches.filter(p => String(p.propertyId) === String(id) && !p.deletedAt).map(p => ({
      ...p,
      customer: allCustomers.find(c => String(c.id) === String(p.customerId) && !c.deletedAt) || (db.leads || []).find(l => String(l.id) === String(p.customerId) && !l.deletedAt)
    }));
    data.history = (db.project_history || []).filter(h => String(h.projectId) === String(id));
  } else {
    data.remarks = allRemarks.filter(r => r.targetModule === module && r.targetId === id);
    data.documents = allDocs.filter(d => d.targetModule === module && d.targetId === id && !d.deletedAt);
    
    if (module === 'follow_ups' || module === 'queries' || module === 'leads') {
      const rec = (db[module] || []).find(r => String(r.id) === String(id) && !r.deletedAt);
      if (rec) {
        const custId = rec.customerId || rec.id;
        data.pitches = allPitches.filter(p => {
          if (String(p.customerId) !== String(custId) || p.deletedAt) return false;
          const propExists = allProperties.some(pr => String(pr.id) === String(p.propertyId) && !pr.deletedAt);
          const projExists = (db.projects || []).some(pj => String(pj.id) === String(p.propertyId) && !pj.deletedAt);
          return propExists || projExists;
        }).map(p => ({
          ...p,
          property: allProperties.find(pr => String(pr.id) === String(p.propertyId) && !pr.deletedAt)
        }));
        data.site_visits = allSiteVisits.filter(sv => String(sv.customerId) === String(custId) && !sv.deletedAt).map(sv => ({
          ...sv,
          property: allProperties.find(pr => String(pr.id) === String(sv.propertyId) && !pr.deletedAt)
        }));
      }
    }
  }

  res.json(data);
}

module.exports = {
  getMetadata,
  listData,
  getDataById,
  createData,
  updateData,
  deleteData,
  bulkDeleteData,
  getLookup,
  searchAll,
  getEntity360
};
