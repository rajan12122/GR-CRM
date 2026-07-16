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

function classifyIntent(sentence, db) {
  let cleanStr = sentence.toLowerCase()
    .replace(/[?,.!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
    
  const stopPhrases = [
    'please', 'kindly', 'can you', 'could you', 'i want', 'i need', 
    'show me', 'tell me', 'help me', 'let me', 'give me', 'show', 'view', 'display', 'open'
  ];
  
  for (const phrase of stopPhrases) {
    cleanStr = cleanStr.replace(new RegExp(`\\b${phrase}\\b`, 'g'), '');
  }
  cleanStr = cleanStr.replace(/\s+/g, ' ').trim();
  
  const words = cleanStr.split(/\s+/).filter(w => w.length > 0);
  
  const spellingCorrections = {
    attendence: 'attendance',
    attndance: 'attendance',
    attendnce: 'attendance',
    employe: 'employee',
    emplyee: 'employee',
    salry: 'salary',
    payrol: 'payroll',
    custmer: 'customer',
    propery: 'property',
    propety: 'property',
    leed: 'lead',
    intkal: 'inteqal',
    intiqal: 'inteqal',
    khwat: 'khewat',
    jamabndi: 'jamabandi'
  };
  
  const correctedWords = words.map(w => spellingCorrections[w] || w);
  
  const synonyms = {
    salary: 'payroll',
    payroll: 'salary',
    employee: 'staff',
    staff: 'employee',
    attendance: 'punch',
    punch: 'attendance',
    customer: 'client',
    client: 'customer',
    lead: 'inquiry',
    inquiry: 'lead',
    prospect: 'lead',
    property: 'plot',
    plot: 'property',
    land: 'property',
    meeting: 'appointment',
    appointment: 'meeting',
    task: 'assignment',
    assignment: 'task',
    payment: 'collection',
    collection: 'payment',
    leave: 'holiday',
    holiday: 'leave'
  };

  const moduleKeywords = {
    Employees: ['employee', 'employees', 'staff', 'worker', 'workers', 'team', 'agent', 'agents', 'sales executive', 'telecaller', 'manager', 'admin', 'hr', 'accountant', 'director', 'owner', 'executive', 'marketing executive', 'profile', 'details', 'information', 'record', 'list'],
    Attendance: ['attendance', 'present', 'absent', 'late', 'half day', 'full day', 'check in', 'check out', 'checkin', 'checkout', 'punch', 'punch in', 'punch out', 'office time', 'working hours', 'login time', 'logout time', 'today attendance', 'monthly attendance', 'weekly attendance', 'attendance report'],
    Payroll: ['salary', 'salaries', 'payroll', 'payrolls', 'deduction', 'deductions', 'bonus', 'bonuses', 'allowance', 'allowances', 'settlement', 'gross', 'net salary', 'payslip', 'payslips', 'salary slip', 'monthly salary', 'salary report'],
    Leaves: ['leave', 'leaves', 'holiday', 'holidays', 'vacation', 'vacations', 'half day', 'full day', 'leave request', 'leave application', 'leave approval', 'leave balance', 'leave status', 'medical leave', 'casual leave', 'earned leave', 'paid leave', 'unpaid leave', 'half leave', 'full leave'],
    Leads: ['lead', 'leads', 'inquiry', 'enquiry', 'prospect', 'new lead', 'hot lead', 'warm lead', 'cold lead', 'pending lead', 'converted lead', 'lost lead', 'lead source', 'lead status', 'lead followup', 'lead history'],
    Followup: ['followup', 'follow up', 'reminder', 'call back', 'callback', 'meeting', 'appointment', 'site visit', 'next call', 'next meeting', 'schedule followup', 'pending followup', 'completed followup'],
    Customers: ['customer', 'customers', 'client', 'clients', 'buyer', 'buyers', 'seller', 'sellers', 'owner', 'tenant', 'investor', 'landlord', 'vendor', 'dealer', 'builder', 'customer history', 'customer profile', 'customer payment'],
    Properties: ['property', 'properties', 'plot', 'land', 'house', 'villa', 'flat', 'apartment', 'office', 'shop', 'showroom', 'warehouse', 'factory', 'farm house', 'commercial', 'residential', 'property details', 'available property', 'sold property', 'property status'],
    Projects: ['project', 'projects', 'township', 'scheme', 'site', 'society', 'development', 'building', 'tower', 'phase', 'block', 'project details'],
    Inventory: ['inventory', 'stock', 'availability', 'available', 'booked', 'reserved', 'sold', 'unsold', 'unit', 'units', 'inventory status'],
    Payments: ['payment', 'payments', 'receipt', 'invoice', 'bill', 'due', 'outstanding', 'received', 'collection', 'refund', 'advance payment', 'emi', 'transaction'],
    Expenses: ['expense', 'expenses', 'office expense', 'travel expense', 'salary expense', 'fuel expense', 'maintenance', 'electricity', 'rent', 'miscellaneous'],
    Tasks: ['task', 'tasks', 'assignment', 'work', 'pending task', 'completed task', 'today task', 'employee task'],
    Reports: ['report', 'reports', 'analytics', 'dashboard', 'summary', 'statistics', 'performance', 'graph', 'chart', 'analysis', 'growth', 'trend', 'comparison'],
    Documents: ['document', 'documents', 'registry', 'sale deed', 'agreement', 'mutation', 'inteqal', 'jamabandi', 'khewat', 'khatauni', 'khasra', 'fard', 'nakal', 'noc', 'clu', 'loi', 'gmada', 'puda', 'rera', 'registry status']
  };

  const finalScores = {};
  
  for (const mKey in moduleKeywords) {
    const keywords = moduleKeywords[mKey];
    let matchTypeScore = 0;
    let matchCount = 0;
    
    const cleanSentence = sentence.toLowerCase().replace(/[?,.!]/g, ' ');
    const exactPhrase = keywords.some(k => cleanSentence.includes(k));
    if (exactPhrase) {
      matchTypeScore = Math.max(matchTypeScore, 97);
    }
    
    const matchedWords = new Set();
    for (const w of correctedWords) {
      if (keywords.includes(w)) {
        matchedWords.add(w);
      } else {
        const syn = synonyms[w];
        if (syn && keywords.includes(syn)) {
          matchedWords.add(syn);
          matchTypeScore = Math.max(matchTypeScore, 90);
        }
        const partial = keywords.some(k => k.includes(w) || w.includes(k));
        if (partial && w.length >= 4) {
          matchedWords.add(w);
          matchTypeScore = Math.max(matchTypeScore, 85);
        }
      }
    }
    
    matchCount = matchedWords.size;
    if (matchCount === 1) {
      matchTypeScore = Math.max(matchTypeScore, 100);
    } else if (matchCount >= 2) {
      matchTypeScore = Math.max(matchTypeScore, 98);
    }
    
    let countBonus = 0;
    if (matchCount === 1) countBonus = 10;
    else if (matchCount === 2) countBonus = 20;
    else if (matchCount === 3) countBonus = 35;
    else if (matchCount === 4) countBonus = 50;
    else if (matchCount === 5) countBonus = 70;
    else if (matchCount >= 6) countBonus = 100;
    
    let entityBonus = 0;
    
    const hasEmployeeName = (db?.employees || []).some(e => {
      const nameLower = String(e.name || '').toLowerCase();
      return nameLower && cleanSentence.includes(nameLower);
    });
    if (hasEmployeeName) entityBonus += 20;
    
    const hasEmployeeId = /\b(emp-\d+|emp\d+)\b/i.test(sentence) || (db?.employees || []).some(e => cleanSentence.includes(String(e.id).toLowerCase()));
    if (hasEmployeeId) entityBonus += 25;

    const hasCustomerName = (db?.customers || []).some(c => {
      const nameLower = String(c.name || c.person_name || '').toLowerCase();
      return nameLower && cleanSentence.includes(nameLower);
    });
    if (hasCustomerName) entityBonus += 20;

    const hasCustomerId = /\b(cust-\d+|c\d+)\b/i.test(sentence) || (db?.customers || []).some(c => cleanSentence.includes(String(c.id).toLowerCase()));
    if (hasCustomerId) entityBonus += 25;

    const hasPropertyName = (db?.properties || []).some(p => {
      const nameLower = String(p.propertyName || p.name || '').toLowerCase();
      return nameLower && cleanSentence.includes(nameLower);
    });
    if (hasPropertyName) entityBonus += 20;

    const hasPropertyId = /\b(prop-\d+|p-\d+|p\d+)\b/i.test(sentence) || (db?.properties || []).some(p => cleanSentence.includes(String(p.id).toLowerCase()));
    if (hasPropertyId) entityBonus += 25;

    const hasProjectName = (db?.projects || []).some(p => {
      const nameLower = String(p.name || '').toLowerCase();
      return nameLower && cleanSentence.includes(nameLower);
    });
    if (hasProjectName) entityBonus += 20;

    const hasDate = /\b(today|yesterday|tomorrow|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december))\b/i.test(sentence);
    if (hasDate) entityBonus += 15;

    const hasMonth = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i.test(sentence);
    if (hasMonth) entityBonus += 10;

    const hasYear = /\b(202\d{1})\b/.test(sentence);
    if (hasYear) entityBonus += 10;

    const hasLocation = /\b(mohali|chandigarh|panchkula|sector|phase|block)\b/i.test(sentence);
    if (hasLocation) entityBonus += 15;

    const hasStatus = /\b(active|inactive|pending|approved|rejected|completed|cancelled|booked|available|sold|vacant|occupied|closed|open)\b/i.test(sentence);
    if (hasStatus) entityBonus += 10;

    const hasMutation = /\b(mutation|inteqal|intkal)\b/i.test(sentence);
    if (hasMutation) entityBonus += 25;

    const hasKhewat = /\b(khewat|khwat)\b/i.test(sentence);
    if (hasKhewat) entityBonus += 25;

    const hasRegistry = /\b(registry|sale deed)\b/i.test(sentence);
    if (hasRegistry) entityBonus += 25;

    if (matchCount > 0) {
      finalScores[mKey] = matchTypeScore + countBonus + entityBonus;
    } else {
      finalScores[mKey] = 0;
    }
  }

  const ranking = Object.keys(moduleKeywords)
    .map(key => ({ module: key, score: finalScores[key] || 0 }))
    .sort((a, b) => b.score - a.score || b.module.localeCompare(a.module));

  let winner = ranking[0].score >= 70 ? ranking[0].module : null;

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
    
    // Step 1 & 2 & 3 & 4: Intent detection & ranking
    const { winner, ranking } = classifyIntent(query, db);
    
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
    
    // Sort ranking to show non-zero scores first
    const nonZeroRankings = ranking.filter(r => r.score > 0);
    const rankingSummary = nonZeroRankings.length > 0 
      ? nonZeroRankings.map(r => `${r.module} (${r.score}%)`).join(', ')
      : 'General AI (70%)';

    // If highest confidence is low, return clarification request in rankingSummary
    const topScore = ranking[0].score;
    if (topScore > 0 && topScore < 70) {
      return {
        type: 'clarification',
        rankingSummary,
        data: ranking.slice(0, 3).map(r => r.module)
      };
    }

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
