const { readDb, writeDb, readMetadata } = require('../config/db');
const { syncToSheets } = require('./sheetsService');
const { notifyUser } = require('../utils/notificationHelper');

function updateGlobalReferences(db, oldId, newId) {
  Object.keys(db).forEach(mod => {
    if (!Array.isArray(db[mod])) return;
    db[mod].forEach(rec => {
      Object.keys(rec).forEach(key => {
        if (rec[key] === oldId) {
          rec[key] = newId;
        } else if (Array.isArray(rec[key])) {
          rec[key] = rec[key].map(item => {
            if (item && typeof item === 'object') {
              Object.keys(item).forEach(k => {
                if (item[k] === oldId) item[k] = newId;
              });
              return item;
            }
            return item === oldId ? newId : item;
          });
        } else if (typeof rec[key] === 'string') {
          if (rec[key].includes(oldId)) {
            rec[key] = rec[key].split(',').map(s => s.trim() === oldId ? newId : s.trim()).join(', ');
          }
        }
      });
    });
  });
}

function handleAutomatedPitchLogging(rec, db, req) {
  if (!rec.pitchedPropertyId) return;
  
  db.property_pitch_history = db.property_pitch_history || [];
  
  const custId = rec.customerId || rec.id;
  const cust = (db.customers || []).find(c => String(c.id) === String(custId)) || (db.leads || []).find(l => String(l.id) === String(custId));
  const custName = cust ? (cust.name || cust.person_name || 'Client') : 'Client';
  
  const exists = db.property_pitch_history.some(p => String(p.customerId) === String(custId) && String(p.propertyId) === String(rec.pitchedPropertyId));
  if (!exists) {
    const pitchId = `PITCH-${String(db.property_pitch_history.length + 1).padStart(3, '0')}`;
    const empName = req.user ? req.user.name : (rec.created_by || 'Sales Executive');
    const newPitch = {
      id: pitchId,
      customerId: custId,
      customerName: custName,
      propertyId: rec.pitchedPropertyId,
      employeeId: rec.assignedEmployeeId || (req.user ? req.user.id : 'EMP-001'),
      employeeName: empName,
      pitchMethod: 'Call',
      interestLevel: 'Interested',
      quotedPrice: Number(rec.pitchPrice || 0),
      remarks: rec.pitchRemarks || 'Automatically logged from lead/follow-up entry.',
      pitchDate: new Date().toLocaleDateString('en-IN')
    };
    db.property_pitch_history.push(newPitch);

    if (cust) {
      if (String(custId).startsWith('LEAD-')) {
        cust.status = 'In-Progress';
      } else {
        cust.stage = 'Interested';
      }
      writeDb(db);
      try {
        if (String(custId).startsWith('LEAD-')) syncToSheets('leads');
        else syncToSheets('customers');
      } catch(e) {}
    }

    const queries = (db.queries || []).filter(q => String(q.customerId) === String(custId) && q.status !== 'Approved');
    if (queries.length > 0) {
      queries.forEach(q => {
        q.stage = 'Property Matching';
      });
      writeDb(db);
      try { syncToSheets('queries'); } catch(e) {}
    }
    
    db.activity_logs = db.activity_logs || [];
    db.activity_logs.unshift({
      id: `LOG-${Date.now()}`,
      employeeName: empName,
      action: `Automatically logged pitch ${pitchId} for Property ${rec.pitchedPropertyId} matching Client ${custId}`,
      dateTime: new Date().toLocaleString()
    });
  }
}

function handleQueryStageChange(q, db, req) {
  if (!q.id) return;
  const isInventoryAdded = q.queryType === 'Sell Property' && (q.status === 'Approved' || q.stage === 'Inventory Added' || q.stage === 'Available For Sale');
  if (isInventoryAdded) {
    db.properties = db.properties || [];
    const propExists = db.properties.some(p => p.linkedQueryId === q.id);
    if (!propExists) {
      const propId = `PROP-${String(db.properties.length + 1).padStart(3, '0')}`;
      const cust = (db.customers || []).find(c => String(c.id) === String(q.customerId));
      const ownerName = cust ? cust.name : 'Unknown Owner';
      const ownerPhone = cust ? cust.phone : '';
      
      const newProperty = {
        id: propId,
        status: 'Available',
        date: new Date().toISOString().split('T')[0],
        contact_person_name: ownerName,
        contact_number: ownerPhone,
        dealer_owner_booked: 'Owner',
        r_c_i: q.r_c_i || 'Residential',
        propertyType: q.propertyType || 'Villa',
        locality: q.locality || '',
        sector_block: q.sector_block || '',
        address_number: '',
        size: q.size || '',
        demand: q.demand || '',
        linkedQueryId: q.id,
        current_owner_id: q.customerId,
        owner_history: [],
        timeline: [
          {
            date: new Date().toLocaleDateString('en-IN'),
            event: 'Property Added to Inventory',
            details: `Automatically created from Sell Property Query ${q.id} by ${ownerName}`
          }
        ]
      };
      db.properties.push(newProperty);
      
      if (q.assignedEmployeeId) {
        setTimeout(() => {
          notifyUser(q.assignedEmployeeId, 'new-property-matched', {
            propertyId: propId,
            message: `Property ${propId} added automatically from Sell Query ${q.id}`
          });
        }, 500);
      }
      
      db.activity_logs = db.activity_logs || [];
      db.activity_logs.unshift({
        id: `LOG-${Date.now()}`,
        employeeName: req.user ? req.user.name : 'System',
        action: `Automatically created Property ${propId} in inventory from Query ${q.id}`,
        dateTime: new Date().toLocaleString()
      });
      
      writeDb(db);
      try { syncToSheets('properties'); } catch(e) {}
    }
  }
}

function handleDealerCallInsertion(c, db) {
  if (!c.dealerId) return;
  db.dealers = db.dealers || [];
  const dealer = db.dealers.find(d => String(d.id) === String(c.dealerId));
  if (dealer) {
    dealer.remarks = c.remarks || '';
    dealer.callOutcome = c.callOutcome || '';
    writeDb(db);
    try { syncToSheets('dealers'); } catch(e) {}
  }
}

function handleDealerVisitAssignment(payload, db, req, oldPayload = null) {
  if (payload.assignedEmployeeId) {
    const hasChanged = !oldPayload || String(oldPayload.assignedEmployeeId) !== String(payload.assignedEmployeeId);
    if (hasChanged) {
      payload.visitStatus = payload.visitStatus || 'Assigned';
      
      setTimeout(() => {
        notifyUser(payload.assignedEmployeeId, 'visit-assigned', {
          visitId: payload.id,
          message: `New Dealer Visit Assigned: ${payload.person_name || 'Dealer'} (${payload.firm_name || 'No Firm'})`
        });
      }, 500);

      db.activity_logs = db.activity_logs || [];
      db.activity_logs.unshift({
        id: `LOG-${Date.now()}`,
        employeeName: req.user ? req.user.name : 'System',
        action: `Assigned Dealer ${payload.id} to Employee ${payload.assignedEmployeeId} for a visit`,
        dateTime: new Date().toLocaleString()
      });
    }
  }
}

function convertLeadToCustomer(leadId, db, remarks = '') {
  if (!leadId || !leadId.startsWith('LEAD-')) return null;

  const lead = (db.leads || []).find(l => String(l.id) === String(leadId));
  if (!lead) return null;

  const cleanPhone = String(lead.phone || '').trim();
  let existingCust = (db.customers || []).find(c => c.phone && String(c.phone).trim() === cleanPhone);

  if (!existingCust) {
    const custId = `CUST-${String((db.customers || []).length + 1).padStart(3, '0')}`;
    existingCust = {
      id: custId,
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone,
      stage: 'Converted Buyer Deal Closed',
      assignedEmployeeId: lead.assignedEmployeeId || 'EMP-001',
      budget: lead.budget || '',
      city: lead.locality || '',
      requirements: lead.remarks || remarks || `Converted from Lead ${leadId}`,
      dateAdded: new Date().toISOString().split('T')[0]
    };
    db.customers = db.customers || [];
    db.customers.push(existingCust);
    try { syncToSheets('customers'); } catch(e) {}
  }

  lead.status = 'Converted';
  try { syncToSheets('leads'); } catch(e) {}

  const newCustId = existingCust.id;

  db.follow_ups = (db.follow_ups || []).map(f => {
    if (String(f.customerId) === String(leadId)) {
      return { ...f, customerId: newCustId };
    }
    return f;
  });
  try { syncToSheets('follow_ups'); } catch(e) {}

  db.queries = (db.queries || []).map(q => {
    if (String(q.customerId) === String(leadId)) {
      return { ...q, customerId: newCustId };
    }
    return q;
  });
  try { syncToSheets('queries'); } catch(e) {}

  db.site_visits = (db.site_visits || []).map(sv => {
    if (String(sv.customerId) === String(leadId)) {
      return { ...sv, customerId: newCustId };
    }
    return sv;
  });
  try { syncToSheets('site_visits'); } catch(e) {}

  db.sales = (db.sales || []).map(s => {
    if (String(s.customerId) === String(leadId)) {
      return { ...s, customerId: newCustId };
    }
    return s;
  });
  try { syncToSheets('sales'); } catch(e) {}

  db.property_pitch_history = (db.property_pitch_history || []).map(p => {
    if (String(p.customerId) === String(leadId)) {
      return { ...p, customerId: newCustId };
    }
    return p;
  });
  try { syncToSheets('property_pitch_history'); } catch(e) {}

  db.properties = (db.properties || []).map(prop => {
    if (String(prop.current_owner_id) === String(leadId)) {
      return { ...prop, current_owner_id: newCustId };
    }
    return prop;
  });
  try { syncToSheets('properties'); } catch(e) {}

  writeDb(db);
  return existingCust;
}

function handleDealStatusChange(d, db, req) {
  if (!d.id || d.status !== 'Closed') return;
  
  if (d.customerId && String(d.customerId).startsWith('LEAD-')) {
    const cust = convertLeadToCustomer(d.customerId, db, `Converted via Closed Deal ${d.id}`);
    if (cust) {
      d.customerId = cust.id;
    }
  }

  db.properties = db.properties || [];
  const propIndex = db.properties.findIndex(p => String(p.id) === String(d.propertyId));
  if (propIndex !== -1) {
    const prop = db.properties[propIndex];
    
    const prevOwnerId = prop.current_owner_id || d.sellerCustomerId || '';
    const prevOwnerName = prop.contact_person_name || '';
    
    const buyerCust = (db.customers || []).find(c => String(c.id) === String(d.customerId));
    const buyerName = buyerCust ? buyerCust.name : (d.customerId || 'Unknown');
    
    prop.owner_history = prop.owner_history || [];
    if (prevOwnerId || prevOwnerName) {
      const hasHistory = prop.owner_history.some(h => String(h.dealId) === String(d.id));
      if (!hasHistory) {
        prop.owner_history.push({
          dealId: d.id,
          ownerId: prevOwnerId || 'N/A',
          ownerName: prevOwnerName || 'Previous Owner',
          purchaseDate: prop.date || '',
          purchasePrice: prop.demand || '',
          saleDate: d.registrationDate || new Date().toISOString().split('T')[0],
          salePrice: d.salePrice || ''
        });
      }
    }
    
    prop.current_owner_id = d.customerId;
    prop.contact_person_name = buyerName;
    prop.contact_number = buyerCust ? buyerCust.phone : (prop.contact_number || '');
    prop.status = 'Property Registered/Sold Out';
    
    prop.ownership_documents = prop.ownership_documents || { old_owner: [], new_owner: [] };
    if (prop.ownership_documents.new_owner && prop.ownership_documents.new_owner.length > 0) {
      prop.ownership_documents.old_owner = [
        ...(prop.ownership_documents.old_owner || []),
        ...prop.ownership_documents.new_owner
      ];
    }
    
    prop.ownership_documents.new_owner = [];
    if (d.documents) {
      prop.ownership_documents.new_owner = Array.isArray(d.documents) 
        ? d.documents 
        : [d.documents];
    }
    
    prop.timeline = prop.timeline || [];
    prop.timeline.push({
      date: new Date().toLocaleDateString('en-IN'),
      event: 'Ownership Changed (Deal Closed)',
      details: `Sold by ${prevOwnerName || 'Unknown'} to ${buyerName} for ₹${d.salePrice}`
    });
    
    db.properties[propIndex] = prop;
    
    if (d.employeeId) {
      setTimeout(() => {
        notifyUser(d.employeeId, 'deal-closed-notif', {
          dealId: d.id,
          message: `Deal ${d.id} for Property ${d.propertyId} has been closed and ownership updated.`
        });
      }, 500);
    }
    
    db.activity_logs = db.activity_logs || [];
    db.activity_logs.unshift({
      id: `LOG-${Date.now()}`,
      employeeName: req.user ? req.user.name : 'System',
      action: `Deal ${d.id} closed. Ownership of Property ${d.propertyId} transferred to Customer ${d.customerId}.`,
      dateTime: new Date().toLocaleString()
    });
    
    writeDb(db);
    try { syncToSheets('properties'); } catch(e) {}
  }
}

function handlePitchStatusChange(p, db, req) {
  if (!p.id) return;

  if (p.propertyId && p.propertyStatus) {
    const propIndex = (db.properties || []).findIndex(pr => String(pr.id) === String(p.propertyId));
    if (propIndex !== -1) {
      db.properties[propIndex].status = p.propertyStatus;
      writeDb(db);
      try { syncToSheets('properties'); } catch(e) {}
    }
  }

  if (p.pitchMethod === 'Call') {
    db.follow_ups = db.follow_ups || [];
    db.follow_ups.forEach(f => {
      if (String(f.customerId) === String(p.customerId) && f.status !== 'Completed') {
        f.status = 'Completed';
        f.remarks = (f.remarks || '') + `\n[System: Auto-completed call follow-up via logged Call Pitch ${p.id}]`;
      }
    });
    try { syncToSheets('follow_ups'); } catch(e) {}
  }

  const mapPitchStatusToPipelineAction = (statusVal) => {
    if (!statusVal) return null;
    const s = String(statusVal).toLowerCase().trim();
    if (s.includes('closed') || s.includes('won') || s.includes('sold out')) return 'Closed';
    if (s.includes('visit') || s.includes('showing') || s.includes('scheduled')) return 'Site Visit';
    if (s.includes('negotiation') || s.includes('token') || s.includes('part payment') || s.includes('agreement') || s.includes('noc')) return 'Negotiation';
    if (s.includes('interested')) return 'Interested';
    if (s.includes('pitched') || s.includes('offered')) return 'Contacted';
    if (s.includes('rejected') || s.includes('lost') || s.includes('no interest')) return 'Lost';
    return null;
  };

  const mappedStage = mapPitchStatusToPipelineAction(p.status) || mapPitchStatusToPipelineAction(p.propertyStatus);
  if (mappedStage) {
    db.follow_ups = (db.follow_ups || []).map(f => {
      if (String(f.customerId) === String(p.customerId)) {
        f.pipelineAction = mappedStage;
        f.pitchedPropertyId = p.propertyId || f.pitchedPropertyId;
        f.pitchPrice = p.quotedPrice || f.pitchPrice;
        f.pitchRemarks = p.remarks || f.pitchRemarks;
        
        setTimeout(() => {
          const freshDb = readDb();
          const freshFollowUp = (freshDb.follow_ups || []).find(x => x.id === f.id);
          if (freshFollowUp) {
            handleFollowUpPipelineAction(freshFollowUp, freshDb, req);
          }
        }, 10);
      }
      return f;
    });
    try { syncToSheets('follow_ups'); } catch(e) {}

    db.queries = (db.queries || []).map(q => {
      if (String(q.customerId) === String(p.customerId)) {
        q.stage = mappedStage;
        if (mappedStage === 'Closed') {
          q.status = 'Closed';
        }
      }
      return q;
    });
    try { syncToSheets('queries'); } catch(e) {}
    writeDb(db);
  }

  const isDealClosed = p.status === 'Deal Closed' || 
                       p.status === 'Property Registered/Sold Out' || 
                       p.propertyStatus === 'Property Registered/Sold Out';

  if (!isDealClosed) return;

  let finalCustomerId = p.customerId;
  if (p.customerId && String(p.customerId).startsWith('LEAD-')) {
    const cust = convertLeadToCustomer(p.customerId, db, `Converted via Closed Pitch ${p.id}`);
    if (cust) {
      p.customerId = cust.id;
      finalCustomerId = cust.id;
    }
  }

  db.properties = db.properties || [];
  const propIndex = db.properties.findIndex(pr => String(pr.id) === String(p.propertyId));
  if (propIndex !== -1) {
    const prop = db.properties[propIndex];
    
    const prevOwnerId = prop.current_owner_id || '';
    const prevOwnerName = prop.contact_person_name || '';
    
    const buyerCust = (db.customers || []).find(c => String(c.id) === String(finalCustomerId));
    const buyerName = buyerCust ? buyerCust.name : (finalCustomerId || 'Unknown');
    
    prop.owner_history = prop.owner_history || [];
    if (prevOwnerId || prevOwnerName) {
      const hasHistory = prop.owner_history.some(h => String(h.dealId) === String(p.id));
      if (!hasHistory) {
        prop.owner_history.push({
          dealId: p.id,
          ownerId: prevOwnerId || 'N/A',
          ownerName: prevOwnerName || 'Previous Owner',
          purchaseDate: prop.date || '',
          purchasePrice: prop.demand || '',
          saleDate: new Date().toISOString().split('T')[0],
          salePrice: p.quotedPrice || ''
        });
      }
    }
    
    prop.current_owner_id = finalCustomerId;
    prop.contact_person_name = buyerName;
    prop.contact_number = buyerCust ? buyerCust.phone : (prop.contact_number || '');
    prop.status = 'Property Registered/Sold Out';
    
    prop.timeline = prop.timeline || [];
    prop.timeline.push({
      date: new Date().toLocaleDateString('en-IN'),
      event: 'Ownership Changed (Pitch Closed)',
      details: `Sold by ${prevOwnerName || 'Unknown'} to ${buyerName} for ₹${p.quotedPrice} via Pitch ${p.id}`
    });
    
    db.properties[propIndex] = prop;
    
    if (p.employeeId) {
      setTimeout(() => {
        notifyUser(p.employeeId, 'pitch-closed-notif', {
          pitchId: p.id,
          message: `Pitch ${p.id} for Property ${p.propertyId} has been closed and ownership updated.`
        });
      }, 500);
    }
    
    db.activity_logs = db.activity_logs || [];
    db.activity_logs.unshift({
      id: `LOG-${Date.now()}`,
      employeeName: req.user ? req.user.name : 'System',
      action: `Pitch ${p.id} closed. Ownership of Property ${p.propertyId} transferred to Customer ${finalCustomerId}.`,
      dateTime: new Date().toLocaleString()
    });
    
    writeDb(db);
    try { syncToSheets('properties'); } catch(e) {}
  }

  db.follow_ups = db.follow_ups || [];
  db.follow_ups.forEach(f => {
    if (String(f.customerId) === String(p.customerId) || String(f.customerId) === String(finalCustomerId)) {
      f.status = 'Call Done';
      f.pipelineAction = 'Property Registered/Sold Out';
    }
  });
  writeDb(db);
  try { syncToSheets('follow_ups'); } catch(e) {}
}

function handleLeadStatusChange(lead, db, req) {
  if (lead.leadType === 'Seller') {
    const cleanPhone = String(lead.phone).trim();
    let existingCust = (db.customers || []).find(c => String(c.leadId) === String(lead.id) || (c.phone && String(c.phone).trim() === cleanPhone));
    
    const leadDemand = lead.demand || lead.budget || '';

    if (!existingCust) {
      const custId = `CUST-${String((db.customers || []).length + 1).padStart(3, '0')}`;
      existingCust = {
        id: custId,
        leadId: lead.id,
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone,
        stage: 'Active Seller',
        assignedEmployeeId: lead.assignedEmployeeId || 'EMP-001',
        budget: leadDemand,
        city: lead.locality || '',
        requirements: lead.remarks || 'Converted direct property seller.',
        dateAdded: new Date().toISOString().split('T')[0]
      };
      db.customers = db.customers || [];
      db.customers.push(existingCust);
      try { syncToSheets('customers'); } catch(e) {}
    } else {
      existingCust.budget = leadDemand;
      existingCust.city = lead.locality || existingCust.city || '';
      try { syncToSheets('customers'); } catch(e) {}
    }

    db.properties = db.properties || [];
    let existingProp = null;
    if (lead.propertyId) {
      existingProp = db.properties.find(p => String(p.id) === String(lead.propertyId));
    }
    if (!existingProp) {
      existingProp = db.properties.find(p => p.linkedLeadId === lead.id || String(p.booked_by_customer_id) === String(existingCust.id));
    }

    if (existingProp) {
      existingProp.current_owner_id = existingCust.id;
      existingProp.booked_by_customer_id = existingCust.id;
      existingProp.linkedLeadId = lead.id;
      existingProp.demand = leadDemand || existingProp.demand || '';
      existingProp.locality = lead.locality || existingProp.locality || '';
      existingProp.sector_block = lead.sector_block || existingProp.sector_block || '';
      existingProp.size = lead.size || existingProp.size || '';
      existingProp.propertyType = lead.propertyType || existingProp.propertyType || '';
      existingProp.r_c_i = lead.r_c_i || existingProp.r_c_i || 'Residential';
      try { syncToSheets('properties'); } catch(e) {}
    } else {
      const propId = `PROP-${String(db.properties.length + 1).padStart(3, '0')}`;
      existingProp = {
        id: propId,
        linkedLeadId: lead.id,
        status: 'Available',
        date: new Date().toLocaleDateString('en-IN'),
        contact_person_name: lead.name,
        contact_number: lead.phone,
        dealer_owner_booked: 'Owner',
        booked_by_customer_id: existingCust.id,
        current_owner_id: existingCust.id,
        r_c_i: lead.r_c_i || 'Residential',
        propertyType: lead.propertyType || '',
        locality: lead.locality || '',
        sector_block: lead.sector_block || '',
        size: lead.size || '',
        demand: leadDemand,
        lead_source: lead.source || 'Direct',
        initial_notes: lead.remarks || 'Auto-created from seller lead'
      };
      db.properties.push(existingProp);
      lead.propertyId = propId;
      try { syncToSheets('properties'); } catch(e) {}
    }
  }
}

function syncPropertyDetailsUniversally(propId, db) {
  const prop = (db.properties || []).find(p => String(p.id) === String(propId));
  if (!prop) return;

  const fieldsToSync = {
    r_c_i: prop.r_c_i || '',
    propertyType: prop.propertyType || '',
    locality: prop.locality || '',
    sector_block: prop.sector_block || '',
    size: prop.size || '',
    demand: prop.demand || ''
  };

  (db.leads || []).forEach(lead => {
    if (String(lead.propertyId) === String(propId) || String(lead.id) === String(prop.linkedLeadId)) {
      lead.r_c_i = fieldsToSync.r_c_i;
      lead.propertyType = fieldsToSync.propertyType;
      lead.locality = fieldsToSync.locality;
      lead.sector_block = fieldsToSync.sector_block;
      lead.size = fieldsToSync.size;
      lead.demand = fieldsToSync.demand;
      lead.budget = fieldsToSync.demand;
    }
  });

  (db.customers || []).forEach(cust => {
    if (String(cust.id) === String(prop.current_owner_id) || String(cust.id) === String(prop.booked_by_customer_id)) {
      cust.city = fieldsToSync.locality;
      cust.budget = fieldsToSync.demand;
    }
  });

  (db.queries || []).forEach(q => {
    if (String(q.propertyId) === String(propId)) {
      q.r_c_i = fieldsToSync.r_c_i;
      q.propertyType = fieldsToSync.propertyType;
      q.locality = fieldsToSync.locality;
      q.sector_block = fieldsToSync.sector_block;
      q.size = fieldsToSync.size;
      q.demand = fieldsToSync.demand;
      q.budget = fieldsToSync.demand;
    }
  });

  (db.follow_ups || []).forEach(f => {
    if (String(f.pitchedPropertyId) === String(propId)) {
      f.pitchPrice = fieldsToSync.demand;
    }
  });
}

function syncAssignedEmployeeUniversally(sourceModule, recordId, newEmployeeId, db) {
  if (!newEmployeeId) return;
  
  let leadId = '';
  let custId = '';
  let phones = new Set();
  let emails = new Set();

  if (sourceModule === 'leads') {
    leadId = String(recordId);
    const lead = (db.leads || []).find(l => String(l.id) === leadId);
    if (lead) {
      if (lead.phone) phones.add(String(lead.phone).trim());
      if (lead.email) emails.add(String(lead.email).trim().toLowerCase());
      const cust = (db.customers || []).find(c => String(c.leadId) === leadId || (lead.phone && String(c.phone).trim() === String(lead.phone).trim()));
      if (cust) {
        custId = String(cust.id);
        if (cust.phone) phones.add(String(cust.phone).trim());
        if (cust.email) emails.add(String(cust.email).trim().toLowerCase());
      }
    }
  } else if (sourceModule === 'customers') {
    custId = String(recordId);
    const cust = (db.customers || []).find(c => String(c.id) === custId);
    if (cust) {
      if (cust.phone) phones.add(String(cust.phone).trim());
      if (cust.email) emails.add(String(cust.email).trim().toLowerCase());
      leadId = cust.leadId ? String(cust.leadId) : '';
      const lead = (db.leads || []).find(l => String(l.id) === leadId || (cust.phone && String(l.phone).trim() === String(cust.phone).trim()));
      if (lead) {
        leadId = String(lead.id);
        if (lead.phone) phones.add(String(lead.phone).trim());
        if (lead.email) emails.add(String(lead.email).trim().toLowerCase());
      }
    }
  } else if (sourceModule === 'follow_ups') {
    const fup = (db.follow_ups || []).find(f => String(f.id) === String(recordId));
    if (fup) {
      const targetId = String(fup.customerId);
      if (targetId.startsWith('LEAD-')) {
        leadId = targetId;
        const lead = (db.leads || []).find(l => String(l.id) === leadId);
        if (lead) {
          if (lead.phone) phones.add(String(lead.phone).trim());
          if (lead.email) emails.add(String(lead.email).trim().toLowerCase());
        }
      } else if (targetId.startsWith('CUST-')) {
        custId = targetId;
        const cust = (db.customers || []).find(c => String(c.id) === custId);
        if (cust) {
          if (cust.phone) phones.add(String(cust.phone).trim());
          if (cust.email) emails.add(String(cust.email).trim().toLowerCase());
          if (cust.leadId) leadId = String(cust.leadId);
        }
      }
    }
  }

  const matchClient = (idField, phoneField) => {
    const idStr = String(idField || '');
    const phoneStr = String(phoneField || '').trim();
    if (leadId && idStr === leadId) return true;
    if (custId && idStr === custId) return true;
    if (phoneStr && phones.has(phoneStr)) return true;
    return false;
  };

  let updated = false;

  (db.leads || []).forEach(l => {
    if (matchClient(l.id, l.phone)) {
      if (l.assignedEmployeeId !== newEmployeeId) {
        l.assignedEmployeeId = newEmployeeId;
        updated = true;
      }
    }
  });

  (db.customers || []).forEach(c => {
    if (matchClient(c.id, c.phone) || (leadId && String(c.leadId) === leadId)) {
      if (c.assignedEmployeeId !== newEmployeeId) {
        c.assignedEmployeeId = newEmployeeId;
        updated = true;
      }
    }
  });

  (db.follow_ups || []).forEach(f => {
    if (matchClient(f.customerId, '')) {
      if (f.employeeId !== newEmployeeId) {
        f.employeeId = newEmployeeId;
        updated = true;
      }
    }
  });

  (db.queries || []).forEach(q => {
    if (matchClient(q.customerId, '')) {
      if (q.assignedEmployeeId !== newEmployeeId) {
        q.assignedEmployeeId = newEmployeeId;
        updated = true;
      }
    }
  });

  (db.site_visits || []).forEach(s => {
    if (matchClient(s.customerId, '')) {
      if (s.employeeId !== newEmployeeId) {
        s.employeeId = newEmployeeId;
        updated = true;
      }
    }
  });

  if (updated) {
    try { syncToSheets('leads'); } catch(e) {}
    try { syncToSheets('customers'); } catch(e) {}
    try { syncToSheets('follow_ups'); } catch(e) {}
    try { syncToSheets('queries'); } catch(e) {}
    try { syncToSheets('site_visits'); } catch(e) {}
  }
}

function handleFollowUpPipelineAction(f, db, req) {
  if (!f.pipelineAction) return;

  const action = f.pipelineAction;
  const customerId = f.customerId;
  const queryId = f.queryId;

  const isSiteVisitStage = action === 'Site Visit Arranged' || action === 'Site Visit' || action === 'Site Visit Scheduled' || action === 'Lead_VisitScheduled';
  if (isSiteVisitStage) {
    let existingVisit = (db.site_visits || []).find(sv => sv.linkedFollowUpId === f.id);
    if (existingVisit) {
      let changed = false;
      if (existingVisit.date !== f.date) {
        existingVisit.date = f.date;
        changed = true;
      }
      if (existingVisit.propertyId !== (f.pitchedPropertyId || 'PROP-001')) {
        existingVisit.propertyId = f.pitchedPropertyId || 'PROP-001';
        changed = true;
      }
      if (existingVisit.employeeId !== f.employeeId) {
        existingVisit.employeeId = f.employeeId;
        changed = true;
      }
      if (changed) {
        writeDb(db);
        try { syncToSheets('site_visits'); } catch(e) {}
      }
    } else {
      const visitId = `VISIT-${String((db.site_visits || []).length + 1).padStart(3, '0')}`;
      const newVisit = {
        id: visitId,
        customerId: customerId,
        propertyId: f.pitchedPropertyId || 'PROP-001',
        employeeId: f.employeeId || 'EMP-001',
        date: f.date || new Date().toLocaleDateString('en-IN'),
        time: f.time || '12:00 PM',
        result: 'Scheduled',
        remarks: f.remarks || `Automatically created from Follow-Up ${f.id} stage: ${action}.`,
        linkedFollowUpId: f.id
      };
      db.site_visits = db.site_visits || [];
      db.site_visits.push(newVisit);
      writeDb(db);
      try { syncToSheets('site_visits'); } catch(e) {}
    }
  } else {
    const originalLen = (db.site_visits || []).length;
    db.site_visits = (db.site_visits || []).filter(sv => sv.linkedFollowUpId !== f.id);
    if ((db.site_visits || []).length !== originalLen) {
      writeDb(db);
      try { syncToSheets('site_visits'); } catch(e) {}
    }
  }

  const isClosedDeal = action === 'Closed' || action === 'Booked' || action === 'Query_ClosedWon' || action === 'Deal Closed' || action === 'Property Registered/Sold Out' || action === 'Property Booked';

  if (isClosedDeal) {
    let finalCustomerId = customerId;
    if (customerId && String(customerId).startsWith('LEAD-')) {
      const cust = convertLeadToCustomer(customerId, db, `Converted via Follow-Up close action.`);
      if (cust) {
        finalCustomerId = cust.id;
      }
    }

    const dealId = `DEAL-${String((db.deals || []).length + 1).padStart(3, '0')}`;
    const newDeal = {
      id: dealId,
      customerId: finalCustomerId,
      propertyId: f.pitchedPropertyId || 'PROP-001',
      employeeId: f.employeeId || 'EMP-001',
      status: 'Closed',
      salePrice: f.pitchPrice || 1000000,
      registrationDate: new Date().toISOString().split('T')[0]
    };
    
    db.deals = db.deals || [];
    db.deals.push(newDeal);
    handleDealStatusChange(newDeal, db, req);
    writeDb(db);
    try { syncToSheets('deals'); } catch(e) {}
  }

  if (queryId) {
    const q = (db.queries || []).find(x => String(x.id) === String(queryId));
    if (q) {
      q.stage = action;
      if (action === 'Closed' || action === 'Deal Closed' || action === 'Property Registered/Sold Out' || action === 'Query_ClosedWon') {
        q.status = 'Closed';
      } else if (action === 'Requirement Verified' || action === 'Query_Approved') {
        q.status = 'Approved';
      }
      handleQueryStageChange(q, db, req);
      writeDb(db);
      try { syncToSheets('queries'); } catch(e) {}
    }
  } else if (customerId && String(customerId).startsWith('LEAD-')) {
    const lead = (db.leads || []).find(l => String(l.id) === String(customerId));
    if (lead) {
      if (action === 'Lost' || action === 'Lost Lead') {
        lead.status = 'Junk';
      } else if (action === 'Closed' || action === 'Deal Closed' || action === 'Property Registered/Sold Out' || action === 'Booked' || action === 'Property Booked') {
        lead.status = 'Converted';
      } else {
        lead.status = action;
      }
      writeDb(db);
      try { syncToSheets('leads'); } catch(e) {}
    }
  } else if (customerId && String(customerId).startsWith('CUST-')) {
    const cust = (db.customers || []).find(c => String(c.id) === String(customerId));
    if (cust) {
      cust.stage = action;
      writeDb(db);
      try { syncToSheets('customers'); } catch(e) {}
    }
  }
}

function generateDynamicTimeline(moduleName, id, db) {
  const timeline = [];
  const allRemarks = db.remarks || [];
  const allSiteVisits = db.site_visits || [];
  const allFollowUps = db.follow_ups || [];
  const allQueries = db.queries || [];
  const allDeals = db.deals || [];
  const allPitches = db.property_pitch_history || [];
  const allLeads = db.leads || [];

  if (moduleName === 'customers') {
    const cust = (db.customers || []).find(c => String(c.id) === String(id));
    if (cust) {
      timeline.push({
        date: cust.dateAdded || '',
        event: 'Customer Profile Created',
        details: `Customer ${cust.name} added to master record.`,
        icon: 'UserCheck'
      });
      const cleanPhone = String(cust.phone).trim();
      const cleanEmail = String(cust.email || '').trim().toLowerCase();
      allLeads.forEach(l => {
        const leadPhone = String(l.phone).trim();
        const leadEmail = String(l.email || '').trim().toLowerCase();
        if (leadPhone === cleanPhone || (cleanEmail && leadEmail === cleanEmail)) {
          timeline.push({
            date: l.dateAdded || '',
            event: `Lead Created (${l.id})`,
            details: `Source: ${l.source} • Status: ${l.status}`,
            icon: 'Magnet'
          });
        }
      });
      allQueries.forEach(q => {
        if (String(q.customerId) === String(id)) {
          timeline.push({
            date: q.date || '',
            event: `Query Created (${q.id})`,
            details: `Type: ${q.queryType} • Status: ${q.status} • Stage: ${q.stage}`,
            icon: 'HelpCircle'
          });
        }
      });
      allSiteVisits.forEach(v => {
        if (String(v.customerId) === String(id)) {
          timeline.push({
            date: v.date || '',
            event: `Site Visit Scheduled/Done (${v.id})`,
            details: `Property: ${v.propertyId} • Result: ${v.result}`,
            icon: 'Eye'
          });
        }
      });
      allFollowUps.forEach(f => {
        if (String(f.customerId) === String(id)) {
          timeline.push({
            date: f.date || '',
            event: `Follow-Up Scheduled (${f.id})`,
            details: `Status: ${f.status} • Assigned Exec: ${f.employeeId}`,
            icon: 'PhoneCall'
          });
        }
      });
      allPitches.forEach(p => {
        if (String(p.customerId) === String(id)) {
          timeline.push({
            date: p.pitchDate ? p.pitchDate.split(' ')[0] : '',
            event: `Property Pitched (${p.id})`,
            details: `Property: ${p.propertyId} pitched by ${p.employeeName} via ${p.pitchMethod}`,
            icon: 'Send'
          });
        }
      });
      allDeals.forEach(d => {
        if (String(d.customerId) === String(id) || String(d.sellerCustomerId) === String(id)) {
          const role = String(d.customerId) === String(id) ? 'Buyer' : 'Seller';
          timeline.push({
            date: d.registrationDate || '',
            event: `Deal ${d.status} (${d.id})`,
            details: `Customer role: ${role} • Property: ${d.propertyId} • Price: ₹${d.salePrice}`,
            icon: 'Handshake'
          });
        }
      });
    }
  } else if (moduleName === 'properties') {
    const prop = (db.properties || []).find(p => String(p.id) === String(id));
    if (prop) {
      timeline.push({
        date: prop.date || '',
        event: 'Property Added to Inventory',
        details: `Status: ${prop.status} • Locality: ${prop.locality} • Price/Demand: ₹${prop.demand}`,
        icon: 'Home'
      });
      allSiteVisits.forEach(v => {
        if (String(v.propertyId) === String(id)) {
          timeline.push({
            date: v.date || '',
            event: `Site Visit Showcased (${v.id})`,
            details: `Customer: ${v.customerId} • Result: ${v.result}`,
            icon: 'Eye'
          });
        }
      });
      allPitches.forEach(p => {
        if (String(p.propertyId) === String(id)) {
          timeline.push({
            date: p.pitchDate ? p.pitchDate.split(' ')[0] : '',
            event: `Pitched to Customer (${p.id})`,
            details: `Pitched to ${p.customerName} by ${p.employeeName}`,
            icon: 'Send'
          });
        }
      });
      allDeals.forEach(d => {
        if (String(d.propertyId) === String(id)) {
          timeline.push({
            date: d.registrationDate || '',
            event: `Deal ${d.status} (${d.id})`,
            details: `Buyer: ${d.customerId} • Seller: ${d.sellerCustomerId} • Price: ₹${d.salePrice}`,
            icon: 'Handshake'
          });
        }
      });
      if (prop.owner_history) {
        prop.owner_history.forEach(h => {
          timeline.push({
            date: h.saleDate || '',
            event: 'Ownership Transferred',
            details: `Sold by ${h.ownerName} on ${h.saleDate} for ₹${h.salePrice}`,
            icon: 'User'
          });
        });
      }
    }
  } else if (moduleName === 'leads') {
    const lead = (db.leads || []).find(l => String(l.id) === String(id));
    if (lead) {
      timeline.push({
        date: lead.dateAdded || '',
        event: 'Lead Created',
        details: `Source: ${lead.source} • Budget: ₹${lead.budget}`,
        icon: 'Magnet'
      });
    }
  } else if (moduleName === 'queries') {
    const q = (db.queries || []).find(r => String(r.id) === String(id));
    if (q) {
      timeline.push({
        date: q.date || '',
        event: 'Query Created',
        details: `Type: ${q.queryType} • Status: ${q.status} • Stage: ${q.stage}`,
        icon: 'HelpCircle'
      });
    }
  } else if (moduleName === 'deals') {
    const d = (db.deals || []).find(r => String(r.id) === String(id));
    if (d) {
      timeline.push({
        date: d.registrationDate || '',
        event: 'Deal Created',
        details: `Status: ${d.status} • Price: ₹${d.salePrice}`,
        icon: 'Handshake'
      });
    }
  } else if (moduleName === 'dealers') {
    const dealer = (db.dealers || []).find(r => String(r.id) === String(id));
    if (dealer) {
      timeline.push({
        date: new Date().toLocaleDateString('en-IN'),
        event: 'Dealer Created',
        details: `Firm: ${dealer.firm_name} • Contact: ${dealer.person_name}`,
        icon: 'Building'
      });
      
      const calls = (db.dealer_calls || []).filter(c => String(c.dealerId) === String(id));
      calls.forEach(c => {
        timeline.push({
          date: c.date || '',
          event: `Outreach Call logged`,
          details: `Outcome: ${c.remarks} • Followup: ${c.followUpDate || 'None'} • By: ${c.employeeName}`,
          icon: 'PhoneCall'
        });
      });

      const meetings = (db.dealer_meetings || []).filter(m => String(m.dealerId) === String(id));
      meetings.forEach(m => {
        timeline.push({
          date: m.meetingDate || '',
          event: `Meeting ${m.status}`,
          details: `Purpose: ${m.purpose} • Result: ${m.outcome || 'Awaiting Report'}`,
          icon: 'Calendar'
        });
      });
    }
  }

  allRemarks.forEach(r => {
    if (r.targetModule === moduleName && String(r.targetId) === String(id)) {
      timeline.push({
        date: r.dateTime ? r.dateTime.split(' ')[0] : '',
        event: `Remark by ${r.employeeName}`,
        details: r.comment,
        icon: 'MessageSquare'
      });
    }
  });

  timeline.sort((a, b) => {
    const parseDate = (dStr) => {
      if (!dStr) return new Date(0);
      if (dStr.includes('-')) return new Date(dStr);
      const pts = dStr.split('/');
      if (pts.length === 3) return new Date(pts[2], pts[1] - 1, pts[0]);
      return new Date(dStr);
    };
    return parseDate(b.date) - parseDate(a.date);
  });

  return timeline;
}

function createFollowUpForLead(lead, db) {
  db.follow_ups = db.follow_ups || [];
  const exists = db.follow_ups.some(f => String(f.customerId) === String(lead.id));
  if (!exists) {
    const followUpId = `FOLLOW-${String(db.follow_ups.length + 1).padStart(3, '0')}`;
    const newFollowUp = {
      id: followUpId,
      customerId: lead.id,
      employeeId: lead.assignedEmployeeId || 'EMP-001',
      date: new Date().toLocaleDateString('en-IN'),
      time: '12:00 PM',
      status: 'Pending Call',
      pipelineAction: 'Fresh Lead',
      remarks: `Auto-scheduled initial follow up for Lead ${lead.id}.`
    };
    db.follow_ups.push(newFollowUp);
    try { syncToSheets('follow_ups'); } catch(e) {}
  }
}

function getEmployeeName(empId, db) {
  const emp = (db.employees || []).find(e => String(e.id) === String(empId));
  return emp ? emp.name : empId;
}

function selfCorrectDatabase() {
  try {
    const db = readDb();
    let updated = false;

    // Self-correct ghost converted leads (if customer is deleted, reset status to In-Progress)
    (db.leads || []).forEach(lead => {
      if (lead.status === 'Converted') {
        const cleanPhone = String(lead.phone || '').trim();
        const cleanEmail = String(lead.email || '').trim().toLowerCase();
        const hasCustomer = (db.customers || []).some(c => 
          String(c.leadId) === String(lead.id) ||
          (cleanPhone !== '' && String(c.phone || '').trim() === cleanPhone) ||
          (cleanEmail !== '' && String(c.email || '').trim().toLowerCase() === cleanEmail)
        );
        if (!hasCustomer) {
          lead.status = 'In-Progress';
          updated = true;
        }
      }
    });

    const closedDeals = (db.deals || []).filter(d => d.status === 'Closed');
    closedDeals.forEach(d => {
      const propIndex = (db.properties || []).findIndex(p => String(p.id) === String(d.propertyId));
      if (propIndex !== -1) {
        const prop = db.properties[propIndex];
        if (prop.status !== 'Property Registered/Sold Out') {
          prop.status = 'Property Registered/Sold Out';
          updated = true;
        }
        if (prop.current_owner_id !== d.customerId) {
          prop.current_owner_id = d.customerId;
          const buyerCust = (db.customers || []).find(c => String(c.id) === String(d.customerId));
          const buyerName = buyerCust ? buyerCust.name : (d.customerId || 'Unknown');
          prop.contact_person_name = buyerName;
          prop.contact_number = buyerCust ? buyerCust.phone : (prop.contact_number || '');
          updated = true;
        }
        prop.owner_history = prop.owner_history || [];
        const hasHistory = prop.owner_history.some(h => 
          String(h.saleDate) === String(d.registrationDate)
        );
        if (!hasHistory) {
          const prevOwnerName = 'Previous Owner';
          prop.owner_history.push({
            ownerId: 'N/A',
            ownerName: prevOwnerName,
            purchaseDate: prop.date || '',
            purchasePrice: prop.demand || '',
            saleDate: d.registrationDate || new Date().toISOString().split('T')[0],
            salePrice: d.salePrice || ''
          });
          updated = true;
        }
      }
    });

    if (updated) {
      writeDb(db);
      console.log('Database self-correction: synced property status & ownership logs for closed deals.');
    }
  } catch (err) {
    console.error('Database self-correction failed:', err);
  }
}

module.exports = {
  updateGlobalReferences,
  handleAutomatedPitchLogging,
  handleQueryStageChange,
  handleDealerCallInsertion,
  handleDealerVisitAssignment,
  convertLeadToCustomer,
  handleDealStatusChange,
  handlePitchStatusChange,
  handleLeadStatusChange,
  syncPropertyDetailsUniversally,
  syncAssignedEmployeeUniversally,
  handleFollowUpPipelineAction,
  generateDynamicTimeline,
  createFollowUpForLead,
  getEmployeeName,
  selfCorrectDatabase
};
