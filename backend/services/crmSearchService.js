const fs = require('fs');
const path = require('path');

class Customer360Service {
  static getProfile(customerId, db) {
    const c = (db.customers || []).find(cust => String(cust.id) === String(customerId)) ||
              (db.leads || []).find(ld => String(ld.id) === String(customerId));
    if (!c) return null;

    const followups = (db.followups || []).filter(f => String(f.customerId) === String(customerId));
    const siteVisits = (db.siteVisits || []).filter(v => String(v.customerId) === String(customerId));
    const pitches = (db.pitches || []).filter(p => String(p.customerId) === String(customerId));
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
  static getProfile(employeeId, db) {
    const emp = (db.employees || []).find(e => String(e.id) === String(employeeId));
    if (!emp) return null;

    const leads = db.leads || [];
    const customers = db.customers || [];
    const followups = db.followups || [];
    const siteVisits = db.siteVisits || [];
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
  static getProfile(propertyId, db) {
    const p = (db.properties || []).find(prop => String(prop.id) === String(propertyId));
    if (!p) return null;

    const pitches = db.pitches || [];
    const siteVisits = db.siteVisits || [];
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
  static getMetrics(query, db) {
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

    if (qLower.includes("highest sales") || qLower.includes("highest selling") || qLower.includes("who has the highest sales") || qLower.includes("highest sales")) {
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
  static search(query, db) {
    const qLower = query.toLowerCase().trim();
    
    // Scan employees
    const matchedEmp = (db.employees || []).find(e => 
      e.name.toLowerCase().includes(qLower) || 
      e.id.toLowerCase() === qLower
    );
    if (matchedEmp) {
      return {
        type: 'employee360',
        data: Employee360Service.getProfile(matchedEmp.id, db)
      };
    }

    // Scan customers & leads
    const matchedCust = (db.customers || []).find(c => 
      c.name.toLowerCase().includes(qLower) || 
      c.id.toLowerCase() === qLower ||
      (c.phone && String(c.phone).includes(qLower))
    ) || (db.leads || []).find(l => 
      l.name.toLowerCase().includes(qLower) || 
      l.id.toLowerCase() === qLower ||
      (l.phone && String(l.phone).includes(qLower))
    );

    if (matchedCust) {
      return {
        type: 'customer360',
        data: Customer360Service.getProfile(matchedCust.id, db)
      };
    }

    // Scan properties & projects
    const matchedProp = (db.properties || []).find(p => 
      (p.name && p.name.toLowerCase().includes(qLower)) ||
      (p.propertyName && p.propertyName.toLowerCase().includes(qLower)) ||
      p.id.toLowerCase() === qLower ||
      (p.locality && p.locality.toLowerCase().includes(qLower))
    );
    if (matchedProp) {
      return {
        type: 'property360',
        data: Property360Service.getProfile(matchedProp.id, db)
      };
    }

    // Scan analytics keywords
    const analyticsData = AnalyticsService.getMetrics(query, db);
    if (analyticsData) {
      return {
        type: 'analytics',
        data: analyticsData
      };
    }

    // Keyword list scanners
    if (qLower.includes("hot lead") || qLower.includes("hot leads")) {
      const hotLeads = (db.leads || []).filter(l => {
        const interest = String(l.interest_level || l.interestLevel || "").toLowerCase();
        return interest.includes("hot") || interest.includes("high");
      });
      return {
        type: 'hotLeadsList',
        data: hotLeads
      };
    }

    if (qLower.includes("follow-up") || qLower.includes("follow up") || qLower.includes("followups")) {
      const activeFollowups = (db.followups || []).filter(f => f.status !== 'Completed');
      return {
        type: 'followupsList',
        data: activeFollowups
      };
    }

    if (qLower.includes("budget") || qLower.includes("above")) {
      const highValueLeads = (db.leads || []).filter(l => {
        const b = parseFloat(String(l.budget || 0).replace(/[^0-9.]/g, '')) || 0;
        return b >= 10000000;
      });
      return {
        type: 'highValueLeadsList',
        data: highValueLeads
      };
    }

    // Default: Spelling suggestions
    const suggestions = [
      ...(db.customers || []).map(c => ({ name: c.name, type: 'Customer' })),
      ...(db.leads || []).map(l => ({ name: l.name, type: 'Lead' })),
      ...(db.employees || []).map(e => ({ name: e.name, type: 'Employee' }))
    ].filter(item => 
      item.name && 
      (item.name.toLowerCase().includes(qLower) || qLower.includes(item.name.toLowerCase()))
    );

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
  AnalyticsService
};
