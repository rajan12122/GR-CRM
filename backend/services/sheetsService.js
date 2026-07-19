const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { google } = require('googleapis');

const dbPath = path.join(__dirname, '../config/db.json');
const metadataPath = path.join(__dirname, '../config/metadata.json');

// Memory queue locks for concurrency protection
const queueLocks = {};
let isProcessingQueue = false;

function generateCleanShortId(mod, existingRecords = []) {
  const prefixMap = {
    properties: 'prop_',
    customers: 'cust_',
    leads: 'lead_',
    queries: 'quer_',
    follow_ups: 'flw_',
    deals: 'deal_',
    tasks: 'task_',
    employees: 'emp_',
    site_visits: 'sv_'
  };
  const prefix = prefixMap[mod] || `${mod.slice(0, 4)}_`;

  let maxNum = 1000;
  (existingRecords || []).forEach(r => {
    if (!r || !r.id) return;
    const strId = String(r.id);
    const match = strId.match(/\d{4,}$/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (!isNaN(num) && num < 1000000 && num > maxNum) {
        maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  return `${prefix}${nextNum}`;
}

// Helper to load sheets config from environment variables
function getSheetsConfig() {
  let metaConfig = {};
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    metaConfig = metadata.sheetsConfig || {};
  } catch (e) {}

  const spreadsheetId = (metaConfig.spreadsheetId && metaConfig.spreadsheetId.trim() !== '') 
    ? metaConfig.spreadsheetId.trim() 
    : (process.env.GOOGLE_SPREADSHEET_ID || '');

  const clientEmail = (metaConfig.clientEmail && metaConfig.clientEmail.trim() !== '') 
    ? metaConfig.clientEmail.trim() 
    : (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '');

  const privateKey = (metaConfig.privateKey && metaConfig.privateKey.trim() !== '') 
    ? metaConfig.privateKey.trim() 
    : (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '');

  const syncActive = metaConfig.syncActive !== undefined 
    ? Boolean(metaConfig.syncActive) 
    : (process.env.GOOGLE_SHEETS_SYNC_ACTIVE === 'true' || Boolean(spreadsheetId));

  return {
    syncActive,
    spreadsheetId,
    clientEmail,
    privateKey
  };
}

// Get Authenticated Google Sheets client
function getSheetsClient(config) {
  if (!config.spreadsheetId || !config.clientEmail || !config.privateKey) {
    return null;
  }
  try {
    const auth = new google.auth.JWT(
      config.clientEmail,
      null,
      config.privateKey.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    return google.sheets({ version: 'v4', auth });
  } catch (err) {
    console.error('Google Auth Init Failed in sheetsService:', err.message);
    return null;
  }
}

// Helper to get module headers
function getModuleHeaders(moduleName) {
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const fields = (metadata.modules[moduleName] && metadata.modules[moduleName].fields) || [];
    const headers = fields.map(f => f.name);
    if (!headers.includes('crm_id')) {
      headers.unshift('crm_id');
    }
    return headers;
  } catch (e) {
    return ['crm_id', 'id', 'name', 'status'];
  }
}

/**
 * Append ONLY the CRM assigned ID to the Google Sheet for new records.
 * Full data syncing is handled exclusively via Manual Sync (Push/Pull) per user requirement.
 */
async function appendCrmIdOnlyToSheet(moduleName, crmRecordId) {
  if (!crmRecordId) return;
  const config = getSheetsConfig();
  if (!config.syncActive) return;
  const sheets = getSheetsClient(config);
  if (!sheets || !config.spreadsheetId) return;

  try {
    const spreadsheetId = config.spreadsheetId;
    const sheetName = `data_${moduleName}`;
    
    // Get sheet metadata
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    let sheet = meta.data.sheets.find(s => s.properties.title === sheetName);

    if (!sheet) {
      const addRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }]
        }
      });
      sheet = addRes.data.replies[0].addSheet.properties;
    }

    const headers = getModuleHeaders(moduleName);

    // Read column A
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:A10000`
    });

    const sheetRows = getRes.data.values || [];

    // Write headers if sheet is empty
    if (sheetRows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] }
      });
      sheetRows.push(headers);
    }

    // Check if ID already present
    const exists = sheetRows.some(row => row[0] && String(row[0]).trim() === String(crmRecordId).trim());
    if (!exists) {
      const rowValues = [String(crmRecordId)];
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowValues] }
      });
    }
  } catch (err) {
    console.error(`[AutoSync ID Only] Failed to append ID ${crmRecordId} to ${moduleName}:`, err.message);
  }
}

/**
 * Auto-Sync entrypoint: ONLY writes/appends the assigned CRM record ID to Google Sheets.
 * Full row data syncing is done manually on user request to prevent duplicate writing.
 */
async function syncToSheets(moduleName, crmRecordId = null) {
  try {
    if (!crmRecordId) {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const records = db[moduleName] || [];
      if (records.length > 0) {
        crmRecordId = records[records.length - 1].id;
      }
    }
    if (crmRecordId) {
      await appendCrmIdOnlyToSheet(moduleName, crmRecordId);
    }
    return true;
  } catch (err) {
    console.error(`Failed to auto-sync ID for ${moduleName}:`, err.message);
    return null;
  }
}

/**
 * Process the JSON-db sync queue
 */
async function processSyncQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const config = getSheetsConfig();
    const sheets = getSheetsClient(config);
    if (!sheets) {
      isProcessingQueue = false;
      return;
    }

    const spreadsheetId = config.spreadsheetId;

    while (true) {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      db.sync_jobs = db.sync_jobs || [];
      const now = new Date().toISOString();

      // Find next pending or failed job to process
      const jobIndex = db.sync_jobs.findIndex(j => 
        (j.status === 'PENDING' || (j.status === 'FAILED' && j.attemptCount < j.maxAttempts)) &&
        (!j.nextAttemptAt || j.nextAttemptAt <= now)
      );

      if (jobIndex === -1) {
        break;
      }

      const job = db.sync_jobs[jobIndex];
      const lockKey = `${job.moduleName}`;

      if (queueLocks[lockKey]) {
        break; // Lock busy for this module
      }

      // Acquire Lock
      queueLocks[lockKey] = true;
      job.status = 'PROCESSING';
      job.updatedAt = new Date().toISOString();
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

      try {
        const sheetName = `data_${job.moduleName}`;
        
        // Retrieve spreadsheet metadata
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        let sheet = meta.data.sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
          // Auto create sheet if missing
          const addRes = await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{ addSheet: { properties: { title: sheetName } } }]
            }
          });
          sheet = addRes.data.replies[0].addSheet.properties;
        }

        const sheetId = sheet.properties ? sheet.properties.sheetId : sheet.sheetId;
        const headers = getModuleHeaders(job.moduleName);
        const dbRecords = db[job.moduleName] || [];

        // Execute row-level comparative sync
        await syncModuleRowLevel(sheets, spreadsheetId, sheetName, sheetId, dbRecords, headers);

        // Update job to success
        const updatedDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const freshJob = updatedDb.sync_jobs.find(j => j.id === job.id);
        if (freshJob) {
          freshJob.status = 'SUCCESS';
          freshJob.syncedAt = new Date().toISOString();
          freshJob.updatedAt = new Date().toISOString();
          freshJob.lastError = null;
          fs.writeFileSync(dbPath, JSON.stringify(updatedDb, null, 2), 'utf8');
        }

      } catch (err) {
        console.error(`[Queue Worker] Sync job ${job.id} failed:`, err.message);

        const updatedDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const freshJob = updatedDb.sync_jobs.find(j => j.id === job.id);
        if (freshJob) {
          freshJob.attemptCount += 1;
          freshJob.lastError = err.message;
          freshJob.updatedAt = new Date().toISOString();

          if (freshJob.attemptCount >= freshJob.maxAttempts) {
            freshJob.status = 'FAILED';
          } else {
            // Exponential backoff
            const delaySec = Math.pow(2, freshJob.attemptCount) * 10;
            freshJob.nextAttemptAt = new Date(Date.now() + delaySec * 1000).toISOString();
          }
          fs.writeFileSync(dbPath, JSON.stringify(updatedDb, null, 2), 'utf8');
        }
      } finally {
        delete queueLocks[lockKey];
      }
    }
  } catch (err) {
    console.error('[Queue Worker] Error running processing loop:', err.message);
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Performs comparison and row-level updates/deletes/creations
 */
async function syncModuleRowLevel(sheets, spreadsheetId, sheetName, sheetId, dbRecords, headers) {
  // Fetch columns up to Column Z
  const getRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z10000`
  });

  const sheetRows = getRes.data.values || [];

  // Write headers if sheet is empty
  if (sheetRows.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] }
    });
    sheetRows.push(headers);
  }

  // 1. Scan DB records and determine what to write or update
  for (const record of dbRecords) {
    let matchedRowIndex = -1;
    let isIdentical = false;

    const rowValues = headers.map(h => {
      if (h === 'crm_id') return String(record.id);
      const val = record[h];
      if (val === undefined || val === null) return '';
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    });

    for (let i = 1; i < sheetRows.length; i++) {
      if (sheetRows[i][0] === String(record.id)) {
        matchedRowIndex = i + 1; // 1-indexed

        // Compare values
        isIdentical = true;
        for (let j = 0; j < headers.length; j++) {
          const sheetVal = sheetRows[i][j] !== undefined ? String(sheetRows[i][j]) : '';
          const recordVal = rowValues[j];
          if (sheetVal !== recordVal) {
            isIdentical = false;
            break;
          }
        }
        break;
      }
    }

    if (matchedRowIndex !== -1) {
      if (!isIdentical) {
        // Update row
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A${matchedRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [rowValues] }
        });
      }
    } else {
      // Append row
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowValues] }
      });
    }
  }

  // 2. Scan Sheet rows and physically delete any missing keys (Soft-delete / Sync delete)
  const deleteRowIndices = [];
  for (let i = 1; i < sheetRows.length; i++) {
    const crmId = sheetRows[i][0];
    if (crmId && !dbRecords.some(r => String(r.id) === String(crmId))) {
      deleteRowIndices.push(i + 1);
    }
  }

  // Delete from bottom to top to preserve correct indices
  deleteRowIndices.sort((a, b) => b - a);
  for (const index of deleteRowIndices) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: index - 1,
              endIndex: index
            }
          }
        }]
      }
    });
  }
}

/**
 * Compatibility function (Sync From Sheets) with explicit verification
 */
async function syncFromSheets() {
  console.log('Direct automated imports are deprecated. Please use the Sync Dashboard Reconcile feature.');
  return false;
}

async function manualPushToSheets(moduleName, syncMode = 'edited_only') {
  const config = getSheetsConfig();
  const sheets = getSheetsClient(config);
  if (!sheets) {
    throw new Error('Google Sheets sync is inactive or missing credentials.');
  }

  const spreadsheetId = config.spreadsheetId;
  const { readDb } = require('../config/db');
  const db = readDb();

  const metadataPath = path.join(__dirname, '../config/metadata.json');
  let validModules = [];
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    validModules = Object.keys(metadata.modules || {});
  } catch (e) {
    validModules = ['customers', 'leads', 'properties', 'queries', 'follow_ups', 'deals', 'tasks', 'employees'];
  }

  const targetModules = moduleName === 'all' ? validModules : [moduleName];

  let totalUpdated = 0;
  let totalCreated = 0;

  for (const mod of targetModules) {
    const sheetName = `data_${mod}`;
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    let sheet = meta.data.sheets.find(s => s.properties.title === sheetName);

    if (!sheet) {
      const addRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] }
      });
      sheet = addRes.data.replies[0].addSheet.properties;
    }

    const headers = getModuleHeaders(mod);
    const dbRecords = (db[mod] || []).filter(r => !r.deletedAt);

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z10000`
    });

    const sheetRows = getRes.data.values || [];

    if (sheetRows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] }
      });
      sheetRows.push(headers);
    }

    for (const record of dbRecords) {
      let matchedRowIndex = -1;
      let isIdentical = false;

      const rowValues = headers.map(h => {
        if (h === 'crm_id') return String(record.id);
        const val = record[h];
        if (val === undefined || val === null) return '';
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      });

      for (let i = 1; i < sheetRows.length; i++) {
        if (sheetRows[i][0] === String(record.id)) {
          matchedRowIndex = i + 1;
          isIdentical = true;
          for (let j = 0; j < headers.length; j++) {
            const sheetVal = sheetRows[i][j] !== undefined ? String(sheetRows[i][j]) : '';
            const recordVal = rowValues[j];
            if (sheetVal !== recordVal) {
              isIdentical = false;
              break;
            }
          }
          break;
        }
      }

      if (matchedRowIndex !== -1) {
        if (!isIdentical || syncMode === 'full') {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A${matchedRowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowValues] }
          });
          totalUpdated++;
        }
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A:A`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [rowValues] }
        });
        totalCreated++;
      }
    }
  }

  return { success: true, mode: syncMode, moduleName, updatedRecords: totalUpdated, createdRecords: totalCreated };
}

async function manualPullFromSheets(moduleName, syncMode = 'edited_only') {
  const config = getSheetsConfig();
  const sheets = getSheetsClient(config);
  if (!sheets) {
    throw new Error('Google Sheets sync is inactive or missing credentials.');
  }

  const spreadsheetId = config.spreadsheetId;
  const { readDb, writeDb } = require('../config/db');
  const db = readDb();

  const metadataPath = path.join(__dirname, '../config/metadata.json');
  let validModules = [];
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    validModules = Object.keys(metadata.modules || {});
  } catch (e) {
    validModules = ['customers', 'leads', 'properties', 'queries', 'follow_ups', 'deals', 'tasks', 'employees'];
  }

  const targetModules = moduleName === 'all' ? validModules : [moduleName];

  let totalUpdated = 0;
  let totalCreated = 0;

  for (const mod of targetModules) {
    db[mod] = db[mod] || [];
    const sheetName = `data_${mod}`;

    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z10000`
      });
    } catch (e) {
      continue;
    }

    const rows = response.data.values;
    if (!rows || rows.length <= 1) continue;

    const headers = rows[0].map(h => String(h || '').trim());
    const idIndex = headers.findIndex(h => ['crm_id', 'id', 'ID', 'Id', 'crmId'].includes(h));

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !Array.isArray(row) || row.length === 0) continue;

      const hasContent = row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
      if (!hasContent) continue;

      const rawCrmId = (idIndex !== -1 && row[idIndex] !== undefined) ? String(row[idIndex]).trim() : '';

      const sheetRecord = {};
      headers.forEach((h, idx) => {
        if (!h || ['crm_id', 'id', 'ID', 'Id', 'crmId'].includes(h)) return;
        let val = row[idx] !== undefined ? row[idx] : '';
        if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
          try { val = JSON.parse(val); } catch(e) {}
        }
        if (val !== '' && !isNaN(val) && typeof val === 'string' && val.trim() !== '') {
          const num = Number(val);
          if (!isNaN(num)) val = num;
        }
        sheetRecord[h] = val;
      });

      if (mod === 'properties' && !sheetRecord.propertyName && sheetRecord.contact_person_name) {
        sheetRecord.propertyName = `Property - ${sheetRecord.contact_person_name}`;
      }

      if (rawCrmId) {
        const existingIdx = db[mod].findIndex(r => String(r.id) === String(rawCrmId));
        if (existingIdx !== -1) {
          const existingRec = db[mod][existingIdx];
          let isChanged = false;
          Object.keys(sheetRecord).forEach(k => {
            const sheetVal = sheetRecord[k];
            const crmVal = existingRec[k];
            const strSheet = typeof sheetVal === 'object' ? JSON.stringify(sheetVal) : String(sheetVal ?? '');
            const strCrm = typeof crmVal === 'object' ? JSON.stringify(crmVal) : String(crmVal ?? '');
            if (strSheet.trim() !== strCrm.trim() && sheetVal !== '') {
              isChanged = true;
            }
          });

          if (isChanged || syncMode === 'full') {
            db[mod][existingIdx] = { ...existingRec, ...sheetRecord, updatedAt: new Date().toISOString() };
            totalUpdated++;
          }
        } else {
          db[mod].push({ id: rawCrmId, ...sheetRecord, createdAt: new Date().toISOString() });
          totalCreated++;
        }
      } else {
        const newId = generateCleanShortId(mod, db[mod]);
        db[mod].push({ id: newId, ...sheetRecord, createdAt: new Date().toISOString() });
        totalCreated++;
      }
    }
  }

  writeDb(db);

  return { success: true, mode: syncMode, moduleName, updatedRecords: totalUpdated, createdRecords: totalCreated };
}

// Background daemon interval polling
setInterval(() => {
  processSyncQueue();
}, 15000);

module.exports = {
  syncToSheets,
  syncFromSheets,
  getSheetsConfig,
  processSyncQueue,
  manualPushToSheets,
  manualPullFromSheets
};
