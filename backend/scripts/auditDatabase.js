const fs = require('fs');
const path = require('path');
const { readDb } = require('../config/db');

function runAudit() {
  console.log('Running CRM Quality and Referential Integrity Audits...');
  const db = readDb();
  
  const report = {
    metadata: {
      timestamp: new Date().toISOString(),
      runBy: "System Migration Engine"
    },
    brokenReferences: [],
    duplicateCustomers: [],
    duplicateProperties: [],
    invalidPhoneNumbers: [],
    missingOwners: [],
    invalidDates: [],
    duplicateDeals: [],
    missingEmployees: []
  };

  const leads = db.leads || [];
  const customers = db.customers || [];
  const properties = db.properties || [];
  const employees = db.employees || [];
  const followups = db.follow_ups || [];
  const queries = db.queries || [];
  const deals = db.deals || [];
  const visits = db.site_visits || [];
  const pitches = db.property_pitch_history || [];
  const listingCycles = db.property_listing_cycles || [];
  const remarks = db.remarks || [];

  const leadIds = new Set(leads.map(l => String(l.id)));
  const customerIds = new Set(customers.map(c => String(c.id)));
  const propertyIds = new Set(properties.map(p => String(p.id)));
  const employeeIds = new Set(employees.map(e => String(e.id)));
  const queryIds = new Set(queries.map(q => String(q.id)));
  const followUpIds = new Set(followups.map(f => String(f.id)));

  // Helper to validate client exists
  const clientExists = (id) => leadIds.has(String(id)) || customerIds.has(String(id));

  // Helper to validate date string
  const isInvalidDate = (dateStr) => {
    if (!dateStr) return true;
    const timestamp = Date.parse(dateStr);
    if (!isNaN(timestamp)) return false;
    // Check local format DD/MM/YYYY
    const parts = String(dateStr).split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0]);
      const m = parseInt(parts[1]) - 1;
      const y = parseInt(parts[2]);
      const date = new Date(y, m, d);
      return date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d;
    }
    return true;
  };

  // Helper to normalize phone
  const cleanPhone = (p) => String(p || '').replace(/\D/g, '');

  // 1. Broken References Check
  followups.forEach(f => {
    if (!clientExists(f.customerId)) {
      report.brokenReferences.push({ record: `Follow-Up ${f.id}`, field: 'customerId', value: f.customerId, issue: 'Referenced Client ID does not exist.' });
    }
    if (f.employeeId && !employeeIds.has(String(f.employeeId))) {
      report.missingEmployees.push({ record: `Follow-Up ${f.id}`, field: 'employeeId', value: f.employeeId, issue: 'Referenced Employee ID does not exist.' });
    }
  });

  queries.forEach(q => {
    if (!customerIds.has(String(q.customerId)) && !leadIds.has(String(q.customerId))) {
      report.brokenReferences.push({ record: `Query ${q.id}`, field: 'customerId', value: q.customerId, issue: 'Referenced Customer/Lead ID does not exist.' });
    }
    if (q.propertyId && !propertyIds.has(String(q.propertyId))) {
      report.brokenReferences.push({ record: `Query ${q.id}`, field: 'propertyId', value: q.propertyId, issue: 'Referenced Property ID does not exist.' });
    }
    if (q.assignedEmployeeId && !employeeIds.has(String(q.assignedEmployeeId))) {
      report.missingEmployees.push({ record: `Query ${q.id}`, field: 'assignedEmployeeId', value: q.assignedEmployeeId, issue: 'Referenced assignedEmployeeId does not exist.' });
    }
  });

  properties.forEach(p => {
    if (p.current_owner_id && !customerIds.has(String(p.current_owner_id)) && !leadIds.has(String(p.current_owner_id))) {
      report.brokenReferences.push({ record: `Property ${p.id}`, field: 'current_owner_id', value: p.current_owner_id, issue: 'Owner client record does not exist.' });
    }
    if (!p.current_owner_id && !p.booked_by_customer_id) {
      report.missingOwners.push({ record: `Property ${p.id}`, issue: 'Property is missing owner and booker definitions.' });
    }
    if (p.assignedEmployeeId && !employeeIds.has(String(p.assignedEmployeeId))) {
      report.missingEmployees.push({ record: `Property ${p.id}`, field: 'assignedEmployeeId', value: p.assignedEmployeeId, issue: 'Referenced assignedEmployeeId does not exist.' });
    }
  });

  deals.forEach(d => {
    if (!customerIds.has(String(d.customerId)) && !leadIds.has(String(d.customerId))) {
      report.brokenReferences.push({ record: `Deal ${d.id}`, field: 'customerId', value: d.customerId, issue: 'Buyer client record does not exist.' });
    }
    if (d.sellerCustomerId && !customerIds.has(String(d.sellerCustomerId)) && !leadIds.has(String(d.sellerCustomerId))) {
      report.brokenReferences.push({ record: `Deal ${d.id}`, field: 'sellerCustomerId', value: d.sellerCustomerId, issue: 'Seller client record does not exist.' });
    }
    if (!propertyIds.has(String(d.propertyId))) {
      report.brokenReferences.push({ record: `Deal ${d.id}`, field: 'propertyId', value: d.propertyId, issue: 'Referenced Property ID does not exist.' });
    }
    if (d.employeeId && !employeeIds.has(String(d.employeeId))) {
      report.missingEmployees.push({ record: `Deal ${d.id}`, field: 'employeeId', value: d.employeeId, issue: 'Referenced Employee ID does not exist.' });
    }
  });

  visits.forEach(v => {
    if (!clientExists(v.customerId)) {
      report.brokenReferences.push({ record: `Site-Visit ${v.id}`, field: 'customerId', value: v.customerId, issue: 'Referenced Client ID does not exist.' });
    }
    if (!propertyIds.has(String(v.propertyId))) {
      report.brokenReferences.push({ record: `Site-Visit ${v.id}`, field: 'propertyId', value: v.propertyId, issue: 'Referenced Property ID does not exist.' });
    }
  });

  pitches.forEach(p => {
    if (!clientExists(p.customerId)) {
      report.brokenReferences.push({ record: `Pitch ${p.id}`, field: 'customerId', value: p.customerId, issue: 'Referenced Client ID does not exist.' });
    }
    const propExists = propertyIds.has(String(p.propertyId));
    const projExists = (db.projects || []).some(pr => String(pr.id) === String(p.propertyId));
    if (!propExists && !projExists) {
      report.brokenReferences.push({ record: `Pitch ${p.id}`, field: 'propertyId', value: p.propertyId, issue: 'Referenced Property or Project ID does not exist.' });
    }
  });

  listingCycles.forEach(l => {
    if (!propertyIds.has(String(l.propertyId))) {
      report.brokenReferences.push({ record: `Listing Cycle ${l.id}`, field: 'propertyId', value: l.propertyId, issue: 'Referenced Property ID does not exist.' });
    }
  });

  // 2. Duplicate Check: Customers
  const customerPhones = {};
  const customerEmails = {};
  customers.forEach(c => {
    if (c.phone) {
      const clean = cleanPhone(c.phone);
      if (clean) {
        customerPhones[clean] = customerPhones[clean] || [];
        customerPhones[clean].push(c.id);
      }
    }
    if (c.email) {
      const clean = String(c.email).trim().toLowerCase();
      if (clean) {
        customerEmails[clean] = customerEmails[clean] || [];
        customerEmails[clean].push(c.id);
      }
    }
  });

  Object.keys(customerPhones).forEach(phone => {
    if (customerPhones[phone].length > 1) {
      report.duplicateCustomers.push({ ids: customerPhones[phone], field: 'phone', value: phone });
    }
  });
  Object.keys(customerEmails).forEach(email => {
    if (customerEmails[email].length > 1) {
      report.duplicateCustomers.push({ ids: customerEmails[email], field: 'email', value: email });
    }
  });

  // 3. Duplicate Check: Properties
  const propertyFingerprints = {};
  properties.forEach(p => {
    const locality = String(p.locality || '').trim().toLowerCase();
    const sector = String(p.sector_block || '').trim().toLowerCase();
    const size = String(p.size || '').trim().toLowerCase();
    const demand = String(p.demand || '').trim().toLowerCase();
    const owner = String(p.current_owner_id || '').trim().toLowerCase();
    
    if (locality && sector && size) {
      const fingerprint = `${locality}:${sector}:${size}:${demand}:${owner}`;
      propertyFingerprints[fingerprint] = propertyFingerprints[fingerprint] || [];
      propertyFingerprints[fingerprint].push(p.id);
    }
  });

  Object.keys(propertyFingerprints).forEach(f => {
    if (propertyFingerprints[f].length > 1) {
      report.duplicateProperties.push({ ids: propertyFingerprints[f], key: f });
    }
  });

  // 4. Duplicate Check: Deals
  const dealFingerprints = {};
  deals.forEach(d => {
    if (d.status === 'Closed' && d.propertyId && d.customerId) {
      const fingerprint = `${d.propertyId}:${d.customerId}`;
      dealFingerprints[fingerprint] = dealFingerprints[fingerprint] || [];
      dealFingerprints[fingerprint].push(d.id);
    }
  });
  Object.keys(dealFingerprints).forEach(f => {
    if (dealFingerprints[f].length > 1) {
      report.duplicateDeals.push({ ids: dealFingerprints[f], key: f });
    }
  });

  // 5. Invalid Phone Numbers & Dates Checks
  const validatePhoneField = (recordType, id, val) => {
    if (!val) return;
    const clean = cleanPhone(val);
    if (clean.length !== 10) {
      report.invalidPhoneNumbers.push({ record: `${recordType} ${id}`, value: val, issue: 'Phone length is not 10 digits.' });
    }
  };

  leads.forEach(l => {
    validatePhoneField('Lead', l.id, l.phone);
    if (isInvalidDate(l.dateAdded)) {
      report.invalidDates.push({ record: `Lead ${l.id}`, field: 'dateAdded', value: l.dateAdded });
    }
  });

  customers.forEach(c => {
    validatePhoneField('Customer', c.id, c.phone);
    if (isInvalidDate(c.dateAdded)) {
      report.invalidDates.push({ record: `Customer ${c.id}`, field: 'dateAdded', value: c.dateAdded });
    }
  });

  deals.forEach(d => {
    if (isInvalidDate(d.registrationDate)) {
      report.invalidDates.push({ record: `Deal ${d.id}`, field: 'registrationDate', value: d.registrationDate });
    }
  });

  // Generate Human-Readable Markdown Report
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }

  const markdownContent = `# CRM Migration & Georelational Quality Report

Generated: ${new Date().toLocaleString()}
Engine: Gagan Realtech Migration Audit

---

## 1. Broken References Summary
Total Broken References: **${report.brokenReferences.length}**

${report.brokenReferences.length === 0 ? '* No broken references found.' : ''}
${report.brokenReferences.map(br => `- **[${br.record}]** ${br.field} is \`${br.value}\`: _${br.issue}_`).join('\n')}

---

## 2. Duplicate Client Profiles
Total Duplicate Groups: **${report.duplicateCustomers.length}**

${report.duplicateCustomers.length === 0 ? '* No duplicate customer profiles identified.' : ''}
${report.duplicateCustomers.map(dc => `- Duplicate found on **${dc.field}** (\`${dc.value}\`) shared by client profiles: ${dc.ids.join(', ')}`).join('\n')}

---

## 3. Duplicate Properties
Total Duplicate Property Listings: **${report.duplicateProperties.length}**

${report.duplicateProperties.length === 0 ? '* No duplicate property records found.' : ''}
${report.duplicateProperties.map(dp => `- Duplicate properties sharing metrics: ${dp.ids.join(', ')}`).join('\n')}

---

## 4. Duplicate Deals
Total Duplicate Deals: **${report.duplicateDeals.length}**

${report.duplicateDeals.length === 0 ? '* No duplicate closed deals found.' : ''}
${report.duplicateDeals.map(dd => `- Duplicate deals logged: ${dd.ids.join(', ')}`).join('\n')}

---

## 5. Georelational & Field Integrity Alerts
- **Missing Property Owners**: ${report.missingOwners.length} properties.
- **Invalid Phone Numbers (Non-10 digits)**: ${report.invalidPhoneNumbers.length} records.
- **Unrecognized Date Fields**: ${report.invalidDates.length} records.
- **Missing/Invalid Assigned Employees**: ${report.missingEmployees.length} records.

${report.missingOwners.map(mo => `- Property **${mo.record}**: ${mo.issue}`).join('\n')}
${report.invalidPhoneNumbers.map(ip => `- **${ip.record}** contains invalid contact number: \`${ip.value}\``).join('\n')}
${report.invalidDates.map(id => `- **${id.record}** contains invalid date: \`${id.value}\``).join('\n')}
${report.missingEmployees.map(me => `- **${me.record}** refers to missing assignee: \`${me.value}\``).join('\n')}

---
`;

  fs.writeFileSync(path.join(reportsDir, 'migration-report.md'), markdownContent, 'utf8');
  console.log(`Database Audit Complete! Saved migration report to backend/reports/migration-report.md`);

  return report;
}

if (require.main === module) {
  runAudit();
}

module.exports = { runAudit };
