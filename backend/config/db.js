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

module.exports = {
  dbPath,
  metadataPath,
  uploadsDir,
  readDb,
  writeDb,
  readMetadata,
  writeMetadata
};
