const fs = require('fs');
const path = require('path');

const metadataPath = path.join(__dirname, 'metadata.json');
const dbPath = path.join(__dirname, 'db.json');
const uploadsDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

let dbCache = null;
let metadataCache = null;

function readDb() {
  if (!dbCache) {
    dbCache = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  }
  const defaultModules = ['leads', 'customers', 'properties', 'projects', 'queries', 'follow_ups', 'site_visits', 'documents', 'deals', 'tasks', 'employees', 'property_pitch_history', 'property_history', 'project_history', 'property_inspections', 'property_listing_cycles', 'property_ownership_history', 'assignment_history', 'sync_jobs', 'sync_logs', 'audit_logs', 'location_logs'];
  defaultModules.forEach(m => {
    if (!Array.isArray(dbCache[m])) dbCache[m] = [];
  });
  return dbCache;
}

function writeDb(data) {
  dbCache = data;
  const tempPath = `${dbPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, dbPath);
}

function readMetadata() {
  if (!metadataCache) {
    metadataCache = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  }
  return metadataCache;
}

function writeMetadata(data) {
  metadataCache = data;
  fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2), 'utf8');
}

function trackDeletedRecord(moduleName, recordId) {
  try {
    const metadata = readMetadata();
    metadata.deletedRecordKeys = metadata.deletedRecordKeys || [];
    const key = `${moduleName}:${recordId}`;
    if (!metadata.deletedRecordKeys.includes(key)) {
      metadata.deletedRecordKeys.push(key);
      writeMetadata(metadata);
    }
  } catch (e) {
    console.error('Failed to track deleted record:', e.message);
  }
}

function readDb() {
  if (!dbCache) {
    dbCache = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  }
  const defaultModules = ['leads', 'customers', 'properties', 'projects', 'queries', 'follow_ups', 'site_visits', 'documents', 'deals', 'tasks', 'employees', 'property_pitch_history', 'property_history', 'project_history', 'property_inspections', 'property_listing_cycles', 'property_ownership_history', 'assignment_history', 'sync_jobs', 'sync_logs', 'audit_logs', 'location_logs', 'attendance', 'salaries'];
  defaultModules.forEach(m => {
    if (!Array.isArray(dbCache[m])) dbCache[m] = [];
  });

  // Apply persistent deleted keys from metadata so soft-deleted rows NEVER reappear after Render redeploy
  try {
    const metadata = readMetadata();
    if (Array.isArray(metadata.deletedRecordKeys) && metadata.deletedRecordKeys.length > 0) {
      const delSet = new Set(metadata.deletedRecordKeys);
      defaultModules.forEach(m => {
        if (Array.isArray(dbCache[m])) {
          dbCache[m].forEach(r => {
            if (r && r.id && delSet.has(`${m}:${r.id}`)) {
              r.deletedAt = r.deletedAt || '2026-01-01T00:00:00.000Z';
            }
          });
        }
      });
    }
  } catch (e) {}

  return dbCache;
}

function writeDb(data) {
  dbCache = data;
  const tempPath = `${dbPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, dbPath);
}

module.exports = {
  dbPath,
  metadataPath,
  uploadsDir,
  readDb,
  writeDb,
  readMetadata,
  writeMetadata,
  trackDeletedRecord
};
