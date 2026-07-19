const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'config', 'db.json');

function runPasswordMigration() {
  if (!fs.existsSync(dbPath)) {
    console.error('db.json not found at:', dbPath);
    return;
  }

  try {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    if (!db.employees || !Array.isArray(db.employees)) {
      console.log('No employees array found in database.');
      return;
    }

    let updated = false;
    const defaultEmails = {
      'EMP-001': 'admin@gaganrealtech.com',
      'EMP-002': 'sales1@gaganrealtech.com',
      'EMP-003': 'sales2@gaganrealtech.com'
    };

    db.employees.forEach(emp => {
      // Seed default email if missing
      if (!emp.email && defaultEmails[emp.id]) {
        emp.email = defaultEmails[emp.id];
        updated = true;
      }

      // If legacy password field exists and is not hashed
      if (emp.password && !emp.password.startsWith('$2a$') && !emp.password.startsWith('$2b$')) {
        console.log(`Hashing credentials for employee: ${emp.name} (${emp.id})`);
        const salt = bcrypt.genSaltSync(12);
        emp.passwordHash = bcrypt.hashSync(emp.password, salt);
        emp.tokenVersion = emp.tokenVersion || 1;
        delete emp.password;
        updated = true;
      } else if (!emp.passwordHash) {
        // Seed default initial password for default accounts if unconfigured
        const defaultPassword = emp.role === 'Admin' ? 'Admin@123' : 'Sales@123';
        const salt = bcrypt.genSaltSync(12);
        emp.passwordHash = bcrypt.hashSync(defaultPassword, salt);
        emp.tokenVersion = emp.tokenVersion || 1;
        updated = true;
      }
    });

    if (updated) {
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
      console.log('Success! Migrated and verified employee credentials & default email mappings.');
    }
  } catch (err) {
    console.error('Password migration failed:', err.message);
  }
}

if (require.main === module) {
  runPasswordMigration();
}

module.exports = { runPasswordMigration };

