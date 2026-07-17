const crypto = require('crypto');

const BUYER_STAGES = ['New Lead', 'Contacted', 'Requirement Verified', 'Property Matching', 'Property Pitched', 'Site Visit Scheduled', 'Site Visit Completed', 'Negotiation', 'Token Received', 'Deal Closed', 'Lost', 'Hold'];
const SELLER_STAGES = ['New Seller Listing', 'Inspection Pending', 'Inspection Completed', 'Documents Verification', 'Approved', 'Available for Sale', 'Negotiation', 'Token Received', 'Sold / Registered', 'Inactive', 'Withdrawn', 'Sold by Other'];
const FEEDBACK_CATEGORIES = ['Price Too High', 'Location Not Suitable', 'Size Not Suitable', 'Property Condition', 'Loan/Finance Issue', 'Family Decision Pending', 'Interested', 'Strongly Interested', 'Other'];

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const displayId = (db, module, prefix) => {
  const max = (db[module] || []).reduce((n, r) => Math.max(n, Number(String(r.id || '').match(new RegExp(`^${prefix}-(\\d+)$`))?.[1]) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
};
const normalizePhone = value => String(value || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const person = user => ({ changedByUserId: user?.id || 'system', changedByName: user?.name || 'System', changedByRole: user?.role || 'System' });

function ensureModule(db, module) { if (!Array.isArray(db[module])) db[module] = []; return db[module]; }
function log(db, user, action, details = {}) {
  ensureModule(db, 'activity_logs').unshift({ id: `LOG-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`, uuid: uuid(), action, details, dateTime: now(), employeeName: user?.name || 'System', ...person(user) });
}
function propertyHistory(db, propertyId, fieldName, oldValue, newValue, actionType, user, extra = {}) {
  ensureModule(db, 'property_history').push({ id: `PROPH-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`, propertyHistoryId: uuid(), propertyId, fieldName, oldValue, newValue, actionType, changedAt: now(), ...person(user), ...extra });
}
function findCustomer(db, data) {
  const phone = normalizePhone(data.phone); const email = normalizeEmail(data.email);
  return (db.customers || []).find(c => (phone && normalizePhone(c.phone) === phone) || (email && normalizeEmail(c.email) === email));
}
function createFollowUp(db, { leadId, customerId, queryId, propertyId, employeeId, remarks }, user) {
  if (!employeeId) throw new Error('An assigned employee is required to create a follow-up.');
  const existing = (db.follow_ups || []).find(f => !f.deletedAt && f.initialFollowUp && String(f.leadId || '') === String(leadId || '') && String(f.customerId || '') === String(customerId || '') && String(f.queryId || '') === String(queryId || ''));
  if (existing) return existing;
  const rec = { id: displayId(db, 'follow_ups', 'FOLLOW'), uuid: uuid(), leadId: leadId || null, customerId: customerId || null, queryId: queryId || null, propertyId: propertyId || null, employeeId, initialFollowUp: true, date: new Date().toISOString().slice(0, 10), status: 'Pending Call', pipelineAction: 'Fresh Lead', remarks: remarks || '', createdAt: now(), ...person(user) };
  ensureModule(db, 'follow_ups').push(rec); return rec;
}

function prepareLead(db, lead, user) {
  lead.uuid ||= uuid(); lead.leadType ||= 'Buyer'; lead.buyerPipelineStage ||= lead.leadType === 'Buyer' ? 'New Lead' : undefined;
  lead.sellerPipelineStage ||= lead.leadType === 'Seller' ? 'New Seller Listing' : undefined;
  lead.phoneNormalized = normalizePhone(lead.phone); lead.emailNormalized = normalizeEmail(lead.email); lead.createdAt ||= now();
  if (!lead.assignedEmployeeId) throw new Error('An employee/RM must be assigned to a lead.');
  createFollowUp(db, { leadId: lead.id, employeeId: lead.assignedEmployeeId, remarks: `Initial follow-up for ${lead.leadType} lead ${lead.id}` }, user);
  if (lead.leadType !== 'Seller') return { lead };
  let customer = findCustomer(db, lead);
  if (!customer) {
    customer = { id: displayId(db, 'customers', 'CUST'), uuid: uuid(), name: lead.name || lead.person_name, phone: lead.phone || '', email: lead.email || '', phoneNormalized: lead.phoneNormalized, emailNormalized: lead.emailNormalized, assignedEmployeeId: lead.assignedEmployeeId, leadId: lead.id, tags: ['Seller'], createdAt: now(), ...person(user) };
    ensureModule(db, 'customers').push(customer);
  }
  lead.customerId = customer.id;
  const property = { id: displayId(db, 'properties', 'PROP'), uuid: uuid(), linkedLeadId: lead.id, current_owner_id: customer.id, assignedEmployeeId: lead.assignedEmployeeId, source: 'Direct Seller Lead', status: 'Inspection Pending', listingStatus: 'Inspection Pending', locality: lead.locality || '', sector_block: lead.sector_block || '', propertyType: lead.propertyType || '', demand: lead.demand || '', createdAt: now(), ...person(user) };
  ensureModule(db, 'properties').push(property);
  const listing = { id: `LIST-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`, listingCycleId: uuid(), propertyId: property.id, sellerCustomerId: customer.id, currentOwnerId: customer.id, linkedSellerLeadId: lead.id, source: 'Direct Seller Lead', listingStatus: 'Inspection Pending', askingPrice: lead.demand || '', listingDate: now(), createdAt: now(), ...person(user) };
  ensureModule(db, 'property_listing_cycles').push(listing);
  const inspection = { id: `INSP-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`, inspectionId: uuid(), propertyId: property.id, customerId: customer.id, sellerLeadId: lead.id, assignedEmployeeId: lead.assignedEmployeeId, approvalStatus: 'Pending', status: 'Inspection Pending', documentChecklist: [], createdAt: now(), ...person(user) };
  ensureModule(db, 'property_inspections').push(inspection);
  
  // Create Document Verification Task
  const task = { id: displayId(db, 'tasks', 'TASK'), uuid: uuid(), title: `Document Verification for Property ${property.id} (${lead.id})`, assignedTo: lead.assignedEmployeeId, dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), priority: 'High', status: 'Pending', createdAt: now(), ...person(user) };
  ensureModule(db, 'tasks').push(task);

  propertyHistory(db, property.id, 'status', null, 'Inspection Pending', 'CREATE_LISTING', user, { listingCycleId: listing.listingCycleId, linkedInspectionId: inspection.inspectionId });
  log(db, user, 'Seller lead onboarding created customer, inspection-pending property, listing cycle, verification task, and inspection.', { leadId: lead.id, customerId: customer.id, propertyId: property.id });
  return { lead, customer, property, listing, inspection, task };
}

function prepareQuery(db, query, user) {
  if (!query.customerId) throw new Error('A query must belong to an existing customer.');
  const customer = (db.customers || []).find(c => String(c.id) === String(query.customerId) && !c.deletedAt);
  if (!customer) throw new Error('Existing customer was not found; create a customer before creating a query.');
  if (!query.assignedEmployeeId) throw new Error('An employee/RM must be assigned to a query.');
  query.uuid ||= uuid(); query.stage ||= 'New Query'; query.createdAt ||= now();
  createFollowUp(db, { customerId: query.customerId, queryId: query.id, employeeId: query.assignedEmployeeId, remarks: `Initial follow-up for query ${query.id}` }, user);
  if (query.queryType !== 'Sell Property') return { query };
  const identity = [query.address, query.locality, query.sector_block, query.propertyType, query.size].map(x => String(x || '').trim().toLowerCase()).join('|');
  let property = (db.properties || []).find(p => String(p.current_owner_id) === String(query.customerId) && String(p.identityKey || '') === identity);
  if (!property) {
    property = { id: displayId(db, 'properties', 'PROP'), uuid: uuid(), current_owner_id: query.customerId, linkedQueryId: query.id, identityKey: identity, source: 'Customer Sell Query', status: 'Inspection Pending', listingStatus: 'Inspection Pending', locality: query.locality || '', sector_block: query.sector_block || '', propertyType: query.propertyType || '', size: query.size || '', demand: query.demand || '', createdAt: now(), ...person(user) };
    ensureModule(db, 'properties').push(property);
  } else property.linkedQueryId = query.id;
  const listing = { id: `LIST-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`, listingCycleId: uuid(), propertyId: property.id, sellerCustomerId: query.customerId, currentOwnerId: query.customerId, linkedSellQueryId: query.id, source: 'Customer Sell Query', listingStatus: 'Inspection Pending', askingPrice: query.demand || '', listingDate: now(), createdAt: now(), ...person(user) };
  ensureModule(db, 'property_listing_cycles').push(listing);
  propertyHistory(db, property.id, 'listingCycle', null, listing.listingCycleId, 'CREATE_LISTING_CYCLE', user, { linkedQueryId: query.id, listingCycleId: listing.listingCycleId });
  return { query, property, listing };
}

function recordPitch(db, pitch, user) {
  const hasLead = Boolean(pitch.leadId || String(pitch.customerId || '').startsWith('LEAD-'));
  const hasCustomer = Boolean(pitch.customerId && !String(pitch.customerId).startsWith('LEAD-'));
  if (hasLead === hasCustomer) throw new Error('A property pitch must reference exactly one lead or customer.');
  if (!pitch.propertyId || !(db.properties || []).some(p => String(p.id) === String(pitch.propertyId))) throw new Error('A valid property is required for a pitch.');
  if (pitch.feedbackRating && (Number(pitch.feedbackRating) < 1 || Number(pitch.feedbackRating) > 5)) throw new Error('Feedback rating must be between 1 and 5.');
  if (pitch.feedbackCategory && !FEEDBACK_CATEGORIES.includes(pitch.feedbackCategory)) throw new Error('Invalid feedback category.');
  pitch.uuid ||= uuid(); pitch.leadId ||= hasLead ? pitch.customerId : null; pitch.customerId = hasCustomer ? pitch.customerId : null; pitch.createdAt ||= now();
  if (String(pitch.status || '').toLowerCase().includes('deal closed')) throw new Error('A pitch cannot transfer ownership. Close a Deal using /api/workflows/deals/close.');
  log(db, user, 'Property pitch recorded.', { pitchId: pitch.id, propertyId: pitch.propertyId }); return pitch;
}

function closeDeal(db, input, user) {
  const property = (db.properties || []).find(p => String(p.id) === String(input.propertyId) && !p.deletedAt);
  if (!property) throw new Error('A valid property is required to close a deal.');
  if (!input.salePrice || Number(input.salePrice) <= 0) throw new Error('A valid sale price is required to close a deal.');
  if (!input.employeeId) throw new Error('An assigned employee is required to close a deal.');
  let buyerId = input.customerId;
  if (input.leadId || String(buyerId || '').startsWith('LEAD-')) {
    const leadId = input.leadId || buyerId; const lead = (db.leads || []).find(l => String(l.id) === String(leadId));
    if (!lead) throw new Error('Buyer lead not found.');
    let buyer = findCustomer(db, lead);
    if (!buyer) { buyer = { id: displayId(db, 'customers', 'CUST'), uuid: uuid(), name: lead.name, phone: lead.phone || '', email: lead.email || '', phoneNormalized: normalizePhone(lead.phone), emailNormalized: normalizeEmail(lead.email), assignedEmployeeId: lead.assignedEmployeeId, leadId: lead.id, tags: ['Buyer'], createdAt: now(), ...person(user) }; ensureModule(db, 'customers').push(buyer); }
    lead.customerId = buyer.id; lead.status = 'Converted'; lead.convertedAt = now(); buyerId = buyer.id;
  }
  const buyer = (db.customers || []).find(c => String(c.id) === String(buyerId) && !c.deletedAt);
  if (!buyer) throw new Error('A valid buyer customer is required to close a deal.');
  const sellerId = input.sellerCustomerId || property.current_owner_id;
  if (!sellerId || !(db.customers || []).some(c => String(c.id) === String(sellerId))) throw new Error('A valid seller/current owner is required to close a deal.');
  const cycle = (db.property_listing_cycles || []).find(c => String(c.listingCycleId) === String(input.listingCycleId) || String(c.id) === String(input.listingCycleId)) || (db.property_listing_cycles || []).find(c => String(c.propertyId) === String(property.id) && !['Sold / Registered', 'Sold'].includes(c.listingStatus));
  if (!cycle) throw new Error('An active property listing cycle is required to close a deal.');
  if ((db.deals || []).some(d => String(d.propertyId) === String(property.id) && String(d.listingCycleId) === String(cycle.listingCycleId) && d.status === 'Closed')) throw new Error('This property listing cycle already has a closed deal.');
  const deal = { ...input, id: input.id || displayId(db, 'deals', 'DEAL'), uuid: input.uuid || uuid(), propertyId: property.id, customerId: buyer.id, sellerCustomerId: sellerId, listingCycleId: cycle.listingCycleId, status: 'Closed', closedAt: now(), createdAt: input.createdAt || now(), ...person(user) };
  ensureModule(db, 'deals').push(deal);
  const previousOwner = sellerId; ensureModule(db, 'property_ownership_history').push({ ownershipHistoryId: uuid(), propertyId: property.id, previousOwnerId: previousOwner, newOwnerId: buyer.id, dealId: deal.id, salePrice: input.salePrice, transferredAt: now(), ...person(user) });
  property.current_owner_id = buyer.id; property.status = 'Property Registered/Sold Out'; property.updatedAt = now(); cycle.listingStatus = 'Sold / Registered'; cycle.salePrice = input.salePrice; cycle.soldDate = now(); cycle.soldDealId = deal.id;
  propertyHistory(db, property.id, 'current_owner_id', previousOwner, buyer.id, 'OWNERSHIP_TRANSFER', user, { listingCycleId: cycle.listingCycleId, linkedDealId: deal.id });
  propertyHistory(db, property.id, 'salePrice', null, input.salePrice, 'DEAL_CLOSED', user, { listingCycleId: cycle.listingCycleId, linkedDealId: deal.id });
  for (const q of db.queries || []) if (String(q.id) === String(input.queryId)) { q.status = 'Closed Won'; q.stage = 'Deal Closed'; }
  for (const p of db.property_pitch_history || []) if (String(p.id) === String(input.pitchId)) p.status = 'Closed Won';
  for (const f of db.follow_ups || []) if (String(f.id) === String(input.followUpId)) f.status = 'Closed Won';
  log(db, user, 'Deal closed and property ownership transferred.', { dealId: deal.id, propertyId: property.id, previousOwner, buyerId: buyer.id });
  return { deal, property, customer: buyer, listingCycle: cycle };
}

function migrate(db) {
  const modules = ['leads','customers','properties','projects','queries','follow_ups','site_visits','property_pitch_history','deals','property_history','project_history','property_inspections','property_listing_cycles','property_ownership_history','assignment_history','sync_jobs','sync_logs'];
  modules.forEach(m => ensureModule(db, m));
  for (const module of modules) for (const rec of db[module]) { rec.uuid ||= uuid(); rec.createdAt ||= rec.dateAdded || now(); if (module === 'follow_ups') { if (String(rec.customerId || '').startsWith('LEAD-')) { rec.leadId ||= rec.customerId; rec.customerId = null; } rec.deletedAt ||= null; } }
  db.schemaVersion = Math.max(Number(db.schemaVersion || 0), 2); db.migratedAt = now(); return db;
}

module.exports = { BUYER_STAGES, SELLER_STAGES, FEEDBACK_CATEGORIES, normalizePhone, prepareLead, prepareQuery, recordPitch, closeDeal, migrate, log, propertyHistory };
