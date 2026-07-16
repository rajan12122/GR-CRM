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
      // API call to Gemini model
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
  const pLower = prompt.toLowerCase();
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

  // 6. DEFAULT CUSTOMER SUMMARY & JOURNEY
  const item = context.customer || context.lead || {};
  const cName = item.name || "Client";
  const budgetStr = item.budget || "N/A";
  const rmName = context.employeeName || "RM";

  return `### AI Customer 360 Summary
**Client Name:** ${cName}
**Budget Segment:** ${budgetStr}
**TIMELINE:** Active buyer seeking immediate layouts.
**JOURNEY:** Lead created. Site visits, call follow-ups, and property pitches logged under history.
**RECOMMENDED NEXT ACTION:** Contact within 24 hours to schedule secondary site visit or share payment plans.
**Assigned Employee:** ${rmName}
`;
}

module.exports = {
  generateAIResponse
};
