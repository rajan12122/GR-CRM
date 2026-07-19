const { google } = require('googleapis');
const crypto = require('crypto');
const { readDb, writeDb } = require('../config/db');
const { syncToSheets, getSheetsConfig, processSyncQueue } = require('../services/sheetsService');

function getSyncMetrics(req, res) {
  const db = readDb();
  const jobs = db.sync_jobs || [];

  const metrics = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, { PENDING: 0, PROCESSING: 0, SUCCESS: 0, FAILED: 0 });

  res.json({ success: true, metrics });
}

function getSyncJobs(req, res) {
  const db = readDb();
  const jobs = db.sync_jobs || [];
  const sortedJobs = [...jobs].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ success: true, data: sortedJobs.slice(0, 100) });
}

function retrySyncJob(req, res) {
  const { jobId } = req.params;
  const db = readDb();
  db.sync_jobs = db.sync_jobs || [];

  const job = db.sync_jobs.find(j => j.id === jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Sync job not found.' });
  }

  job.status = 'PENDING';
  job.attemptCount = 0;
  job.lastError = null;
  job.updatedAt = new Date().toISOString();
  job.nextAttemptAt = new Date().toISOString();

  writeDb(db);
  setImmediate(() => processSyncQueue());

  res.json({ success: true, message: 'Sync job enqueued for immediate retry.' });
}

async function reconcilePreview(req, res) {
  const { module } = req.params;
  const db = readDb();

  const config = getSheetsConfig();
  const email = config.clientEmail;
  const privateKey = config.privateKey;
  const spreadsheetId = config.spreadsheetId;

  if (!email || !privateKey || !spreadsheetId) {
    return res.status(400).json({ success: false, message: 'Google Sheets sync configuration or environment variables are inactive.' });
  }

  try {
    const auth = new google.auth.JWT(
      email,
      null,
      privateKey.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetName = `data_${module}`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z10000`
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return res.json({ success: true, message: 'Sheet is empty or has only headers.', changes: [] });
    }

    const headers = rows[0];
    const crmIdIndex = headers.indexOf('crm_id');
    if (crmIdIndex === -1) {
      return res.status(400).json({ success: false, message: 'Google Sheet is missing the required crm_id column in A1.' });
    }

    const changes = [];
    const dbRecords = db[module] || [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const crmId = row[crmIdIndex];
      const sheetRecord = {};
      headers.forEach((h, idx) => {
        let val = row[idx] !== undefined ? row[idx] : '';
        if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
          try { val = JSON.parse(val); } catch(e) {}
        }
        if (val !== '' && !isNaN(val) && val.trim && val.trim() !== '') {
          val = Number(val);
        }
        sheetRecord[h] = val;
      });

      const matchedDbRecord = dbRecords.find(r => String(r.id) === String(crmId));
      let validationError = null;
      let conflictFields = [];

      if (sheetRecord.assignedEmployeeId) {
        const empExists = (db.employees || []).some(e => String(e.id) === String(sheetRecord.assignedEmployeeId));
        if (!empExists) {
          validationError = `Assigned Exec ID '${sheetRecord.assignedEmployeeId}' does not exist in CRM database.`;
        }
      }
      if (sheetRecord.phone) {
        const cleanPhone = String(sheetRecord.phone).trim();
        if (cleanPhone.length > 0 && (cleanPhone.length < 10 || isNaN(Number(cleanPhone)))) {
          validationError = `Invalid phone number format: '${sheetRecord.phone}'. Must be a 10-digit number.`;
        }
      }

      if (matchedDbRecord) {
        Object.keys(sheetRecord).forEach(k => {
          if (k === 'crm_id') return;
          const sheetVal = sheetRecord[k];
          const dbVal = matchedDbRecord[k];
          const stringSheet = typeof sheetVal === 'object' ? JSON.stringify(sheetVal) : String(sheetVal || '');
          const stringDb = typeof dbVal === 'object' ? JSON.stringify(dbVal) : String(dbVal || '');
          if (stringSheet.trim() !== stringDb.trim()) {
            conflictFields.push({
              field: k,
              sheetValue: sheetVal,
              crmValue: dbVal
            });
          }
        });

        if (conflictFields.length > 0) {
          changes.push({
            type: 'CONFLICT',
            crmRecordId: crmId,
            name: matchedDbRecord.name || matchedDbRecord.person_name || matchedDbRecord.propertyName || crmId,
            conflicts: conflictFields,
            validationError,
            sheetRecord
          });
        }
      } else {
        changes.push({
          type: 'UNLINKED_ROW',
          crmRecordId: crmId || 'New',
          name: sheetRecord.name || sheetRecord.person_name || sheetRecord.propertyName || 'New Record',
          conflicts: [],
          validationError: validationError || (crmId ? `Record ID '${crmId}' not found in CRM.` : 'Missing crm_id.'),
          sheetRecord
        });
      }
    }

    res.json({
      success: true,
      module,
      previewToken: `PREV-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      changes
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function reconcileConfirm(req, res) {
  const { module } = req.params;
  const { acceptedChanges } = req.body;

  if (!acceptedChanges || !Array.isArray(acceptedChanges)) {
    return res.status(400).json({ success: false, message: 'Invalid accepted changes list.' });
  }

  const db = readDb();
  db[module] = db[module] || [];
  let updatedCount = 0;
  let createdCount = 0;

  acceptedChanges.forEach(sheetRec => {
    const crmId = sheetRec.crm_id;
    const dbIndex = db[module].findIndex(r => String(r.id) === String(crmId));

    const cleanedRec = { ...sheetRec };
    delete cleanedRec.crm_id;

    if (dbIndex !== -1) {
      db[module][dbIndex] = { ...db[module][dbIndex], ...cleanedRec };
      updatedCount++;
    } else if (cleanedRec.id) {
      db[module].push(cleanedRec);
      createdCount++;
    }
  });

  if (updatedCount > 0 || createdCount > 0) {
    writeDb(db);
    syncToSheets(module);
  }

  res.json({
    success: true,
    message: `Reconciliation successful. Updated ${updatedCount} records, created ${createdCount} records in CRM.`
  });
}

async function testSheetsConnection(req, res) {
  try {
    const config = getSheetsConfig();
    const email = config.clientEmail;
    const privateKey = config.privateKey;
    const spreadsheetId = config.spreadsheetId;

    if (!spreadsheetId) {
      return res.status(400).json({ success: false, message: 'Spreadsheet ID is not configured.' });
    }

    if (!email || !privateKey) {
      return res.status(400).json({ success: false, message: 'Google Service Account credentials (email or privateKey) are missing from server environment.' });
    }

    const auth = new google.auth.JWT(
      email,
      null,
      privateKey.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const title = response.data.properties.title;

    res.json({ success: true, message: `Successfully connected to Google Sheet: "${title}"` });
  } catch (err) {
    console.error('Sheets connection test error:', err);
    res.status(500).json({ success: false, message: `Google Sheets connection test failed: ${err.message}` });
  }
}

async function triggerFullSync(req, res) {
  try {
    const metadata = require('../config/db').readMetadata();
    const modules = Object.keys(metadata.modules || {});
    modules.forEach(mod => {
      try { syncToSheets(mod); } catch(e) {}
    });
    res.json({ success: true, message: 'Full Google Sheets synchronization triggered across all modules.' });
  } catch (err) {
    console.error('Full sheets sync error:', err);
    res.status(500).json({ success: false, message: 'Failed to trigger full sheets sync.' });
  }
}

async function manualPush(req, res) {
  try {
    const { module, syncMode } = req.body;
    const { manualPushToSheets } = require('../services/sheetsService');
    const result = await manualPushToSheets(module || 'all', syncMode || 'edited_only');
    res.json({
      success: true,
      message: `Manual Push complete (${result.mode}): Updated ${result.updatedRecords} existing records, created ${result.createdRecords} new records in Google Sheets.`
    });
  } catch (err) {
    console.error('Manual push error:', err);
    res.status(500).json({ success: false, message: `Manual Push failed: ${err.message}` });
  }
}

async function manualPull(req, res) {
  try {
    const { module, syncMode } = req.body;
    const { manualPullFromSheets } = require('../services/sheetsService');
    const result = await manualPullFromSheets(module || 'all', syncMode || 'edited_only');
    res.json({
      success: true,
      message: `Manual Pull complete (${result.mode}): Updated ${result.updatedRecords} existing records, created ${result.createdRecords} new records in CRM.`
    });
  } catch (err) {
    console.error('Manual pull error:', err);
    res.status(500).json({ success: false, message: `Manual Pull failed: ${err.message}` });
  }
}

module.exports = {
  getSyncMetrics,
  getSyncJobs,
  retrySyncJob,
  reconcilePreview,
  reconcileConfirm,
  testSheetsConnection,
  triggerFullSync,
  manualPush,
  manualPull
};
