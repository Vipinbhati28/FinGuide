'use strict';

/**
 * promptBuilder — All AI prompt templates.
 *
 * Every export is a function that returns a messages array
 * (OpenAI chat format) ready to pass to openRouterService.chat() / chatJSON().
 */

// ── Health Score ───────────────────────────────────────────────────────────────

exports.healthScore = (base, d) => [
    {
        role: 'user',
        content: `You are a certified financial analyst providing personalised feedback.
An algorithm has already scored this user — do NOT change the numeric values.

Score: ${base.score}/100   Grade: ${base.grade}
Strengths:        ${base.strengths.join('; ')}
Weaknesses:       ${base.weaknesses.join('; ')}
Recommendations:  ${base.recommendations.join('; ')}

User context:
  Monthly Income:    Rs.${d.monthlyIncome}
  Monthly Expenses:  Rs.${d.monthlyExpense}
  Savings Rate:      ${d.savingsRate}%
  Budget Used:       ${d.budgetUtilization}%
  Top categories:    ${(d.categoryBreakdown || []).slice(0, 4).map(c => c.category).join(', ')}

Return ONLY valid JSON matching this exact shape — no markdown, no prose:
{
  "score":            ${base.score},
  "grade":            "${base.grade}",
  "summary":          "<3-sentence narrative using the user's real numbers>",
  "breakdown":        ${JSON.stringify(base.breakdown || {})},
  "strengths":        ${JSON.stringify(base.strengths)},
  "weaknesses":       ${JSON.stringify(base.weaknesses)},
  "recommendations":  ${JSON.stringify(base.recommendations)},
  "tips": ["<specific tip 1>", "<tip 2>", "<tip 3>", "<tip 4>", "<tip 5>"]
}`,
    },
];

// ── Budget Recommendation ──────────────────────────────────────────────────────

exports.budgetRecommendation = (d) => [
    {
        role: 'user',
        content: `You are a personal finance advisor applying the 50/30/20 budgeting rule.

User's Spending Profile:
  Monthly Income (last 30d):    Rs.${d.monthlyIncome}
  Monthly Expenses (last 30d):  Rs.${d.monthlyExpense}
  Avg Monthly Expenses:         Rs.${d.avgMonthlyExpense}
  Current Budget Limit:         Rs.${d.currentBudget}
  Category-wise Spend:          ${JSON.stringify(d.categoryBreakdown || [])}

Rules:
  - 50% → essential needs (rent, food, utilities, transport)
  - 30% → discretionary wants
  - 20% → savings + emergency fund
  - Adjust percentages to match the user's actual categories.
  - All amounts in Indian Rupees (Rs.).

Return ONLY valid JSON:
{
  "totalRecommendedBudget": <number>,
  "methodology": "<1-sentence explanation>",
  "categories": [
    {
      "name": "<category>",
      "recommended": <number>,
      "currentSpend": <number>,
      "percentage": <number 0-100>,
      "priority": "<essential|important|optional>",
      "tip": "<specific saving tip>"
    }
  ],
  "savingsTarget":       <number>,
  "savingsPercentage":   <number>,
  "emergencyFundMonths": <number>,
  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"]
}`,
    },
];

// ── Spending Analysis ──────────────────────────────────────────────────────────

exports.spendingAnalysis = (d) => [
    {
        role: 'user',
        content: `You are a financial data analyst. Identify meaningful spending patterns and anomalies.

Monthly Expense History (last 6 months):  ${JSON.stringify(d.monthlyTrends || [])}
Category Breakdown (last 30 days):        ${JSON.stringify(d.categoryBreakdown || [])}
Top 3 Spending Categories:                ${JSON.stringify(d.topCategories || [])}
Month-over-Month Change:                  ${d.momChange > 0 ? '+' : ''}${d.momChange}%

Return ONLY valid JSON:
{
  "overallTrend":    "<increasing|decreasing|stable>",
  "trendPercentage": <positive number>,
  "analysis":        "<3-sentence narrative>",
  "patterns": [
    {
      "title":       "<short pattern name>",
      "description": "<what is happening and why it matters>",
      "impact":      "<positive|negative|neutral>",
      "category":    "<category name or null>"
    }
  ],
  "anomalies": [
    {
      "month":       "<MMM YYYY>",
      "category":    "<category name>",
      "description": "<why this is unusual>",
      "suggestion":  "<corrective action>"
    }
  ],
  "monthlyData": [
    { "month": "<MMM YYYY>", "amount": <number>, "changeFromPrev": <signed percent> }
  ],
  "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>"]
}`,
    },
];

// ── Expense Prediction ────────────────────────────────────────────────────────

exports.expensePrediction = (pred, d) => [
    {
        role: 'user',
        content: `You are a financial forecasting expert. Explain this prediction in plain language.

Statistical Prediction (numbers are fixed — do not change them):
  Predicted Expense:  Rs.${pred.predictedExpense}
  Predicted Savings:  Rs.${pred.predictedSavings}
  Confidence:         ${pred.confidence}%
  Trend:              ${pred.trend}
  Algorithm:          ${pred.algorithm}
  Data Months:        ${pred.dataMonths}
  Category Forecasts: ${JSON.stringify((pred.categoryPredictions || []).slice(0, 5))}

User context:
  Current Monthly Income:  Rs.${d.monthlyIncome}
  Recent Monthly Expense:  Rs.${d.monthlyExpense}
  Month-over-Month Change: ${d.momChange}%

Return ONLY valid JSON:
{
  "summary":                "<2-sentence plain-language explanation>",
  "riskFactors":            ["<risk 1>", "<risk 2>"],
  "savingOpportunities":    ["<opportunity 1>", "<opportunity 2>"],
  "confidenceExplanation":  "<1 sentence on why confidence is ${pred.confidence}%>"
}`,
    },
];

// ── Financial Chat (system context built inline in financeAgent.js) ───────────
// No separate prompt — financeAgent.financialChat() assembles the messages array directly.

// ── Voice Command ─────────────────────────────────────────────────────────────

exports.voiceCommand = (transcript, d) => [
    {
        role: 'user',
        content: `You are FinGuide Voice Assistant. Parse this spoken command into a structured response.

Spoken Command: "${transcript}"

User's Financial Snapshot:
  Balance:          Rs.${(d.totalIncome || 0) - (d.totalExpense || 0)}
  Monthly Income:   Rs.${d.monthlyIncome || 0}
  Monthly Expenses: Rs.${d.monthlyExpense || 0}
  Budget Remaining: Rs.${d.budgetLeft || 0} of Rs.${d.totalBudget || 0}
  Top Categories:   ${(d.topCategories || []).join(', ')}

Intent taxonomy:
  balance_query | expense_query | income_query | budget_query |
  add_expense | add_income | advice | navigate | general

Navigation routes: /dashboard /income /expense /budget /ai-insights /chatbot /report /predictions

"response" must sound natural when spoken aloud — conversational, max 2 sentences.

Return ONLY valid JSON:
{
  "intent":   "<intent>",
  "response": "<spoken reply with real numbers>",
  "data": {
    "amount":    <number or null>,
    "category":  "<category or null>",
    "timeframe": "<today|week|month or null>"
  },
  "action": {
    "type":    "<navigate|add_expense|add_income|none>",
    "route":   "<route or null>",
    "payload": <{amount, category, description} or null>
  }
}`,
    },
];

// ── Monthly Report ────────────────────────────────────────────────────────────

exports.monthlyReport = (d, latestPred) => [
    {
        role: 'user',
        content: `You are a senior financial analyst writing a formal monthly financial report in Indian Rupees.

Report Period: ${d.reportMonth}

Key Metrics:
  Total Income:       Rs.${d.totalIncome}
  Total Expenses:     Rs.${d.totalExpense}
  Net Savings:        Rs.${d.netSavings}  (${d.savingsRate}% rate)
  Budget Limit:       Rs.${d.totalBudget}
  Budget Used:        Rs.${d.budgetUsed}   Budget Remaining: Rs.${d.budgetLeft}
  Transactions:       ${d.transactionCount}
  Daily Avg Spend:    Rs.${d.dailyAvgSpend}
  vs Previous Month:  Income ${d.incomeChange > 0 ? '+' : ''}${d.incomeChange}%,
                      Expenses ${d.expenseChange > 0 ? '+' : ''}${d.expenseChange}%
  Category Breakdown: ${JSON.stringify(d.categoryBreakdown || [])}
  Income Sources:     ${JSON.stringify(d.incomeSources || [])}
${latestPred ? `  Next Month Prediction: Rs.${latestPred.predictedExpense} (${latestPred.confidence}% confidence)` : ''}

Return ONLY valid JSON:
{
  "reportTitle":      "Financial Report — ${d.reportMonth}",
  "generatedAt":      "<ISO 8601 timestamp>",
  "executiveSummary": "<4-5 sentence professional summary>",
  "performanceScore": <integer 0-100>,
  "performanceGrade": "<Excellent|Good|Average|Below Average|Poor>",
  "highlights": [
    { "type": "<achievement|concern|insight>", "title": "<short>", "description": "<1 sentence>" }
  ],
  "incomeAnalysis": {
    "summary": "<2-sentence analysis>",
    "sources": [{ "name": "<source>", "amount": <number>, "percentage": <number> }]
  },
  "expenseAnalysis": {
    "summary": "<2-sentence analysis>",
    "topCategories": [{ "category": "<name>", "amount": <number>, "percentage": <number>, "vs_budget": "<over budget|under budget|on track>" }]
  },
  "budgetAnalysis": {
    "summary":         "<2-sentence budget adherence analysis>",
    "utilized":        <integer 0-100>,
    "status":          "<under_budget|on_track|over_budget>",
    "recommendations": ["<rec 1>", "<rec 2>"]
  },
  "predictionAnalysis": {
    "nextMonthForecast": <number or null>,
    "confidence":        <number or null>,
    "trend":             "<increasing|decreasing|stable or null>",
    "summary":           "<1-sentence forward-looking comment>"
  },
  "goalsAndRecommendations": {
    "nextMonthGoals": ["<goal 1>", "<goal 2>", "<goal 3>"],
    "actionItems":    ["<action 1>", "<action 2>", "<action 3>"],
    "longTermAdvice": "<2-sentence wealth-building advice>"
  },
  "motivationalMessage": "<personalised closing message>"
}`,
    },
];
