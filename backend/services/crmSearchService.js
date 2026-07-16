const fs = require('fs');
const path = require('path');

function isActiveRecord(rec) {
  if (!rec) return false;
  if (rec.deleted === true || rec.deleted === 'true') return false;
  if (rec.isDeleted === true || rec.isDeleted === 'true') return false;
  if (rec.archived === true || rec.archived === 'true') return false;
  if (rec.active === false || rec.active === 'false') return false;
  
  if (rec.status) {
    const statusLower = String(rec.status).toLowerCase();
    if (statusLower === 'deleted' || 
        statusLower === 'archived' || 
        statusLower === 'removed' || 
        statusLower === 'cancelled' ||
        statusLower === 'inactive') {
      return false;
    }
  }
  
  if (rec.propertyStatus) {
    const statusLower = String(rec.propertyStatus).toLowerCase();
    if (statusLower === 'deleted' || 
        statusLower === 'archived' || 
        statusLower === 'removed' || 
        statusLower === 'cancelled' ||
        statusLower === 'inactive') {
      return false;
    }
  }
  
  return true;
}

function getActiveList(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(isActiveRecord);
}

function filterDb(rawDb) {
  if (!rawDb) return {};
  const db = {};
  for (const key in rawDb) {
    if (Array.isArray(rawDb[key])) {
      db[key] = getActiveList(rawDb[key]);
    } else {
      db[key] = rawDb[key];
    }
  }
  return db;
}

function classifyIntent(sentence) {
  const words = sentence.toLowerCase().replace(/[?,.!]/g, ' ').split(/\s+/).filter(w => w.length > 0);
  
  const moduleKeywords = {
    Employees: ['employee', 'employees', 'staff', 'staffs', 'worker', 'workers', 'agent', 'agents', 'profile', 'profiles', 'details'],
    Attendance: ['attendance', 'present', 'absent', 'checkin', 'checkout', 'punch', 'working hours', 'working hour', 'today', 'yesterday', 'monthly attendance', 'check-in', 'check-out'],
    Payroll: ['salary', 'salaries', 'payroll', 'payrolls', 'deduction', 'deductions', 'bonus', 'bonuses', 'allowance', 'allowances', 'settlement', 'gross', 'net salary', 'payslip', 'payslips'],
    Leaves: ['leave', 'leaves', 'holiday', 'holidays', 'vacation', 'vacations', 'half day', 'full day', 'leave application', 'leave request', 'leave applications', 'leave requests'],
    Leads: ['lead', 'leads', 'inquiry', 'inquiries', 'enquiry', 'enquiries', 'prospect', 'prospects'],
    Customers: ['customer', 'customers', 'client', 'clients', 'buyer', 'buyers', 'seller', 'sellers', 'investor', 'investors'],
    Properties: ['property', 'properties', 'plot', 'plots', 'house', 'houses', 'villa', 'villas', 'flat', 'flats', 'shop', 'shops', 'office', 'offices', 'commercial', 'residential'],
    Projects: ['project', 'projects', 'site', 'sites', 'scheme', 'schemes', 'development', 'developments'],
    Inventory: ['inventory', 'inventories', 'stock', 'stocks', 'availability', 'unit', 'units'],
    Payments: ['payment', 'payments', 'receipt', 'receipts', 'invoice', 'invoices', 'due', 'received']
  };

  const scores = {
    Employees: 0,
    Attendance: 0,
    Payroll: 0,
    Leaves: 0,
    Leads: 0,
    Customers: 0,
    Properties: 0,
    Projects: 0,
    Inventory: 0,
    Payments: 0
  };

  for (const word of words) {
    for (const mKey in moduleKeywords) {
      const kList = moduleKeywords[mKey];
      const matches = kList.some(k => {
        if (k === word) return true;
        if (word + 's' === k || k + 's' === word) return true;
        if (word + 'es' === k || k + 'es' === word) return true;
        if (word.length >= 4 && k.length >= 4) {
          if (k.includes(word) || word.includes(k)) return true;
        }
        return false;
      });
      if (matches) {
        scores[mKey]++;
      }
    }
  }

  // Create ranking array
  const ranking = Object.keys(scores)
    .map(key => ({ module: key, score: scores[key] }))
    .sort((a, b) => b.score - a.score || b.module.localeCompare(a.module));

  let winner = ranking[0].score > 0 ? ranking[0].module : null;

  const topScore = ranking[0].score;
  const topModules = ranking.filter(r => r.score === topScore).map(r => r.module);

  if (topScore > 0 && topModules.length > 1) {
    if (topModules.includes('Employees') && topModules.includes('Payroll')) winner = 'Payroll';
    else if (topModules.includes('Employees') && topModules.includes('Attendance')) winner = 'Attendance';
    else if (topModules.includes('Properties') && topModules.includes('Inventory')) winner = 'Inventory';
    else if (topModules.includes('Customers') && topModules.includes('Payments')) winner = 'Payments';
  }

  return { winner, ranking };
}

function getRelatedRecords(moduleKey, entityId, db, metadata) {
  const related = {};
  const modules = metadata.modules || {};
  
  for (const mKey in modules) {
    if (mKey === moduleKey) continue;
    const mConfig = modules[mKey];
    const fields = mConfig.fields || [];
    
    // Check metadata ref module types
    const refFields = fields.filter(f => f.type === 'ref' && f.refModule === moduleKey);
    if (refFields.length > 0) {
      const records = getActiveList(db[mKey]);
      const matched = records.filter(rec => {
        return refFields.some(f => String(rec[f.name]) === String(entityId));
      });
      if (matched.length > 0) {
        related[mKey] = matched;
      }
    }
    
    // Fallback matching fields dynamically using common naming patterns
    const singularIdKey = moduleKey.endsWith('s') ? `${moduleKey.slice(0, -1)}Id` : `${moduleKey}Id`;
    const camelIdKey = moduleKey.endsWith('s') ? `${moduleKey.slice(0, -1)}ID` : `${moduleKey}ID`;
    
    const idFields = fields.filter(f => 
      f.name === singularIdKey || 
      f.name === camelIdKey || 
      (f.name === 'customerId' && moduleKey === 'customers') || 
      (f.name === 'employeeId' && moduleKey === 'employees') || 
      (f.name === 'propertyId' && moduleKey === 'properties') || 
      (f.name === 'projectId' && moduleKey === 'projects') || 
      (f.name === 'dealerId' && moduleKey === 'dealers')
    );
    if (idFields.length > 0 && !related[mKey]) {
      const records = getActiveList(db[mKey]);
      const matched = records.filter(rec => {
        return idFields.some(f => String(rec[f.name]) === String(entityId));
      });
      if (matched.length > 0) {
        related[mKey] = matched;
      }
    }
  }
  return related;
}

function getParentEntities(moduleKey, rec, db, metadata) {
  const parents = {};
  const mConfig = metadata.modules?.[moduleKey];
  if (!mConfig) return parents;
  
  const fields = mConfig.fields || [];
  const refFields = fields.filter(f => f.type === 'ref');
  
  for (const f of refFields) {
    const parentModule = f.refModule;
    const parentId = rec[f.name];
    if (parentId && db[parentModule]) {
      const parentRec = getActiveList(db[parentModule]).find(p => String(p.id) === String(parentId));
      if (parentRec) {
        parents[parentModule] = parentRec;
      }
    }
  }
  return parents;
}

class CRMSearchService {
  static search(query, rawDb) {
    const db = filterDb(rawDb);
    const qLower = query.toLowerCase().trim();
    
    // Read metadata dynamically
    const metadataPath = path.join(__dirname, '..', 'config', 'metadata.json');
    let metadata = {};
    try {
      if (fs.existsSync(metadataPath)) {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      }
    } catch (e) {
      console.error("Failed to read metadata.json in CRMSearchService:", e);
    }
    
    const modules = metadata.modules || {};
    
    // Intent classification
    const { winner, ranking } = classifyIntent(query);
    
    const mapping = {
      Employees: 'employees',
      Attendance: 'attendance',
      Payroll: 'salaries',
      Leaves: 'leaves',
      Leads: 'leads',
      Customers: 'customers',
      Properties: 'properties',
      Projects: 'projects',
      Inventory: 'properties',
      Payments: 'deals'
    };

    let targetModuleKey = winner ? mapping[winner] : null;
    const matchedResults = [];
    
    if (targetModuleKey && db[targetModuleKey]) {
      const mConfig = modules[targetModuleKey];
      const records = getActiveList(db[targetModuleKey]);
      
      const intentKeywords = new Set([
        'employee', 'employees', 'staff', 'worker', 'agent', 'profile', 'details',
        'attendance', 'present', 'absent', 'checkin', 'checkout', 'punch', 'working', 'hours', 'today', 'yesterday',
        'salary', 'payroll', 'deduction', 'bonus', 'allowance', 'settlement', 'gross', 'net', 'payslip',
        'leave', 'holiday', 'vacation', 'half', 'day', 'application', 'request',
        'lead', 'leads', 'inquiry', 'enquiry', 'prospect',
        'customer', 'client', 'buyer', 'seller', 'investor',
        'property', 'plot', 'house', 'villa', 'flat', 'shop', 'office', 'commercial', 'residential',
        'project', 'site', 'scheme', 'development',
        'inventory', 'stock', 'availability', 'unit', 'units',
        'payment', 'receipt', 'invoice', 'due', 'received',
        'show', 'check', 'want', 'to', 'for', 'is', 'on', 'my', 'the', 'how', 'many', 'who', 'has'
      ]);

      const queryWords = qLower.split(/\s+/).filter(w => !intentKeywords.has(w) && w.length > 2);
      
      for (const rec of records) {
        let match = false;
        if (queryWords.length > 0) {
          match = queryWords.some(word => {
            return Object.keys(rec).some(k => {
              const val = rec[k];
              if (val === undefined || val === null) return false;
              return String(val).toLowerCase().includes(word);
            });
          });
        } else {
          match = true;
        }

        if (match) {
          matchedResults.push({ moduleKey: targetModuleKey, rec });
        }
      }
    }

    // Fallback to searching all modules if no target module matches or no target module winner was detected
    if (matchedResults.length === 0) {
      for (const mKey in modules) {
        const mConfig = modules[mKey];
        const fields = mConfig.fields || [];
        const records = getActiveList(db[mKey] || db[mConfig.id]);
        
        for (const rec of records) {
          let match = false;
          for (const f of fields) {
            const val = rec[f.name];
            if (val === undefined || val === null) continue;
            const valStr = String(val).toLowerCase();
            if (valStr === qLower || valStr.includes(qLower)) {
              match = true;
              break;
            }
          }
          if (match) {
            matchedResults.push({ moduleKey: mKey, rec });
          }
        }
      }
    }
    
    const rankingSummary = ranking.map(r => `${r.module} (${r.score})`).join(', ');

    if (matchedResults.length === 1) {
      const match = matchedResults[0];
      const rec = match.rec;
      const mKey = match.moduleKey;
      
      const parents = getParentEntities(mKey, rec, db, metadata);
      const related = getRelatedRecords(mKey, rec.id, db, metadata);
      
      return {
        type: 'entity360',
        rankingSummary,
        data: {
          moduleKey: mKey,
          moduleLabel: modules[mKey]?.label || mKey,
          record: rec,
          parents,
          related,
          fields: modules[mKey]?.fields || []
        }
      };
    }
    
    if (matchedResults.length > 1) {
      return {
        type: 'multipleMatches',
        rankingSummary,
        data: matchedResults.map(m => ({
          moduleKey: m.moduleKey,
          moduleLabel: modules[m.moduleKey]?.label || m.moduleKey,
          id: m.rec.id,
          name: m.rec.name || m.rec.person_name || m.rec.firm_name || m.rec.propertyName || m.rec.title || `Record ${m.rec.id}`,
          details: m.rec.status || m.rec.stage || m.rec.role || ''
        }))
      };
    }

    if (targetModuleKey && db[targetModuleKey]) {
      const list = getActiveList(db[targetModuleKey]);
      if (list.length > 0) {
        return {
          type: 'moduleList',
          rankingSummary,
          data: {
            moduleKey: targetModuleKey,
            moduleLabel: modules[targetModuleKey]?.label || targetModuleKey,
            records: list.slice(0, 10),
            fields: modules[targetModuleKey]?.fields || []
          }
        };
      }
    }
    
    return {
      type: 'suggestions',
      rankingSummary,
      data: []
    };
  }
}

module.exports = {
  CRMSearchService,
  isActiveRecord,
  getActiveList,
  filterDb,
  classifyIntent
};
