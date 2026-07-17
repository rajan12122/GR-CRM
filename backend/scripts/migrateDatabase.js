const crypto = require('crypto');
const { readDb, writeDb } = require('../config/db');

function runMigration() {
  console.log('Starting CRM Database Migration: UUID Mapping...');
  const db = readDb();
  let generatedCount = 0;
  let totalCount = 0;

  Object.keys(db).forEach(moduleName => {
    const records = db[moduleName];
    if (Array.isArray(records)) {
      records.forEach(rec => {
        totalCount++;
        if (!rec.uuid) {
          rec.uuid = crypto.randomUUID();
          generatedCount++;
        }
      });
    }
  });

  if (generatedCount > 0) {
    writeDb(db);
    console.log(`Migration Complete: Generated ${generatedCount} UUIDs across ${totalCount} records.`);
  } else {
    console.log('Migration Checked: All records already possess valid UUIDs.');
  }

  return { success: true, generatedCount, totalCount };
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
