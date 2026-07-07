const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { syncToSheets, syncFromSheets, getSheetsConfig } = require('./services/sheetsService');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'GR_CRM_SUPER_SECRET_KEY';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const metadataPath = path.join(__dirname, 'config/metadata.json');
const dbPath = path.join(__dirname, 'config/db.json');

// Ensure database files exist on boot
if (!fs.existsSync(metadataPath)) {
  console.error("Critical Error: config/metadata.json missing!");
}
if (!fs.existsSync(dbPath)) {
  console.error("Critical Error: config/db.json missing!");
}

// Sync from Google Sheets on start if credentials exist
syncFromSheets().then(res => {
  if (res) console.log('Initial Google Sheets sync completed on boot.');
  else console.log('Running on local JSON database cache.');
});

// Helper functions to read/write DB and Metadata
function readDb() {
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

function readMetadata() {
  return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
}

function writeMetadata(data) {
  fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2), 'utf8');
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Authentication token required.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// Role-based Access Control Middleware
function checkPermission(moduleName, action) {
  return (req, res, next) => {
    const metadata = readMetadata();
    const role = req.user.role;
    
    const permissions = metadata.rolesPermissions[role];
    if (!permissions) {
      return res.status(403).json({ message: 'Role has no permissions configured.' });
    }

    const modulePerms = permissions[moduleName] || [];
    if (modulePerms.includes(action) || role === 'Admin') {
      return next();
    }

    return res.status(403).json({ message: `Insufficient permissions to perform '${action}' on '${moduleName}' module.` });
  };
}

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required.' });
  }

  const db = readDb();
  const employee = db.employees.find(emp => emp.email.toLowerCase() === email.toLowerCase());

  if (!employee) {
    return res.status(404).json({ message: 'No employee account found with this email.' });
  }

  if (employee.status !== 'Active') {
    return res.status(403).json({ message: 'Employee account is inactive.' });
  }

  // Authenticate against database password, fall back to seed password if undefined.
  const storedPassword = employee.password || (employee.role === 'Admin' ? 'admin123' : 'pass123');
  const isValidPassword = password === storedPassword;
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const token = jwt.sign(
    { id: employee.id, name: employee.name, email: employee.email, role: employee.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, user: employee });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const db = readDb();
  const employee = db.employees.find(emp => emp.id === req.user.id);
  if (!employee) return res.status(404).json({ message: 'Profile not found.' });
  res.json(employee);
});

// --- METADATA ROUTES (Schema changes) ---

app.get('/api/metadata', authenticateToken, (req, res) => {
  const metadata = readMetadata();
  const { role } = req.user;

  // Filter modules based on role's custom field permissions
  if (role !== 'Admin' && metadata.fieldPermissions && metadata.fieldPermissions[role]) {
    const roleFieldPerms = metadata.fieldPermissions[role];
    const filteredMetadata = JSON.parse(JSON.stringify(metadata));
    
    Object.keys(filteredMetadata.modules).forEach(moduleName => {
      const allowedFields = roleFieldPerms[moduleName];
      if (allowedFields) {
        const moduleObj = filteredMetadata.modules[moduleName];
        moduleObj.fields = moduleObj.fields.filter(f => allowedFields.includes(f.name));
      }
    });
    return res.json(filteredMetadata);
  }

  res.json(metadata);
});

app.post('/api/metadata', authenticateToken, checkPermission('settings', 'edit'), (req, res) => {
  try {
    const newMetadata = req.body;
    writeMetadata(newMetadata);
    res.json({ success: true, message: 'Metadata schema saved successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to write metadata: ' + error.message });
  }
});

// --- DYNAMIC DATA CRUD ROUTER ---

app.get('/api/data/:module', authenticateToken, (req, res, next) => {
  const { module } = req.params;
  
  if (module === 'activity_logs') {
    return next();
  }

  const metadata = readMetadata();
  if (!metadata.modules[module]) {
    return res.status(404).json({ message: `Module '${module}' does not exist.` });
  }
  next();
}, (req, res, next) => {
  const { module } = req.params;
  if (module === 'activity_logs') {
    return next();
  }
  checkPermission(module, 'view')(req, res, next);
}, (req, res) => {
  const { module } = req.params;
  const { role } = req.user;
  const db = readDb();
  const records = db[module] || [];
  
  // Apply field-level filtering for non-Admin roles
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
        return filteredRecord;
      });
      return res.json(filteredRecords);
    }
  }

  res.json(records);
});

app.post('/api/data/:module', authenticateToken, (req, res, next) => {
  const { module } = req.params;
  checkPermission(module, 'create')(req, res, next);
}, async (req, res) => {
  const { module } = req.params;
  const db = readDb();
  const payload = req.body;

  // Generate automated primary key if not provided (e.g. CUST-003)
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
      daily_prices: 'PRICE'
    };
    const prefix = prefixMap[module] || module.substring(0, 4).toUpperCase();
    
    // Find max number among existing IDs starting with this prefix
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

  // Populate basic date tracker if applicable
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
  });

  if (!db[module]) db[module] = [];
  db[module].push(payload);
  
  // Track Activity Log
  const log = {
    id: `LOG-${Date.now()}`,
    employeeName: req.user.name,
    action: `Created record ${payload.id} in ${module}`,
    dateTime: new Date().toLocaleString()
  };
  if (!db.activity_logs) db.activity_logs = [];
  db.activity_logs.unshift(log);

  writeDb(db);

  // Sync back to Google sheets asynchronously
  syncToSheets(module);
  res.status(201).json(payload);
});

app.put('/api/data/:module/:id', authenticateToken, (req, res, next) => {
  const { module } = req.params;
  checkPermission(module, 'edit')(req, res, next);
}, async (req, res) => {
  const { module, id } = req.params;
  const db = readDb();
  const payload = req.body;

  if (!db[module]) return res.status(404).json({ message: `Module ${module} is empty.` });
  
  const index = db[module].findIndex(rec => String(rec.id) === String(id));
  if (index === -1) return res.status(404).json({ message: `Record ${id} not found.` });

  // Auto-update last_updated date on edits
  const metadata = readMetadata();
  const fields = metadata.modules[module].fields;
  fields.forEach(f => {
    if (f.name === 'last_updated') {
      payload[f.name] = new Date().toLocaleString('en-IN');
    }
  });

  // Update record preserving fixed identifiers
  db[module][index] = { ...db[module][index], ...payload, id };

  // Track Activity Log
  const log = {
    id: `LOG-${Date.now()}`,
    employeeName: req.user.name,
    action: `Updated record ${id} in ${module}`,
    dateTime: new Date().toLocaleString()
  };
  if (!db.activity_logs) db.activity_logs = [];
  db.activity_logs.unshift(log);

  writeDb(db);

  // Sync to Google sheets
  syncToSheets(module);
  res.json(db[module][index]);
});

app.delete('/api/data/:module/:id', authenticateToken, (req, res, next) => {
  const { module } = req.params;
  checkPermission(module, 'delete')(req, res, next);
}, async (req, res) => {
  const { module, id } = req.params;
  const db = readDb();

  if (!db[module]) return res.status(404).json({ message: `Module ${module} is empty.` });

  const index = db[module].findIndex(rec => String(rec.id) === String(id));
  if (index === -1) return res.status(404).json({ message: `Record ${id} not found.` });

  db[module].splice(index, 1);

  // Track Activity Log
  const log = {
    id: `LOG-${Date.now()}`,
    employeeName: req.user.name,
    action: `Deleted record ${id} in ${module}`,
    dateTime: new Date().toLocaleString()
  };
  if (!db.activity_logs) db.activity_logs = [];
  db.activity_logs.unshift(log);

  writeDb(db);

  // Sync to Google sheets
  syncToSheets(module);
  res.json({ success: true, message: `Record ${id} deleted successfully.` });
});

// --- EMPLOYEE LOCATION TRACKING SYSTEM ---

// Log location entry
app.post('/api/location/log', authenticateToken, (req, res) => {
  const { employeeId, employeeName, latitude, longitude, status } = req.body;
  const db = readDb();
  
  if (!db.location_logs) db.location_logs = [];
  
  const logEntry = {
    id: `LOC-${Date.now()}`,
    employeeId,
    employeeName,
    latitude,  // Encrypted from frontend
    longitude, // Encrypted from frontend
    status,    // 'sharing' or 'ended'
    timestamp: new Date().toISOString()
  };
  
  db.location_logs.push(logEntry);
  writeDb(db);
  res.json({ success: true, log: logEntry });
});

// Fetch active location logs
app.get('/api/location/active', authenticateToken, (req, res) => {
  const db = readDb();
  const logs = db.location_logs || [];
  
  // Find the latest entry for each employee
  const activeLocs = {};
  logs.forEach(log => {
    const empId = log.employeeId;
    if (!activeLocs[empId] || new Date(log.timestamp) > new Date(activeLocs[empId].timestamp)) {
      activeLocs[empId] = log;
    }
  });
  
  // Only return those who are actively 'sharing'
  const result = Object.values(activeLocs).filter(loc => loc.status === 'sharing');
  res.json(result);
});

// --- GLOBAL 360° SEARCH ENGINE ---

app.get('/api/search', authenticateToken, (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === '') {
    return res.json({ results: {}, connections: {} });
  }

  const query = q.toLowerCase().trim();
  const keywords = query.split(/\s+/).filter(word => word.length > 0);
  const db = readDb();
  const metadata = readMetadata();
  const results = {};

  // 1. Search all dynamic tables
  Object.keys(metadata.modules).forEach(moduleName => {
    // Check if role has access to this module
    const userRole = req.user.role;
    const permissions = metadata.rolesPermissions[userRole] || {};
    const modulePerms = permissions[moduleName] || [];
    if (userRole !== 'Admin' && !modulePerms.includes('view')) {
      return; // Skip search if role cannot view this module
    }

    const records = db[moduleName] || [];
    
    // Filter matching records (only search inside allowed fields)
    const matchedRecords = records.filter(rec => {
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
      // Filter out restricted keys from search results
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

  // 2. Resolve Relationships for 360 view if exactly one entity matches, or a detailed query matches
  // Let's build a unified connection profile if there is a primary query focus (e.g. employeeId, propertyId, customerId)
  // Or just query related sub-tables:
  const connections = {};
  
  // Find connected records for properties, customers, employees if searched
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

  // Helper to link records
  const getConnectedData = (type, id) => {
    const data = {};
    if (type === 'employees') {
      data.attendance = allAttendance.filter(a => a.employeeId === id);
      data.leaves = allLeaves.filter(l => l.employeeId === id);
      data.customers = allCustomers.filter(c => c.assignedEmployeeId === id);
      data.properties = allProperties.filter(p => p.assignedEmployeeId === id);
      data.tasks = allTasks.filter(t => t.assignedTo === id);
      data.remarks = allRemarks.filter(r => r.targetModule === 'employees' && r.targetId === id);
      data.documents = allDocs.filter(d => d.targetModule === 'employees' && d.targetId === id);
    } else if (type === 'customers') {
      const cust = allCustomers.find(c => String(c.id) === String(id));
      data.employee = allEmployees.find(e => String(e.id) === String(cust && cust.assignedEmployeeId));
      data.site_visits = allSiteVisits.filter(s => String(s.customerId) === String(id)).map(sv => ({
        ...sv,
        property: allProperties.find(p => String(p.id) === String(sv.propertyId))
      }));
      data.follow_ups = allFollowUps.filter(f => String(f.customerId) === String(id));
      data.tasks = allTasks.filter(t => t.title.toLowerCase().includes(String(id).toLowerCase()) || (t.description && t.description.toLowerCase().includes(String(id).toLowerCase())));
      data.sales = allSales.filter(s => String(s.customerId) === String(id)).map(sa => ({
        ...sa,
        property: allProperties.find(p => String(p.id) === String(sa.propertyId))
      }));
      data.remarks = allRemarks.filter(r => r.targetModule === 'customers' && String(r.targetId) === String(id));
      data.documents = allDocs.filter(d => d.targetModule === 'customers' && String(d.targetId) === String(id));
    } else if (type === 'properties') {
      const prop = allProperties.find(p => String(p.id) === String(id));
      data.employee = allEmployees.find(e => String(e.id) === String(prop && prop.assignedEmployeeId));
      data.site_visits = allSiteVisits.filter(s => String(s.propertyId) === String(id)).map(sv => ({
        ...sv,
        customer: allCustomers.find(c => String(c.id) === String(sv.customerId))
      }));
      data.sales = allSales.filter(s => String(s.propertyId) === String(id));
      data.remarks = allRemarks.filter(r => r.targetModule === 'properties' && String(r.targetId) === String(id));
      data.documents = allDocs.filter(d => d.targetModule === 'properties' && String(d.targetId) === String(id));
      // Track views (represented by distinct site visits + customer expressions)
      data.viewsCount = data.site_visits.length;
      data.viewedBy = data.site_visits.map(v => v.customer).filter(Boolean);
    }
    return data;
  };

  // If search matches are small, pre-resolve their relations
  const firstModule = Object.keys(results)[0];
  if (firstModule && ['employees', 'customers', 'properties'].includes(firstModule) && results[firstModule].length === 1) {
    const record = results[firstModule][0];
    connections[record.id] = getConnectedData(firstModule, record.id);
  }

  res.json({ results, connections });
});

// GET Relationship Data for Single Record Details Page (Salesforce 360 style)
app.get('/api/360/:module/:id', authenticateToken, (req, res) => {
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

  const data = {};
  if (module === 'employees') {
    data.attendance = allAttendance.filter(a => a.employeeId === id);
    data.leaves = allLeaves.filter(l => l.employeeId === id);
    data.customers = allCustomers.filter(c => c.assignedEmployeeId === id);
    data.properties = allProperties.filter(p => p.assignedEmployeeId === id);
    data.tasks = allTasks.filter(t => t.assignedTo === id);
    data.remarks = allRemarks.filter(r => r.targetModule === 'employees' && r.targetId === id);
    data.documents = allDocs.filter(d => d.targetModule === 'employees' && d.targetId === id);
  } else if (module === 'customers') {
    const cust = allCustomers.find(c => String(c.id) === String(id));
    data.employee = allEmployees.find(e => String(e.id) === String(cust && cust.assignedEmployeeId));
    data.site_visits = allSiteVisits.filter(s => String(s.customerId) === String(id)).map(sv => ({
      ...sv,
      property: allProperties.find(p => String(p.id) === String(sv.propertyId))
    }));
    data.follow_ups = allFollowUps.filter(f => String(f.customerId) === String(id));
    data.sales = allSales.filter(s => String(s.customerId) === String(id)).map(sa => ({
      ...sa,
      property: allProperties.find(p => String(p.id) === String(sa.propertyId))
    }));
    data.remarks = allRemarks.filter(r => r.targetModule === 'customers' && String(r.targetId) === String(id));
    data.documents = allDocs.filter(d => d.targetModule === 'customers' && String(d.targetId) === String(id));
  } else if (module === 'properties') {
    const prop = allProperties.find(p => String(p.id) === String(id));
    data.employee = allEmployees.find(e => String(e.id) === String(prop && prop.assignedEmployeeId));
    data.site_visits = allSiteVisits.filter(s => String(s.propertyId) === String(id)).map(sv => ({
      ...sv,
      customer: allCustomers.find(c => String(c.id) === String(sv.customerId))
    }));
    data.sales = allSales.filter(s => String(s.propertyId) === String(id));
    data.remarks = allRemarks.filter(r => r.targetModule === 'properties' && String(r.targetId) === String(id));
    data.documents = allDocs.filter(d => d.targetModule === 'properties' && String(d.targetId) === String(id));
    data.viewsCount = data.site_visits.length;
    data.viewedBy = data.site_visits.map(v => v.customer).filter(Boolean);
  } else {
    // Basic fallback for other tables: search remarks and documents linked to them
    data.remarks = allRemarks.filter(r => r.targetModule === module && r.targetId === id);
    data.documents = allDocs.filter(d => d.targetModule === module && d.targetId === id);
  }

  res.json(data);
});

// --- REMARKS TIMELINE SYSTEM ---

app.get('/api/remarks/:module/:id', authenticateToken, (req, res) => {
  const { module, id } = req.params;
  const db = readDb();
  const remarks = (db.remarks || []).filter(rem => rem.targetModule === module && rem.targetId === id);
  res.json(remarks);
});

app.post('/api/remarks', authenticateToken, async (req, res) => {
  const { targetModule, targetId, comment } = req.body;
  if (!targetModule || !targetId || !comment) {
    return res.status(400).json({ message: 'Target module, record ID and comment text are required.' });
  }

  const db = readDb();
  const newRemark = {
    id: `REM-${Date.now()}`,
    targetModule,
    targetId,
    employeeName: req.user.name,
    dateTime: new Date().toLocaleString(),
    comment
  };

  if (!db.remarks) db.remarks = [];
  db.remarks.push(newRemark);
  writeDb(db);

  // Sync to sheets
  syncToSheets('remarks');
  res.status(201).json(newRemark);
});

// --- DOCUMENT SYSTEM ---

app.post('/api/documents', authenticateToken, (req, res) => {
  const { targetModule, targetId, name, fileUrl } = req.body;
  if (!targetModule || !targetId || !name) {
    return res.status(400).json({ message: 'Target module, record ID, and document name required.' });
  }

  const db = readDb();
  const newDoc = {
    id: `DOC-${Date.now()}`,
    targetModule,
    targetId,
    name,
    fileUrl: fileUrl || '/uploads/sample_doc.pdf',
    uploadedBy: req.user.name,
    dateAdded: new Date().toISOString().split('T')[0]
  };

  if (!db.documents) db.documents = [];
  db.documents.push(newDoc);
  writeDb(db);

  syncToSheets('documents');
  res.status(201).json(newDoc);
});

// --- SETTINGS / SHEET CONTROL ---

app.post('/api/settings/test-sheets', authenticateToken, checkPermission('settings', 'edit'), async (req, res) => {
  try {
    const success = await syncFromSheets();
    if (success) {
      res.json({ success: true, message: 'Google Sheets sync successful! Data pulled successfully.' });
    } else {
      res.status(400).json({ message: 'Failed to sync. Make sure spreadsheet ID and API Credentials are correct and Sheet Sync is active.' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error checking sheets: ' + err.message });
  }
});

app.post('/api/settings/sync-now', authenticateToken, checkPermission('settings', 'edit'), async (req, res) => {
  try {
    // 1. Pull data from sheets
    await syncFromSheets();
    
    // 2. Push all local changes back
    const metadata = readMetadata();
    const modulesToSync = Object.keys(metadata.modules);
    
    for (const mod of modulesToSync) {
      await syncToSheets(mod);
    }
    
    // Sync special shared tables
    await syncToSheets('remarks');
    await syncToSheets('documents');

    res.json({ success: true, message: 'Full bidirectional Google Sheets sync finished.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed full sync: ' + err.message });
  }
});

// --- LEAD ROTATION AUTO-REASSIGNMENT SCHEDULER ---
const rotateLeadsTask = () => {
  try {
    const metadata = readMetadata();
    const config = metadata.automationConfig || { leadRotationActive: true, rotationHours: 24 };
    
    // Check if lead rotation engine is active
    if (!config.leadRotationActive) return;

    const db = readDb();
    const leads = db.leads || [];
    // Only assign to active employees with 'Sales' or 'Employee' roles
    const employees = (db.employees || []).filter(e => e.status === 'Active' && (e.role === 'Sales' || e.role === 'Employee'));
    if (employees.length === 0) return;
    
    const remarks = db.remarks || [];
    const now = Date.now();
    
    // Inactivity rotation threshold (read dynamically from config)
    const rotationHours = parseFloat(config.rotationHours) || 24;
    const ROTATION_TIMEOUT = rotationHours * 60 * 60 * 1000; 
    const rotatedSources = config.rotatedSources || [];
    
    let dbChanged = false;
    
    leads.forEach(lead => {
      // Skip finalized leads
      if (lead.status === 'Won' || lead.status === 'Closed' || lead.status === 'Lost') return;
      
      // Skip if rotation is explicitly disabled for this specific lead
      if (lead.enableRotation === false) return;
      
      // Skip rotation if this source is not enabled in preferences
      if (rotatedSources.length > 0 && !rotatedSources.includes(lead.source)) return;
      
      // Calculate baseline activity time
      let lastActionTime = new Date(lead.dateAdded || new Date()).getTime();
      
      // Find latest remark follow-up
      const leadRemarks = remarks.filter(r => r.targetModule === 'leads' && String(r.targetId) === String(lead.id));
      if (leadRemarks.length > 0) {
        const latestRemark = leadRemarks.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date))[0];
        lastActionTime = new Date(latestRemark.timestamp || latestRemark.date).getTime();
      }
      
      if (now - lastActionTime > ROTATION_TIMEOUT) {
        // Filter rotation assignment pool by lead's preferred employees list if set
        let pool = employees;
        if (lead.preferredEmployees) {
          const preferredIds = String(lead.preferredEmployees).split(',').map(id => id.trim()).filter(Boolean);
          if (preferredIds.length > 0) {
            const eligibleEmps = employees.filter(e => preferredIds.includes(String(e.id)));
            if (eligibleEmps.length > 0) {
              pool = eligibleEmps;
            }
          }
        }

        const currentEmpId = lead.assignedEmployeeId;
        const currentIndex = pool.findIndex(e => String(e.id) === String(currentEmpId));
        
        // Find next employee index from the pool
        const nextIndex = (currentIndex + 1) % pool.length;
        const nextEmp = pool[nextIndex];
        
        if (nextEmp && String(nextEmp.id) !== String(currentEmpId)) {
          lead.assignedEmployeeId = nextEmp.id;
          
          // Append system audit remark noting the rotation
          if (!db.remarks) db.remarks = [];
          db.remarks.push({
            id: `REM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            targetModule: 'leads',
            targetId: lead.id,
            comment: `System: Lead rotated automatically from ${pool[currentIndex]?.name || 'unassigned'} to ${nextEmp.name} due to inactivity.`,
            author: 'System Rotation Engine',
            date: new Date().toLocaleDateString('en-IN'),
            timestamp: new Date().toISOString()
          });
          
          // Log recent activity update
          if (!db.activity_logs) db.activity_logs = [];
          db.activity_logs.unshift({
            user: 'System',
            action: `Auto-rotated Lead "${lead.name}" to ${nextEmp.name} (inactivity)`,
            timestamp: new Date().toISOString()
          });
          
          dbChanged = true;
        }
      }
    });
    
    if (dbChanged) {
      writeDb(db);
    }
  } catch (err) {
    console.error('Lead Rotation Scheduler Error:', err);
  }
};

// Start background task: Check immediately after 10 seconds, and run every 5 minutes
setTimeout(rotateLeadsTask, 10000);
setInterval(rotateLeadsTask, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Gagan Realtech ERP+CRM API Server running on port ${PORT}`);
});
