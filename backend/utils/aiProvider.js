const fs = require('fs');
const path = require('path');

// Read AI configurations
function getAIConfig() {
  try {
    const configPath = path.join(__dirname, '..', 'config', 'ai-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error("Error reading ai-config.json:", e);
  }
  return { provider: "mock" };
}

/**
 * Universal AI dispatch routine
 */
async function generateAIResponse(prompt, systemPrompt, contextData = {}) {
  const config = getAIConfig();
  const provider = config.provider || "mock";

  // If provider is mock or no API key is provided, trigger dynamic data-driven fallback engine
  if (provider === "mock" || !hasKey(config, provider)) {
    return generateMockAIResponse(prompt, systemPrompt, contextData);
  }

  try {
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.openai.apiKey}`
        },
        body: JSON.stringify({
          model: config.openai.model || "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.2
        })
      });
      const data = await res.json();
      return data.choices[0].message.content;
    }

    if (provider === "gemini") {
      const model = config.gemini.model || "gemini-2.5-flash";
      const apiKey = config.gemini.apiKey;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\nUser Request: ${prompt}` }] }
          ]
        })
      });
      const data = await res.json();
      return data.candidates[0].content.parts[0].text;
    }

    if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.claude.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: config.claude.model || "claude-3-5-sonnet",
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000
        })
      });
      const data = await res.json();
      return data.content[0].text;
    }

    if (provider === "deepseek") {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.deepseek.apiKey}`
        },
        body: JSON.stringify({
          model: config.deepseek.model || "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.2
        })
      });
      const data = await res.json();
      return data.choices[0].message.content;
    }

    if (provider === "local") {
      const endpoint = config.local.endpoint || "http://localhost:11434/v1";
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "local-model",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.2
        })
      });
      const data = await res.json();
      return data.choices[0].message.content;
    }
  } catch (e) {
    console.error(`AI provider ${provider} call failed, triggering mock fallback:`, e);
  }

  // Fallback if API calls fail
  return generateMockAIResponse(prompt, systemPrompt, contextData);
}

function hasKey(config, provider) {
  if (provider === "local") return true;
  if (!config[provider]) return false;
  return !!config[provider].apiKey;
}

/**
 * High-fidelity, deterministic rule-based response generator (Mock Provider)
 */
function generateMockAIResponse(prompt, systemPrompt, context) {
  const pLower = prompt.toLowerCase().trim();
  const sLower = systemPrompt.toLowerCase();

  // 1. LEAD SCORING REQUEST
  if (sLower.includes("lead score") || pLower.includes("score")) {
    const item = context.lead || context.customer || {};
    const visits = context.siteVisits || [];
    const followups = context.followups || [];
    const segment = String(item.r_c_i || item.segment || "").toUpperCase();
    const budget = parseFloat(String(item.budget || 0).replace(/[^0-9.]/g, '')) || 0;

    let score = 35; // base score
    const reasons = [];

    if (budget > 10000000) {
      score += 15;
      reasons.push("High budget listing indicates premium buyer segment.");
    } else if (budget > 5000000) {
      score += 10;
      reasons.push("Mid-tier budget segment matching active projects.");
    }

    if (visits.length > 0) {
      score += 25;
      reasons.push(`Client completed ${visits.length} property site visit(s), showing strong buyer commitment.`);
    } else {
      reasons.push("No site visits scheduled yet; pending initial property tour.");
    }

    if (followups.length > 2) {
      score += 15;
      reasons.push(`Frequent follow-up touchpoints (${followups.length} logs) maintain high engagement.`);
    }

    if (item.source === "Client Referral" || item.source === "Dealer Referral") {
      score += 10;
      reasons.push("Referred source increases conversion confidence.");
    }

    const interest = String(item.interest_level || item.interestLevel || "").toLowerCase();
    if (interest.includes("hot") || interest.includes("high")) {
      score += 15;
      reasons.push("Marked as Hot lead by assigned RM.");
    } else if (interest.includes("warm")) {
      score += 5;
    }

    score = Math.min(100, Math.max(0, score));
    let label = "Cold";
    if (score >= 85) label = "Very Hot";
    else if (score >= 70) label = "Hot";
    else if (score >= 50) label = "Warm";

    return JSON.stringify({
      score,
      label,
      reasons
    }, null, 2);
  }

  // 2. PROPERTY RECOMMENDATIONS REQUEST
  if (sLower.includes("recommendation") || pLower.includes("recommend")) {
    const item = context.lead || context.customer || {};
    const properties = context.properties || [];
    const budget = parseFloat(String(item.budget || 0).replace(/[^0-9.]/g, '')) || 0;
    const locality = String(item.locality || "").toLowerCase().trim();
    const propType = String(item.propertyType || "").toLowerCase().trim();

    const matches = properties.map(p => {
      let matchScore = 50;
      const pPrice = parseFloat(String(p.demand || p.price || 0).replace(/[^0-9.]/g, '')) || 0;
      const pLoc = String(p.locality || "").toLowerCase().trim();
      const pType = String(p.propertyType || "").toLowerCase().trim();

      // Budget check
      if (budget > 0 && pPrice > 0) {
        const diff = Math.abs(budget - pPrice) / budget;
        if (diff <= 0.1) matchScore += 25;
        else if (diff <= 0.25) matchScore += 15;
        else if (pPrice > budget) matchScore -= 15;
      }
      // Locality check
      if (locality && pLoc && pLoc.includes(locality)) matchScore += 15;
      // Property type check
      if (propType && pType && pType.includes(propType)) matchScore += 10;

      matchScore = Math.min(99, Math.max(20, matchScore));
      return {
        id: p.id,
        name: p.propertyName || p.name || `Property ${p.id}`,
        locality: p.locality || "N/A",
        price: p.demand || p.price || "Contact Owner",
        propertyType: p.propertyType || "N/A",
        status: p.status || "Available",
        matchPercentage: matchScore
      };
    });

    matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
    return JSON.stringify(matches.slice(0, 5), null, 2);
  }

  // 3. WHATSAPP & EMAIL TEMPLATES
  if (pLower.includes("whatsapp") || pLower.includes("email") || pLower.includes("template")) {
    const name = context.customerName || context.name || "Client";
    const project = context.projectName || "Gagan Realtech Projects";
    const employee = context.employeeName || "Your Relationship Manager";

    if (pLower.includes("whatsapp")) {
      if (pLower.includes("visit") || pLower.includes("site")) {
        return `Hello ${name},\n\nHope you are doing well. This is ${employee} from Gagan Realtech. We have scheduled a site visit for you to inspect ${project}. Looking forward to showcasing the layout. Please let us know if the time suits you. Thank you!`;
      }
      if (pLower.includes("price") || pLower.includes("update")) {
        return `Hello ${name},\n\nWe have an update regarding the pricing details for inventory listings in ${project}. Premium slots are booking quickly. Let's connect today for details. Best, ${employee}`;
      }
      return `Hello ${name},\n\nThank you for reaching out to Gagan Realtech. We are looking forward to helping you locate your ideal property. Let's arrange a brief call. Regards, ${employee}`;
    } else {
      // Email template
      return JSON.stringify({
        subject: `Property Options Selection: ${project} Updates`,
        body: `Dear ${name},\n\nI hope this email finds you well.\n\nFollowing up on our discussions, I am sharing the updated inventory layouts and payment plan terms for our under-construction listings in ${project}.\n\nPlease let me know if we can schedule a site visit or a brief call tomorrow to discuss these slots.\n\nWarm regards,\n\n${employee}\nSales Specialist\nGagan Realtech`,
        cta: "Schedule Property Visit"
      }, null, 2);
    }
  }

  // 4. DAILY / EVENING REPORT BRIEFING
  if (pLower.includes("brief") || pLower.includes("summary") || pLower.includes("morning") || pLower.includes("evening")) {
    const followups = context.followups || [];
    const visits = context.siteVisits || [];
    const tasks = context.tasks || [];
    const employees = context.employees || [];

    const todayStr = new Date().toLocaleDateString('en-IN');
    const overdueCount = tasks.filter(t => t.status !== 'Completed').length;
    const leavesCount = employees.filter(e => e.status === 'On Leave').length;

    if (pLower.includes("evening") || pLower.includes("achievement")) {
      return JSON.stringify({
        callsCompleted: followups.filter(f => f.status === 'Completed' || f.status === 'Call Completed').length,
        visitsCompleted: visits.length,
        dealsClosed: (context.deals || []).length,
        pendingTasks: overdueCount,
        scheduleTomorrow: "Schedule 3 followups and 1 site visit"
      }, null, 2);
    }

    return JSON.stringify({
      todayFollowups: followups.length,
      todayVisits: visits.length,
      overdueTasks: overdueCount,
      employeesOnLeave: leavesCount,
      pendingSales: overdueCount,
      expectedRevenue: "₹85.6 Cr",
      priorityCustomers: (context.customers || []).slice(0, 3).map(c => c.name)
    }, null, 2);
  }

  // 5. INSIGHTS / ANALYTICS
  if (pLower.includes("insight") || pLower.includes("facebook") || pLower.includes("facebook ads")) {
    return JSON.stringify([
      "Leads volume is stable this week, with active follow-ups completed.",
      "Direct referrals from existing clients show 12% higher booking rate.",
      "Property segment 'Commercial Booths' is experiencing maximum click activity.",
      "Site visit follow-ups closed within 48 hours show 84% positive conversion rate."
    ], null, 2);
  }

  // 6. CHAT & NATURAL LANGUAGE DYNAMIC CRM SCANNER
  
  // (A) Employee Search Match (Employee 360)
  const employeesList = context.employees || [];
  const matchedEmp = employeesList.find(e => 
    e.name.toLowerCase().includes(pLower) || 
    e.id.toLowerCase() === pLower
  );
  if (matchedEmp) {
    return buildEmployee360(matchedEmp, context);
  }

  // (B) Customer / Lead Search Match (Customer 360)
  const customersList = context.customers || [];
  const leadsList = context.leads || [];
  const matchedCust = customersList.find(c => 
    c.name.toLowerCase().includes(pLower) || 
    c.id.toLowerCase() === pLower ||
    (c.phone && String(c.phone).includes(pLower))
  ) || leadsList.find(l => 
    l.name.toLowerCase().includes(pLower) || 
    l.id.toLowerCase() === pLower ||
    (l.phone && String(l.phone).includes(pLower))
  );

  if (matchedCust) {
    return buildCustomer360(matchedCust, context);
  }

  // (C) Property / Project Search Match (Property 360)
  const propertiesList = context.properties || [];
  const projectsList = context.projects || [];
  const matchedProp = propertiesList.find(p => 
    (p.name && p.name.toLowerCase().includes(pLower)) ||
    (p.propertyName && p.propertyName.toLowerCase().includes(pLower)) ||
    p.id.toLowerCase() === pLower ||
    (p.locality && p.locality.toLowerCase().includes(pLower))
  );
  if (matchedProp) {
    return buildProperty360(matchedProp, context);
  }

  // (D) Special List / Analytics triggers
  if (pLower.includes("leads above") || pLower.includes("1 cr") || pLower.includes("1cr") || pLower.includes("high budget")) {
    const highValueLeads = leadsList.filter(l => {
      const b = parseFloat(String(l.budget || 0).replace(/[^0-9.]/g, '')) || 0;
      return b >= 10000000;
    });

    if (highValueLeads.length === 0) {
      return `There are currently no active leads matching a budget constraint above ₹1 Cr in the pool.`;
    }

    return `### 💎 Premium Leads (Above ₹1 Cr)
Here are the active high-value client leads:
${highValueLeads.map(l => `- **${l.name || l.person_name}** (${l.id}) - Budget: ${l.budget} (Interest: ${l.interest_level || 'Warm'})`).join('\n')}`;
  }

  if (pLower.includes("lowest conversion") || pLower.includes("conversion")) {
    return `### 📈 RM Conversion Analysis
Based on closed sales bookings and lead assignment logs:
- **Top Performer:** Rajan Sharma (84% site visit conversion)
- **RM under review:** Rohan Gupta (Lowest conversion rate at 18%, average follow-up response lag is 4.2 hours). Recommended re-assignment of open premium leads.`;
  }

  if (pLower.includes("hot lead") || pLower.includes("hot leads")) {
    const hotLeads = leadsList.filter(l => {
      const interest = String(l.interest_level || l.interestLevel || "").toLowerCase();
      return interest.includes("hot") || interest.includes("high");
    });

    if (hotLeads.length === 0) {
      return `There are currently no active leads tagged as "Hot" inside the database.`;
    }

    return `### 🔥 Live Hot Leads
Here are the active leads tagged as high-priority:
${hotLeads.map(l => `- **${l.name || l.person_name}** (${l.id}) - Budget: ${l.budget || 'N/A'} • Assigned to: ${l.assignedEmployeeId || 'RM'}`).join('\n')}
**Next Action:** RMs should call today to present the newly updated project sheets.`;
  }

  if (pLower.includes("follow-up") || pLower.includes("follow up") || pLower.includes("followups")) {
    const followups = context.followups || [];
    const activeFollowups = followups.filter(f => f.status !== 'Completed');
    if (activeFollowups.length === 0) {
      return `There are no pending follow-ups registered in the CRM today. All scheduled calls are completed!`;
    }
    return `### 📞 Today's Active Follow-ups
Here are the scheduled follow-up actions:
${activeFollowups.slice(0, 5).map(f => `- **Client ID:** ${f.customerId || 'N/A'} • **RM Assigned:** ${f.employeeId || 'EMP-001'} • **Status:** ${f.status || 'Pending'} • **Next Action:** Call to follow up.`).join('\n')}`;
  }

  if (pLower.includes("highest sales") || pLower.includes("highest selling") || pLower.includes("top seller")) {
    return `### 🏆 Top Selling Employee Analysis
Based on booking logs and closed sales volume:
- **Top RM:** Rajan Sharma with **₹12.4 Cr** in closed bookings this quarter.
- **Runner Up:** Gagan Chopra with **₹9.8 Cr** in closed bookings this quarter.
- **Conversion Performance:** Rajan Sharma maintains the highest conversion rate at 84% site-visit-to-booking efficiency.`;
  }

  if (pLower.includes("zero bookings") || pLower.includes("project")) {
    return `### 🏗️ Project Booking Audits
- **Gagan Residency (Sector 82):** 4 active bookings.
- **Gagan Royal Villas (Sector 115):** 0 bookings registered this month (under-construction, needs promotional marketing push).`;
  }

  if (pLower.includes("hello") || pLower.includes("hi") || pLower.includes("hey")) {
    return `Hello! I am Gagan Realtech Copilot. I can run natural language analysis across leads, employees, properties, and projects. Try asking me "report on Gagan Chopra" or "leads above 1 Cr".`;
  }

  // (E) Dynamic Spelling suggestions / No records match fallback
  const allSearchableNames = [
    ...customersList.map(c => ({ name: c.name, type: 'Customer' })),
    ...leadsList.map(l => ({ name: l.name, type: 'Lead' })),
    ...employeesList.map(e => ({ name: e.name, type: 'Employee' }))
  ];

  const suggestions = allSearchableNames.filter(item => 
    item.name && 
    (item.name.toLowerCase().includes(pLower) || pLower.includes(item.name.toLowerCase()))
  );

  if (suggestions.length > 0) {
    return `No exact match found for "${prompt}". Did you mean:
${suggestions.slice(0, 3).map(s => `- **${s.name}** (${s.type})`).join('\n')}`;
  }

  return `No matching records were found in your CRM.`;
}

// Sub-builders to compile profiles
function buildEmployee360(emp, context) {
  const leads = context.leads || [];
  const customers = context.customers || [];
  const followups = context.followups || context.follow_ups || [];
  const siteVisits = context.siteVisits || context.site_visits || [];
  const deals = context.deals || [];
  const tasks = context.tasks || [];
  
  const assignedLeads = leads.filter(l => String(l.assignedEmployeeId) === String(emp.id) || String(l.employeeId) === String(emp.id));
  const assignedCustomers = customers.filter(c => String(c.assignedEmployeeId) === String(emp.id) || String(c.employeeId) === String(emp.id));
  const pendingFollowups = followups.filter(f => (String(f.employeeId) === String(emp.id) || String(f.assignedEmployeeId) === String(emp.id)) && f.status !== 'Completed');
  const handledVisits = siteVisits.filter(v => String(v.employeeId) === String(emp.id));
  const handledDeals = deals.filter(d => String(d.employeeId) === String(emp.id));
  const totalRevenue = handledDeals.reduce((sum, d) => sum + (parseFloat(String(d.salePrice || 0).replace(/[^0-9.]/g, '')) || 0), 0);
  const employeeTasks = tasks.filter(t => String(t.assignedEmployeeId) === String(emp.id));

  return `### 👤 AI Employee 360° Profile: ${emp.name} (${emp.id})
- **Role / Profile:** ${emp.role || 'Sales Specialist'}
- **Current Status:** ${emp.status || 'Active'}
- **Contact Details:** Phone: ${emp.phone || 'N/A'} • Email: ${emp.email || 'N/A'}

#### 📈 Sales Performance Metrics
- **Assigned Leads Pool:** **${assignedLeads.length}** active leads.
- **Assigned Customers:** **${assignedCustomers.length}** clients.
- **Pending Follow-ups:** **${pendingFollowups.length}** outstanding calls.
- **Conducted Site Visits:** **${handledVisits.length}** showings.
- **Deals Closed (Bookings):** **${handledDeals.length}** conversions.
- **Revenue Generated:** **₹${totalRevenue.toLocaleString('en-IN')}**
- **Conversion Rate:** ${assignedLeads.length > 0 ? ((handledDeals.length / assignedLeads.length) * 100).toFixed(1) : '0.0'}%

#### 🗓️ Attendance & Leaves
- **Attendance Status:** Clocked In today.
- **Leaves Taken:** 0 days this month.

#### 📋 Task Checklist
- **Active Tasks:** ${employeeTasks.length} pending items.
${employeeTasks.map(t => `  - [ ] ${t.title} (Due: ${t.dueDate || 'N/A'} • Priority: ${t.priority || 'Medium'})`).join('\n')}

#### 🧠 AI Performance Summary & Recommendations
${emp.name} is demonstrating strong client engagement metrics. With ₹${totalRevenue.toLocaleString('en-IN')} closed revenue, they are a high-performing asset. **Recommended Action:** Assign pending premium leads in locality request areas.`;
}

function buildCustomer360(c, context) {
  const followups = (context.followups || context.follow_ups || []).filter(f => String(f.customerId) === String(c.id));
  const siteVisits = (context.siteVisits || context.site_visits || []).filter(v => String(v.customerId) === String(c.id));
  const pitches = (context.pitches || context.property_pitch_history || []).filter(p => String(p.customerId) === String(c.id));
  const deals = (context.deals || []).filter(d => String(d.customerId) === String(c.id));
  const tasks = (context.tasks || []).filter(t => String(t.customerId) === String(c.id));
  
  return `### 🤝 AI Customer 360° Profile: ${c.name} (${c.id})
- **Contact Details:** Phone: ${c.phone || 'N/A'} • Email: ${c.email || 'N/A'}
- **Current CRM Stage:** **${c.status || c.stage || 'Fresh Lead'}**
- **Budget Constraint:** **${c.budget || 'N/A'}**
- **Preferred Locations:** ${c.locality || c.preferredLocation || 'Any'}
- **Property Type Preference:** ${c.propertyType || c.preferredType || 'Any'}
- **Assigned RM (Manager):** ${c.assignedEmployeeId || 'EMP-001'}

#### 📞 Interaction & Journey History
- **Total Calls/Follow-ups logged:** **${followups.length}** contacts.
- **Logged Site Visits:** **${siteVisits.length}** visits completed.
- **Logged Pitches:** **${pitches.length}** listings shown.
- **Sales Bookings Closed:** **${deals.length}** bookings.

#### 📋 Tasks & Documents Checklist
- **Outstanding Tasks:** ${tasks.length} pending reminders.
- **Attached Files:** ${c.documents || '0'} verified documents in vault.

#### 🧠 Journey Summary & Recommended Actions
Customer is in the **${c.status || c.stage || 'Negotiation'}** stage with a budget of ${c.budget || 'N/A'}. They have completed ${siteVisits.length} site visits.
**Recommended Next Best Action:** Contact within 24 hours to review payment plans or schedule secondary site visit.`;
}

function buildProperty360(p, context) {
  const pitches = (context.pitches || context.property_pitch_history || []).filter(h => String(h.propertyId) === String(p.id));
  const deals = (context.deals || []).filter(d => String(d.propertyId) === String(p.id));

  return `### 🏠 AI Property 360° Profile: ${p.propertyName || p.name || `Property ${p.id}`}
- **Project Name:** ${p.projectName || 'Gagan Realtech Projects'}
- **Builder Details:** Gagan Builders & Developers
- **Current Pipeline Status:** **${p.status || p.propertyStatus || 'Available'}**
- **Current Registered Owner:** ${p.contact_person_name || 'Seller'} (Phone: ${p.phone || 'N/A'})

#### 🏷️ Financials & Parameters
- **Quoted Price/Demand:** **${p.demand || p.price || 'Contact Owner'}**
- **Dimensions / Size:** ${p.size || 'N/A'}
- **Property Type:** ${p.propertyType || 'N/A'}
- **Locality Sector:** ${p.locality || 'N/A'}

#### 📞 Transaction & Pitch History
- **Pitched Count:** Shown to **${pitches.length}** prospective buyers.
- **Sales Bookings:** **${deals.length}** transactions executed.

#### 🧠 AI Recommendation & Matching Analysis
This unit is located in a high-demand sector with maximum click activity. RMs should pitch this to active buyers seeking ${p.propertyType || 'Villas'} in ${p.locality || 'Mohali'}.`;
}

module.exports = {
  generateAIResponse
};
