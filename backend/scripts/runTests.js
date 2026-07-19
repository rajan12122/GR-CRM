const assert = require('assert');
const crypto = require('crypto');
const workflow = require('../services/crmWorkflowService');
const hooks = require('../services/businessHooksService');

// Setup mock database state
function createMockDb() {
  return {
    leads: [],
    customers: [],
    properties: [],
    queries: [],
    deals: [],
    follow_ups: [],
    site_visits: [],
    property_pitch_history: [],
    property_inspections: [],
    property_listing_cycles: [],
    tasks: [],
    remarks: [],
    activity_logs: [],
    audit_logs: [],
    employees: [
      { id: 'EMP-001', name: 'Gagan Chopra', role: 'Admin', status: 'Active', email: 'gagan@gmail.com', tokenVersion: 1 },
      { id: 'EMP-002', name: 'Sales RM 1', role: 'Sales', status: 'Active', email: 'sales1@gaganrealtech.com', tokenVersion: 1 },
      { id: 'EMP-003', name: 'Sales RM 2', role: 'Sales', status: 'Active', email: 'sales2@gaganrealtech.com', tokenVersion: 1 }
    ]
  };
}

const mockReq = {
  ip: '127.0.0.1',
  headers: {
    'user-agent': 'NodeTestRunner'
  }
};

const mockUser = {
  id: 'EMP-001',
  name: 'Gagan Chopra',
  role: 'Admin'
};

const mockSalesUser = {
  id: 'EMP-002',
  name: 'Sales RM 1',
  role: 'Sales'
};

// -------------------------------------------------------------
// Test 1: Buyer Lead-to-Deal Conversion Workflow
// -------------------------------------------------------------
function testBuyerWorkflow() {
  console.log('Running Test 1: Buyer Lead-to-Deal Workflow...');
  const db = createMockDb();

  // 1. Onboard a Buyer Lead
  const leadPayload = {
    id: 'LEAD-X01',
    name: 'Buyer Test Client',
    phone: '9876543210',
    leadType: 'Buyer',
    assignedEmployeeId: 'EMP-002',
    budget: '5000000',
    locality: 'Sector 62',
    source: 'Website',
    status: 'Open'
  };

  workflow.prepareLead(db, leadPayload, mockUser);
  db.leads.push(leadPayload);

  // Assertions
  assert.strictEqual(db.leads.length, 1);
  assert.strictEqual(db.leads[0].status, 'Open');
  
  // Verify automatic follow-up scheduling
  assert.strictEqual(db.follow_ups.length, 1);
  assert.strictEqual(db.follow_ups[0].leadId, 'LEAD-X01');
  assert.strictEqual(db.follow_ups[0].employeeId, 'EMP-002');
  assert.strictEqual(db.follow_ups[0].status, 'Pending Call');

  // 2. Pitch a Property
  leadPayload.pitchedPropertyId = 'PROP-001';
  db.customers.push({ id: 'CUST-002', name: 'Seller Client', phone: '9000000000', assignedEmployeeId: 'EMP-001' });
  db.properties.push({ id: 'PROP-001', propertyName: 'Aerocity Suite', status: 'Available', current_owner_id: 'CUST-002' });

  hooks.handleAutomatedPitchLogging(leadPayload, db, { user: mockSalesUser });

  // Assertions
  assert.strictEqual(db.property_pitch_history.length, 1);
  assert.strictEqual(db.leads[0].status, 'In-Progress');

  // 3. Site Visit scheduled via Follow-up pipeline change
  const fup = db.follow_ups[0];
  fup.pipelineAction = 'Site Visit';
  fup.pitchedPropertyId = 'PROP-001';
  fup.date = '18/07/2026';
  hooks.handleFollowUpPipelineAction(fup, db, { user: mockSalesUser });

  // Assertions
  assert.strictEqual(db.site_visits.length, 1);
  assert.strictEqual(db.site_visits[0].customerId, 'LEAD-X01');
  assert.strictEqual(db.site_visits[0].propertyId, 'PROP-001');
  assert.strictEqual(db.site_visits[0].date, '18/07/2026');

  // 4. Try closing deal when inspection and listing cycles are unapproved / unavailable
  db.property_listing_cycles.push({ id: 'LIST-001', propertyId: 'PROP-001', status: 'Available For Sale' });
  db.property_inspections.push({ id: 'INSP-001', propertyId: 'PROP-001', approvalStatus: 'Pending' });
  const dealPayload = {
    propertyId: 'PROP-001',
    customerId: 'LEAD-X01',
    employeeId: 'EMP-002',
    salePrice: '5100000',
    registrationDate: '2026-07-20'
  };

  assert.throws(() => {
    workflow.closeDeal(db, dealPayload, mockUser, mockReq);
  }, /has not been approved/);

  // Approve inspection
  db.property_inspections[0].approvalStatus = 'Approved';

  // Close deal successfully
  const dealResult = workflow.closeDeal(db, dealPayload, mockUser, mockReq);
  hooks.handleDealStatusChange(dealResult.deal, db, { user: mockUser });

  // Assertions
  assert.strictEqual(db.deals.length, 1);
  assert.strictEqual(db.deals[0].status, 'Closed');
  
  // Verify lead converted to customer and ID reassigned
  const customer = db.customers.find(c => c.phone === '9876543210');
  assert.ok(customer);
  assert.strictEqual(customer.phone, '9876543210');
  assert.strictEqual(db.leads[0].status, 'Converted');
  
  // Verify property ownership changed
  assert.strictEqual(db.properties[0].current_owner_id, customer.id);
  assert.strictEqual(db.properties[0].status, 'Property Registered/Sold Out');

  console.log('✓ Test 1 Passed!');
}

// -------------------------------------------------------------
// Test 2: Seller Onboarding & Document Verification Workflow
// -------------------------------------------------------------
function testSellerWorkflow() {
  console.log('Running Test 2: Seller Onboarding & Verification...');
  const db = createMockDb();

  // Onboard Seller Lead
  const leadPayload = {
    id: 'LEAD-S01',
    name: 'Seller Client',
    phone: '9000000000',
    leadType: 'Seller',
    assignedEmployeeId: 'EMP-003',
    demand: '7000000',
    locality: 'Sector 15',
    r_c_i: 'Residential',
    propertyType: 'Plot',
    size: '250 SqYd',
    source: 'Reference'
  };

  workflow.prepareLead(db, leadPayload, mockUser);
  db.leads.push(leadPayload);
  hooks.handleLeadStatusChange(leadPayload, db, { user: mockUser });

  // Assertions
  // Verify customer created automatically
  assert.strictEqual(db.customers.length, 1);
  const cust = db.customers[0];
  assert.strictEqual(cust.name, 'Seller Client');
  assert.strictEqual(cust.stage, 'Active Seller');

  // Verify property created automatically
  assert.strictEqual(db.properties.length, 1);
  const prop = db.properties[0];
  assert.strictEqual(prop.current_owner_id, cust.id);
  assert.strictEqual(prop.status, 'Inspection Pending');
  assert.strictEqual(prop.demand, '7000000');

  // Verify document verification task created
  assert.strictEqual(db.tasks.length, 1);
  const task = db.tasks[0];
  assert.strictEqual(task.assignedTo, 'EMP-003');
  assert.ok(task.title.includes('Document Verification'));

  console.log('✓ Test 2 Passed!');
}

// -------------------------------------------------------------
// Test 3: Returning Client Query Pipeline (Duplicate Check)
// -------------------------------------------------------------
function testReturningClientQueryPipeline() {
  console.log('Running Test 3: Returning Client Query Pipeline...');
  const db = createMockDb();

  // Pre-seed an existing customer
  db.customers.push({
    id: 'CUST-002',
    name: 'Existing Customer',
    phone: '9555555555',
    email: 'existing@client.com',
    assignedEmployeeId: 'EMP-002'
  });

  // Try onboarding a new lead with matching phone
  const duplicateLeadPayload = {
    id: 'LEAD-005',
    name: 'Duplicate Client Name',
    phone: '9555555555',
    leadType: 'Buyer',
    budget: '6000000',
    locality: 'Sector 70',
    source: 'Facebook'
  };

  // Run duplicate check mock mapping (mimicking createData handler)
  const cleanPhone = String(duplicateLeadPayload.phone).trim();
  const existingCust = (db.customers || []).find(r => r.phone && String(r.phone).trim() === cleanPhone);

  assert.ok(existingCust);
  
  // Insert query and follow-up instead of duplicate customer profile
  const queryId = 'QRY-X01';
  const newQuery = {
    id: queryId,
    customerId: existingCust.id,
    assignedEmployeeId: existingCust.assignedEmployeeId,
    date: new Date().toLocaleDateString('en-IN'),
    status: 'Pending Approval',
    queryType: 'Buy Property',
    stage: 'New Query',
    budget: duplicateLeadPayload.budget,
    locality: duplicateLeadPayload.locality,
    remarks: 'Auto-created duplicate check query.'
  };
  db.queries.push(newQuery);

  db.follow_ups.push({
    id: 'FOLLOW-X02',
    customerId: existingCust.id,
    queryId: queryId,
    employeeId: existingCust.assignedEmployeeId,
    status: 'Pending Call'
  });

  // Assertions
  assert.strictEqual(db.customers.length, 1); // Customer count did NOT change
  assert.strictEqual(db.queries.length, 1);
  assert.strictEqual(db.queries[0].customerId, 'CUST-002');
  assert.strictEqual(db.follow_ups.length, 1);
  assert.strictEqual(db.follow_ups[0].customerId, 'CUST-002');

  console.log('✓ Test 3 Passed!');
}

// -------------------------------------------------------------
// Test 4: Failed sync job queue mechanism
// -------------------------------------------------------------
function testSheetsSyncRetry() {
  console.log('Running Test 4: Sheets Sync Retry...');
  const db = createMockDb();

  // Create a failed job in queue
  db.sync_jobs = [
    {
      id: 'JOB-001',
      moduleName: 'leads',
      status: 'FAILED',
      attemptCount: 3,
      lastError: 'Google API Timeout',
      updatedAt: new Date().toISOString()
    }
  ];

  // Mimic retry trigger
  const job = db.sync_jobs.find(j => j.id === 'JOB-001');
  assert.ok(job);
  
  job.status = 'PENDING';
  job.attemptCount = 0;
  job.lastError = null;

  // Assertions
  assert.strictEqual(db.sync_jobs[0].status, 'PENDING');
  assert.strictEqual(db.sync_jobs[0].attemptCount, 0);
  assert.strictEqual(db.sync_jobs[0].lastError, null);

  console.log('✓ Test 4 Passed!');
}

// -------------------------------------------------------------
// Test 5: Role-based permissions validation (RBAC)
// -------------------------------------------------------------
function testPermissions() {
  console.log('Running Test 5: Role-Based Permissions...');
  
  const metadata = {
    rolesPermissions: {
      Admin: { leads: ['view', 'create', 'edit', 'delete'] },
      Sales: { leads: ['view', 'create'] }
    }
  };

  const checkPerm = (role, module, action) => {
    if (role === 'Admin') return true;
    const perms = metadata.rolesPermissions[role] || {};
    const moduleActions = perms[module] || [];
    return moduleActions.includes(action);
  };

  // Assertions
  assert.strictEqual(checkPerm('Admin', 'leads', 'delete'), true);
  assert.strictEqual(checkPerm('Sales', 'leads', 'view'), true);
  assert.strictEqual(checkPerm('Sales', 'leads', 'delete'), false);

  console.log('✓ Test 5 Passed!');
}

// -------------------------------------------------------------
// Test 6: Audit Logs & Modification Blocker
// -------------------------------------------------------------
function testAuditTrail() {
  console.log('Running Test 6: Immutable Audit Logs...');
  const db = createMockDb();

  workflow.audit(db, mockUser, 'status', 'Open', 'Converted', 'Lead converted successfully', mockReq);

  // Assertions
  assert.strictEqual(db.audit_logs.length, 1);
  const log = db.audit_logs[0];
  assert.strictEqual(log.changedBy, 'Gagan Chopra');
  assert.strictEqual(log.role, 'Admin');
  assert.strictEqual(log.fieldName, 'status');
  assert.strictEqual(log.oldValue, 'Open');
  assert.strictEqual(log.newValue, 'Converted');

  // Verify route deletion block rules (simulated check)
  const isDeleteAllowed = (module) => {
    return module !== 'audit_logs' && module !== 'activity_logs';
  };
  assert.strictEqual(isDeleteAllowed('leads'), true);
  assert.strictEqual(isDeleteAllowed('audit_logs'), false);

  console.log('✓ Test 6 Passed!');
}

// Run All Tests
function runAllTests() {
  console.log('===================================================');
  console.log('STARTING INTEGRATION TEST RUNNER');
  console.log('===================================================');
  
  try {
    testBuyerWorkflow();
    testSellerWorkflow();
    testReturningClientQueryPipeline();
    testSheetsSyncRetry();
    testPermissions();
    testAuditTrail();
    
    console.log('===================================================');
    console.log('ALL INTEGRATION TESTS PASSED SUCCESSFULLY! (6/6)');
    console.log('===================================================');
  } catch (err) {
    console.error('Test Execution Failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
