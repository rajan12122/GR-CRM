const { readDb, writeDb, readMetadata } = require('../config/db');

const rotateLeadsTask = () => {
  try {
    const metadata = readMetadata();
    const config = metadata.automationConfig || { leadRotationActive: false, rotationHours: 24 };
    
    if (!config.leadRotationActive) return;

    const db = readDb();
    const leads = db.leads || [];
    const employees = (db.employees || []).filter(e => e.status === 'Active' && (e.role === 'Sales' || e.role === 'Employee'));
    if (employees.length === 0) return;
    
    const remarks = db.remarks || [];
    const now = Date.now();
    
    const rotationHours = parseFloat(config.rotationHours) || 24;
    const ROTATION_TIMEOUT = rotationHours * 60 * 60 * 1000; 
    const rotatedSources = config.rotatedSources || [];
    
    let dbChanged = false;
    
    leads.forEach(lead => {
      if (lead.status === 'Won' || lead.status === 'Closed' || lead.status === 'Lost') return;
      if (lead.enableRotation === false) return;
      if (rotatedSources.length > 0 && !rotatedSources.includes(lead.source)) return;
      
      let lastActionTime = new Date(lead.dateAdded || new Date()).getTime();
      
      const leadRemarks = remarks.filter(r => r.targetModule === 'leads' && String(r.targetId) === String(lead.id));
      if (leadRemarks.length > 0) {
        const latestRemark = leadRemarks.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date))[0];
        lastActionTime = new Date(latestRemark.timestamp || latestRemark.date).getTime();
      }
      
      if (now - lastActionTime > ROTATION_TIMEOUT) {
        let pool = employees;
        if (lead.preferredEmployees) {
          const preferredIds = String(lead.preferredEmployees).split(',').map(id => id.trim()).filter(Boolean);
          if (preferredIds.length > 0) {
            const eligibleEmps = employees.filter(e => preferredIds.includes(String(e.id)));
            if (eligibleEmps.length > 0) {
              pool = eligibleEmps;
            }
          }
        }

        const currentEmpId = lead.assignedEmployeeId;
        const currentIndex = pool.findIndex(e => String(e.id) === String(currentEmpId));
        
        const nextIndex = (currentIndex + 1) % pool.length;
        const nextEmp = pool[nextIndex];
        
        if (nextEmp && String(nextEmp.id) !== String(currentEmpId)) {
          lead.assignedEmployeeId = nextEmp.id;
          
          if (!db.remarks) db.remarks = [];
          db.remarks.push({
            id: `REM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            targetModule: 'leads',
            targetId: lead.id,
            comment: `System: Lead rotated automatically from ${pool[currentIndex]?.name || 'unassigned'} to ${nextEmp.name} due to inactivity.`,
            author: 'System Rotation Engine',
            date: new Date().toLocaleDateString('en-IN'),
            timestamp: new Date().toISOString()
          });
          
          if (!db.activity_logs) db.activity_logs = [];
          db.activity_logs.unshift({
            user: 'System',
            action: `Auto-rotated Lead "${lead.name}" to ${nextEmp.name} (inactivity)`,
            timestamp: new Date().toISOString()
          });
          
          dbChanged = true;
        }
      }
    });
    
    if (dbChanged) {
      writeDb(db);
    }
  } catch (err) {
    console.error('Lead Rotation Scheduler Error:', err);
  }
};

function startLeadRotationScheduler() {
  setTimeout(rotateLeadsTask, 10000);
  setInterval(rotateLeadsTask, 5 * 60 * 1000);
}

module.exports = {
  rotateLeadsTask,
  startLeadRotationScheduler
};
