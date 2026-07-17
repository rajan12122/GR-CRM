const { readDb, writeDb } = require('../config/db');

function getAll(moduleName, includeDeleted = false) {
  const db = readDb();
  const list = db[moduleName] || [];
  if (includeDeleted) return list;
  return list.filter(item => !item.deletedAt);
}

function getById(moduleName, id) {
  const db = readDb();
  const list = db[moduleName] || [];
  return list.find(item => String(item.id) === String(id) || String(item.uuid) === String(id));
}

function create(moduleName, payload) {
  const db = readDb();
  if (!db[moduleName]) db[moduleName] = [];
  
  payload.uuid = payload.uuid || require('crypto').randomUUID();
  payload.createdAt = payload.createdAt || new Date().toISOString();
  
  db[moduleName].push(payload);
  writeDb(db);
  return payload;
}

function update(moduleName, id, payload) {
  const db = readDb();
  const list = db[moduleName] || [];
  const index = list.findIndex(item => String(item.id) === String(id) || String(item.uuid) === String(id));
  if (index === -1) return null;
  
  const updatedRecord = { ...list[index], ...payload, updatedAt: new Date().toISOString() };
  list[index] = updatedRecord;
  writeDb(db);
  return updatedRecord;
}

function softDelete(moduleName, id, userId, reason = 'Archived through CRM delete action') {
  const db = readDb();
  const list = db[moduleName] || [];
  const index = list.findIndex(item => String(item.id) === String(id) || String(item.uuid) === String(id));
  if (index === -1) return null;
  
  const record = list[index];
  record.deletedAt = new Date().toISOString();
  record.deletedBy = userId;
  record.deletionReason = reason;
  
  writeDb(db);
  return record;
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  softDelete
};
