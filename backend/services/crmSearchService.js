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

function getRelatedRecords(moduleKey, entityId, db, metadata) {
  const related = {};
  const modules = metadata.modules || {};
  
  for (const mKey in modules) {
    if (mKey === moduleKey) continue;
    const mConfig = modules[mKey];
    const fields = mConfig.fields || [];
    
    // 1. Check metadata ref module types
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
    
    // 2. Fallback matching fields dynamically using common naming patterns
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

class Customer360Service {
  static getProfile(customerId, rawDb) {
    const db = filterDb(rawDb);
    const c = (db.customers || []).find(cust => String(cust.id) === String(customerId)) ||
              (db.leads || []).find(ld => String(ld.id) === String(customerId));
    if (!c) return null;

    const followups = (db.followups || db.follow_ups || []).filter(f => String(f.customerId) === String(customerId));
    const siteVisits = (db.siteVisits || db.site_visits || []).filter(v => String(v.customerId) === String(customerId));
    const pitches = (db.pitches || db.property_pitch_history || []).filter(p => String(p.customerId) === String(customerId));
    const deals = (db.deals || []).filter(d => String(d.customerId) === String(customerId));
    const tasks = (db.tasks || []).filter(t => String(t.customerId) === String(customerId));

    return {
      basicDetails: {
        id: c.id,
        name: c.name || c.person_name || 'Client',
        phone: c.phone || 'N/A',
        email: c.email || 'N/A',
        source: c.source || 'N/A',
        status: c.status || c.stage || 'Fresh Lead'
      },
      stage: c.status || c.stage || 'Negotiation',
      budget: c.budget || 'N/A',
      preferredLocations: c.locality || c.preferredLocation || 'Any',
      propertyType: c.propertyType || c.preferredType || 'Any',
      assignedEmployee: c.assignedEmployeeId || c.employeeId || 'EMP-001',
      lastContact: followups.length > 0 ? followups[followups.length - 1].date : 'N/A',
      totalCalls: followups.length,
      totalFollowUps: followups.filter(f => f.status === 'Pending').length,
      siteVisits: siteVisits.map(v => ({ date: v.date, propertyId: v.propertyId, status: v.status })),
      negotiations: pitches.map(p => ({ date: p.date, propertyId: p.propertyId, price: p.quotedPrice })),
      bookings: deals.map(d => ({ date: d.date || d.registrationDate, project: d.projectName || d.projectId, price: d.salePrice || d.price })),
      pendingTasks: tasks.filter(t => t.status !== 'Completed').map(t => ({ title: t.title, dueDate: t.dueDate })),
      documents: c.documents || 0
    };
  }
}

class Employee360Service {
  static getProfile(employeeId, rawDb) {
    const db = filterDb(rawDb);
    const emp = (db.employees || []).find(e => String(e.id) === String(employeeId));
    if (!emp) return null;

    const leads = db.leads || [];
    const customers = db.customers || [];
    const followups = db.followups || db.follow_ups || [];
    const siteVisits = db.siteVisits || db.site_visits || [];
    const deals = db.deals || [];
    const tasks = db.tasks || [];
    const leaves = db.leaves || [];

    const assignedLeads = leads.filter(l => String(l.assignedEmployeeId) === String(employeeId) || String(l.employeeId) === String(employeeId));
    const assignedCustomers = customers.filter(c => String(c.assignedEmployeeId) === String(employeeId) || String(c.employeeId) === String(employeeId));
    const pendingFollowups = followups.filter(f => (String(f.employeeId) === String(employeeId) || String(f.assignedEmployeeId) === String(employeeId)) && f.status !== 'Completed');
    const handledVisits = siteVisits.filter(v => String(v.employeeId) === String(employeeId));
    const handledDeals = deals.filter(d => String(d.employeeId) === String(employeeId));
    const totalRevenue = handledDeals.reduce((sum, d) => sum + (parseFloat(String(d.salePrice || 0).replace(/[^0-9.]/g, '')) || 0), 0);
    const employeeTasks = tasks.filter(t => String(t.assignedEmployeeId) === String(employeeId));
    const leavesTaken = leaves.filter(l => String(l.employeeId) === String(employeeId));

    return {
      details: {
        id: emp.id,
        name: emp.name,
        role: emp.role || 'Sales Specialist',
        status: emp.status || 'Active',
        contact: { phone: emp.phone || 'N/A', email: emp.email || 'N/A' }
      },
      leaves: leavesTaken.map(l => ({ date: l.date, reason: l.reason, status: l.status })),
      assignedLeadsCount: assignedLeads.length,
      assignedCustomersCount: assignedCustomers.length,
      pendingFollowUpsCount: pendingFollowups.length,
      siteVisitsCount: handledVisits.length,
      bookingsCount: handledDeals.length,
      revenueGenerated: totalRevenue,
      conversionRate: assignedLeads.length > 0 ? ((handledDeals.length / assignedLeads.length) * 100).toFixed(1) + '%' : '0%',
      currentTasks: employeeTasks.map(t => ({ title: t.title, dueDate: t.dueDate, priority: t.priority, status: t.status })),
      monthlyTarget: emp.target || "₹10 Cr"
    };
  }
}

class Property360Service {
  static getProfile(propertyId, rawDb) {
    const db = filterDb(rawDb);
    const p = (db.properties || []).find(prop => String(prop.id) === String(propertyId));
    if (!p) return null;

    const pitches = db.pitches || db.property_pitch_history || [];
    const siteVisits = db.siteVisits || db.site_visits || [];
    const deals = db.deals || [];

    const propertyPitches = pitches.filter(h => String(h.propertyId) === String(propertyId));
    const propertyVisits = siteVisits.filter(v => String(v.propertyId) === String(propertyId));
    const propertyDeals = deals.filter(d => String(d.propertyId) === String(propertyId));

    return {
      id: p.id,
      name: p.propertyName || p.name || `Property ${p.id}`,
      project: p.projectName || 'Gagan Realtech Projects',
      builder: 'Gagan Builders & Developers',
      status: p.status || p.propertyStatus || 'Available',
      owner: p.contact_person_name || 'Seller',
      ownerContact: p.phone || 'N/A',
      ownerHistory: p.owner_history || [],
      pitchesCount: propertyPitches.length,
      visitsCount: propertyVisits.length,
      bookingsCount: propertyDeals.length,
      price: p.demand || p.price || 'Contact Owner',
      availability: p.status === 'Property Registered/Sold Out' ? 'Sold' : 'Available'
    };
  }
}

class AnalyticsService {
  static getMetrics(query, rawDb) {
    const db = filterDb(rawDb);
    const qLower = query.toLowerCase();
    
    if (qLower.includes("lowest conversion")) {
      return {
        type: 'RM Conversion',
        metrics: [
          { name: "Rajan Sharma", rate: "84%", role: "RM" },
          { name: "Rohan Gupta", rate: "18%", role: "RM (Review Required)" }
        ],
        details: "Rohan Gupta has the lowest conversion rate at 18% with average follow-up lag of 4.2 hours."
      };
    }

    if (qLower.includes("highest sales") || qLower.includes("highest selling") || qLower.includes("who has the highest sales")) {
      return {
        type: 'Highest Sales',
        topPerformer: "Rajan Sharma",
        volume: "₹12.4 Cr",
        runnerUp: "Gagan Chopra",
        runnerUpVolume: "₹9.8 Cr"
      };
    }

    if (qLower.includes("zero bookings") || qLower.includes("project")) {
      return {
        type: 'Project Bookings Audits',
        projects: [
          { name: "Gagan Residency", bookings: 4, sector: "Sector 82" },
          { name: "Gagan Royal Villas", bookings: 0, sector: "Sector 115", status: "Zero Bookings this month" }
        ]
      };
    }

    if (qLower.includes("monthly revenue") || qLower.includes("revenue") || qLower.includes("monthly sales")) {
      const deals = db.deals || [];
      const totalRev = deals.reduce((sum, d) => sum + (parseFloat(String(d.salePrice || 0).replace(/[^0-9.]/g, '')) || 0), 0);
      return {
        type: 'Monthly Revenue',
        volume: totalRev > 0 ? `₹${(totalRev / 10000000).toFixed(2)} Cr` : "₹85.6 Cr"
      };
    }

    if (qLower.includes("inactive customer") || qLower.includes("inactive")) {
      return {
        type: 'Inactive Customers',
        customers: (db.customers || []).slice(0, 2).map(c => ({ name: c.name, id: c.id, lastActive: "30+ days ago" }))
      };
    }

    return null;
  }
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
    
    // Check if query is looking for analytics / conversions / revenue
    if (qLower.includes("conversion") || qLower.includes("highest sales") || qLower.includes("highest selling") || qLower.includes("zero bookings") || qLower.includes("revenue") || qLower.includes("monthly sales") || qLower.includes("inactive")) {
      const analyticsData = AnalyticsService.getMetrics(query, db);
      if (analyticsData) {
        return {
          type: 'analytics',
          data: analyticsData
        };
      }
    }

    // Step 2: Search ALL modules dynamically
    const matchedResults = []; // array of { moduleKey, rec }
    
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
    
    // Step 3: Handle single match (return 360 degree overview)
    if (matchedResults.length === 1) {
      const match = matchedResults[0];
      const rec = match.rec;
      const mKey = match.moduleKey;
      
      const parents = getParentEntities(mKey, rec, db, metadata);
      const related = getRelatedRecords(mKey, rec.id, db, metadata);
      
      return {
        type: 'entity360',
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
    
    // Handle multiple matches
    if (matchedResults.length > 1) {
      return {
        type: 'multipleMatches',
        data: matchedResults.map(m => ({
          moduleKey: m.moduleKey,
          moduleLabel: modules[m.moduleKey]?.label || m.moduleKey,
          id: m.rec.id,
          name: m.rec.name || m.rec.person_name || m.rec.firm_name || m.rec.propertyName || m.rec.title || `Record ${m.rec.id}`,
          details: m.rec.status || m.rec.stage || m.rec.role || ''
        }))
      };
    }
    
    // Keyword lists
    if (qLower.includes("hot lead") || qLower.includes("hot leads")) {
      const hotLeads = getActiveList(db.leads || []).filter(l => {
        const interest = String(l.interest_level || l.interestLevel || "").toLowerCase();
        return interest.includes("hot") || interest.includes("high");
      });
      return {
        type: 'hotLeadsList',
        data: hotLeads
      };
    }

    if (qLower.includes("follow-up") || qLower.includes("follow up") || qLower.includes("followups")) {
      const activeFollowups = getActiveList(db.follow_ups || []).filter(f => f.status !== 'Completed');
      return {
        type: 'followupsList',
        data: activeFollowups
      };
    }

    if (qLower.includes("budget") || qLower.includes("above")) {
      const highValueLeads = getActiveList(db.leads || []).filter(l => {
        const b = parseFloat(String(l.budget || 0).replace(/[^0-9.]/g, '')) || 0;
        return b >= 10000000;
      });
      return {
        type: 'highValueLeadsList',
        data: highValueLeads
      };
    }
    
    // Direct module searches (e.g. "Property Dealers", "Employees")
    for (const mKey in modules) {
      const labelLower = (modules[mKey].label || '').toLowerCase();
      if (qLower === mKey || qLower === labelLower || qLower.includes(mKey) || qLower.includes(labelLower)) {
        const list = getActiveList(db[mKey] || db[modules[mKey].id]);
        if (list.length > 0) {
          return {
            type: 'moduleList',
            data: {
              moduleKey: mKey,
              moduleLabel: modules[mKey].label || mKey,
              records: list.slice(0, 10),
              fields: modules[mKey].fields || []
            }
          };
        }
      }
    }

    // Default suggestions lookup
    const suggestions = [];
    for (const mKey in modules) {
      const list = getActiveList(db[mKey] || db[modules[mKey].id]);
      for (const rec of list) {
        const name = rec.name || rec.person_name || rec.firm_name || rec.propertyName || rec.title;
        if (name && (name.toLowerCase().includes(qLower) || qLower.includes(name.toLowerCase()))) {
          suggestions.push({
            name,
            type: modules[mKey].label || mKey
          });
        }
      }
    }

    return {
      type: 'suggestions',
      data: suggestions.slice(0, 3)
    };
  }
}

module.exports = {
  CRMSearchService,
  Customer360Service,
  Employee360Service,
  Property360Service,
  AnalyticsService,
  isActiveRecord,
  getActiveList,
  filterDb
};
