# FinGuide — AI-Powered Personal Finance Manager

> Full-Stack Web Application  
> Built with React 19, Node.js/Express 5, MongoDB, and Google Gemini AI

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Key Features](#2-key-features)
3. [Tech Stack](#3-tech-stack)
4. [System Architecture](#4-system-architecture)
5. [Multi-Agent AI Architecture](#5-multi-agent-ai-architecture)
6. [AI Workflow](#6-ai-workflow)
7. [Database Schema](#7-database-schema)
8. [API Documentation](#8-api-documentation)
9. [Setup Instructions](#9-setup-instructions)
10. [Environment Variables](#10-environment-variables)
11. [Project Structure](#11-project-structure)
12. [Security Design](#12-security-design)
13. [Performance & Scalability](#13-performance--scalability)
14. [Future Enhancements](#14-future-enhancements)

---

## 1. Project Overview

FinGuide is an intelligent personal finance management system that combines traditional CRUD-based expense tracking with a **multi-agent AI architecture** powered by Google Gemini. It moves beyond simple budget apps by providing predictive analytics, conversational financial advice, and automated report generation.

### Problem Statement

Most personal finance apps are passive — they display what you spent but don't tell you *why* it matters or *what to do next*. FinGuide solves this by:

- Computing a **real-time financial health score** using algorithmic scoring (no AI needed for consistency)
- Forecasting **next-month expenses** using statistical models (Weighted Moving Average + Linear Regression)
- Providing a **context-aware AI advisor** that knows your actual income, budgets, and spending trends before answering
- Generating **downloadable PDF reports** with 6 structured sections and AI-written narrative
- Understanding **voice commands** like "Add expense 500 food" or "Show health score"

### Live Demo

| Service | URL |
|---------|-----|
| Frontend | https://finguide-frontend.onrender.com |
| Backend API | https://finguide-backend.onrender.com |
| Health Check | https://finguide-backend.onrender.com/api/health |

---

## 2. Key Features

| Feature | Type | Description |
|---------|------|-------------|
| **Financial Health Score** | Algorithmic | 5-dimension scoring: savings ratio, spending ratio, budget adherence, consistency, growth trend. Score 0–100 with grade (Excellent → Poor) |
| **AI Budget Recommendation** | Gemini AI | 50/30/20 rule adapted to user's actual spending categories |
| **Spending Pattern Analysis** | Gemini AI | Trends, anomalies, and pattern detection across 6 months |
| **Expense Prediction** | Statistical + AI | WMA + Linear Regression forecast for next month; AI narrative explains the numbers |
| **Financial Advisor Chatbot** | Gemini AI | Auto-loads real financial context before every Gemini call; history persisted in MongoDB |
| **Voice Assistant** | Web Speech API | Client-side regex parsing for fast commands; AI fallback for complex queries |
| **Monthly PDF Report** | Gemini AI + PDFKit | 6-section report (Executive Summary → Recommendations) downloadable as PDF |
| **Prediction History** | Statistical | Tracks predicted vs actual; auto-backfills actuals when month passes |
| **Dashboard Widgets** | React | Health score mini-ring, finance overview, last-30-days charts |
| **Income / Expense CRUD** | REST | Add, list, delete, download Excel for both income and expense records |
| **Budget Management** | REST | Create and manage monthly budgets with live utilisation tracking |

---

## 3. Tech Stack

### Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 20+ | Server runtime |
| Framework | Express.js | 5.1.0 | HTTP server, routing |
| Database | MongoDB | Cloud (Atlas) | Primary data store |
| ODM | Mongoose | 8.16.0 | Schema validation, queries |
| AI | Google Gemini | gemini-1.5-flash | Natural language generation |
| AI SDK | @google/generative-ai | 0.24.x | Gemini API client |
| PDF | PDFKit | 0.19.x | Server-side PDF generation |
| Auth | JWT (jsonwebtoken) | 9.x | Stateless authentication |
| Password | bcrypt | 6.x | Password hashing |
| Security | helmet | 8.x | HTTP security headers |
| Rate Limit | express-rate-limit | 7.x | API abuse prevention |
| Compression | compression | 1.x | gzip response bodies |
| Files | multer | 2.x | Profile image uploads |
| Excel | xlsx | 0.18.x | Transaction Excel export |

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | React | 19 | UI framework |
| Build | Vite | 6.x | Dev server and bundler |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Routing | React Router | 7.x | SPA navigation |
| HTTP | Axios | 1.x | API requests |
| Charts | Recharts | 2.x | Financial visualisations |
| Icons | react-icons (lu) | 5.x | Lucide icon set |
| Dates | moment.js | 2.30.x | Date formatting |
| Toasts | react-hot-toast | 2.x | User notifications |
| Voice | Web Speech API | Browser | Voice recognition and TTS |

---

## 4. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  React 19 + Vite + Tailwind CSS 4                                   │    │
│  │                                                                      │    │
│  │  ┌──────────┐ ┌────────────┐ ┌─────────────┐ ┌──────────────────┐  │    │
│  │  │Dashboard │ │ AI Insights│ │  Chatbot    │ │   Predictions    │  │    │
│  │  │  Home    │ │  (7 tabs)  │ │ (persisted) │ │  (chart+history) │  │    │
│  │  └──────────┘ └────────────┘ └─────────────┘ └──────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌────────────────────────────────────────────────────────────────┐ │    │
│  │  │  useVoiceAssistant hook → VoiceAssistant (floating FAB)        │ │    │
│  │  └────────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                          │ HTTPS / REST + JWT                                │
└──────────────────────────┼───────────────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY LAYER (Express 5)                       │
│                                                                              │
│  helmet → compression → cors → rate-limiter → json-parser → routes          │
│                                                                              │
│  /api/v1/auth      (authLimiter:   20/15min)                                │
│  /api/v1/income    (generalLimiter:200/15min)                                │
│  /api/v1/expense   (generalLimiter:200/15min)                                │
│  /api/v1/budget    (generalLimiter:200/15min)                                │
│  /api/v1/dashboard (generalLimiter:200/15min)                                │
│  /api/v1/ai        (aiLimiter:      20/min  )  ← Gemini-backed features     │
│  /api/v1/chat      (aiLimiter:      20/min  )  ← persisted chatbot          │
│  /api/v1/finance   (generalLimiter:200/15min)  ← algorithmic health score   │
│  /api/v1/predictions(generalLimiter:200/15min) ← statistical predictions    │
└──────────────────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────────────────┐
│                    AI ORCHESTRATION LAYER                                    │
│                                                                              │
│                  FinanceAgentCoordinator                                     │
│            (shared context · parallel execution · cache)                    │
│                                                                              │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐                    │
│  │HealthAgt │ │BudgetAgt │ │PredictAgt  │ │InsightAgt│                    │
│  └──────────┘ └──────────┘ └────────────┘ └──────────┘                    │
│  ┌──────────┐ ┌──────────┐                                                  │
│  │ReportAgt │ │AdvisorAgt│                                                  │
│  └──────────┘ └──────────┘                                                  │
│                                                                              │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐           │
│  │   GeminiClient        │   │     AgentCache (TTL Map)          │           │
│  │  (retry + backoff)    │   │  ctx:2m  health:30m pred:1h       │           │
│  └──────────────────────┘   └──────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────────────────┐
│                      SERVICE / DATA LAYER                                    │
│                                                                              │
│  healthScoreService      predictionService      financeDataService           │
│  (pure algorithms)       (WMA + LR)             (MongoDB aggregations)       │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        MongoDB Atlas                                  │   │
│  │   users · incomes · expenses · budgets · chathistories · predictions  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                         ┌──────────┘
                         ▼
              Google Gemini API (gemini-1.5-flash)
```

---

## 5. Multi-Agent AI Architecture

The AI system uses a **coordinator pattern** where six specialized agents each own one domain. The coordinator fetches shared financial context **once per request window** (2-min cache) and passes it to every agent, eliminating redundant DB queries.

```
FinanceAgentCoordinator
│
├── _getContext(userId)           ← ONE shared DB fetch, 2-min TTL
│
├── HealthAgent
│   ├── algorithmicScore(data)    ← pure math, no AI, instant
│   └── enrichedScore(userId, data) ← algo base + Gemini narrative
│
├── BudgetAgent
│   └── getRecommendation(userId, data)  ← 50/30/20 via Gemini
│
├── PredictionAgent
│   ├── getPrediction(userId)     ← delegates to predictionService (WMA+LR)
│   ├── getHistory(userId)        ← last 12 months with actuals
│   └── getEnrichedPrediction()   ← statistical numbers + Gemini narrative
│
├── InsightAgent
│   └── analyzeSpending(userId, data)    ← 6-month pattern analysis
│
├── ReportAgent
│   ├── generateNarrative(userId, year, month) ← 6-section AI report
│   └── generatePDF(report)       ← pdfkit A4 PDF buffer
│
└── AdvisorAgent
    ├── chat(userId, msg, history, ctx)  ← Gemini multi-turn chat
    └── processVoice(userId, transcript, data)  ← intent classification
```

### Why This Design?

| Concern | Solution |
|---------|----------|
| Duplicate DB queries when multiple features load | Shared `_getContext()` cache in coordinator |
| Single Gemini failure blocking all features | `Promise.allSettled()` in `runAllAnalysis()` |
| AI hallucinating health score numbers | Score/grade pinned from `healthScoreService` before AI call |
| Retries on quota/rate-limit errors | GeminiClient has exponential backoff (1s → 2s → 4s) |
| Horizontal scaling | Externalise `AgentCache` Map to Redis (zero API change) |

---

## 6. AI Workflow

### 6.1 Voice Command Flow

```
User speaks
     │
     ▼
Web Speech API → transcript string
     │
     ▼
useVoiceAssistant hook
     │
     ├── CLIENT-SIDE REGEX PARSER (fast path, no API)
     │   ├── "add expense 500 food"  → POST /expense/add + toast
     │   ├── "show health score"     → navigate /ai-insights
     │   ├── "generate report"       → navigate /report
     │   └── "open chatbot"          → navigate /chatbot
     │
     └── AI FALLBACK (if no regex match)
         → POST /api/v1/ai/voice
         → AdvisorAgent.processVoice()
         → Gemini classifies intent + returns { intent, response, action }
         → Frontend executes action (navigate / add_expense / add_income)
         → Optional TTS speaks the response
```

### 6.2 Chatbot Context Injection

```
User sends message
     │
     ▼
chatController.sendMessage()
     │
     ├── financeDataService.getUserFinancialData()   ─┐
     ├── healthScoreService.calculateScoreFromData()  ├─ parallel fetch
     └── PredictionHistory.findOne()                 ─┘
     │
     ▼
buildFinancialContext() → rich system prompt string:
  ════════════════════════════════
  INCOME & BALANCE: ...
  BUDGET: ...
  FINANCIAL HEALTH SCORE: ...
  TOP SPENDING CATEGORIES: ...
  NEXT MONTH PREDICTION: ...
  ADVISOR RULES: ...
  ════════════════════════════════
     │
     ▼
ChatHistory.getRecent(userId, 20) → last 20 messages
     │
     ▼
AdvisorAgent.chat(userId, message, history, systemContext)
     │
     ▼
Gemini multi-turn session → reply
     │
     ▼
ChatHistory.appendExchange(userId, userMsg, reply)  → persisted to MongoDB
     │
     ▼
{ reply, timestamp } → frontend
```

### 6.3 Prediction Engine

```
predictionService.generatePrediction(userId)
     │
     ├── _backfillActuals()
     │     └── For past predictions with null actualExpense:
     │           fetch real data → fill actualExpense, accuracyPercent
     │
     ├── Check 1-hr cache → return early if fresh
     │
     ├── financeDataService.getUserFinancialData()
     │
     ├── monthlyAmounts = monthlyTrends.map(t => t.amount)
     │
     ├── WMA (Weighted Moving Average)
     │     weights = [1, 2, 3]  (most recent gets highest weight)
     │     wmaPrediction = Σ(amount × weight) / Σ(weights)
     │
     ├── Linear Regression
     │     x = month index (0, 1, 2, …)
     │     y = monthly expense amount
     │     slope = (n·Σxy - Σx·Σy) / (n·Σx² - (Σx)²)
     │     R² = 1 - SSres/SStot  (confidence indicator)
     │     nextValue = slope × n + intercept
     │
     ├── Blend
     │     weight = min(dataMonths / 6, 1)
     │     blended = (1 - weight) × WMA + weight × LR
     │     (sparse data → WMA-dominant; rich data → LR-dominant)
     │
     ├── confidence = R² × dataRichness × 100
     │
     └── PredictionHistory.findOneAndUpdate(upsert:true)
```

---

## 7. Database Schema

### Collections Overview

```
MongoDB Atlas — finGuide database
│
├── users             (authentication + profile)
├── incomes           (income transactions)
├── expenses          (expense transactions)
├── budgets           (monthly budget records)
├── chathistories     (per-user conversation history, max 200 messages)
└── predictionhistories (per-user monthly forecasts with actuals)
```

### users

```js
{
  _id:          ObjectId,
  fullName:     String,            // required
  email:        String,            // unique, required
  password:     String,            // bcrypt hash
  profileImage: String,            // URL
  createdAt:    Date,
  updatedAt:    Date
}
```

### incomes

```js
{
  _id:         ObjectId,
  userId:      ObjectId → users,  // indexed
  source:      String,            // "Salary", "Freelance", etc.
  amount:      Number,            // in ₹
  date:        Date,              // indexed
  description: String,
  icon:        String             // emoji
}
```

### expenses

```js
{
  _id:         ObjectId,
  userId:      ObjectId → users,  // indexed
  category:    String,            // "Food", "Travel", etc.
  amount:      Number,            // in ₹
  date:        Date,              // indexed
  description: String,
  icon:        String
}
```

### budgets

```js
{
  _id:       ObjectId,
  userId:    ObjectId → users,
  amount:    Number,              // budget ceiling in ₹
  startDate: Date,
  endDate:   Date
}
```

### chathistories

```js
{
  _id:      ObjectId,
  userId:   ObjectId → users,    // unique (one doc per user)
  messages: [{
    role:      "user" | "model",
    content:   String,           // max 8000 chars
    timestamp: Date
  }],                            // capped at 200 via $slice
  createdAt: Date,
  updatedAt: Date
}
// Static methods:
//   appendExchange(userId, userContent, modelContent)
//   getRecent(userId, limit = 20)
```

### predictionhistories

```js
{
  _id:             ObjectId,
  userId:          ObjectId → users,
  forecastMonth:   Date,           // first day of the forecast month
  predictedExpense:Number,
  predictedSavings:Number,
  categoryPredictions: [{
    category:       String,
    predictedAmount:Number,
    actualAmount:   Number | null  // filled after month passes
  }],
  algorithm:       "wma" | "linear_regression" | "blended",
  confidence:      Number,         // 0–100 (R² × data richness)
  trend:           "increasing" | "decreasing" | "stable",
  dataMonths:      Number,
  actualExpense:   Number | null,  // auto-backfilled
  actualSavings:   Number | null,
  accuracyPercent: Number | null,  // |predicted - actual| / actual × 100
  createdAt:       Date,
  updatedAt:       Date
}
// Indexes: { userId: 1, forecastMonth: 1 } unique
```

---

## 8. API Documentation

All routes require `Authorization: Bearer <token>` except auth routes.  
Base URL: `https://finguide-backend.onrender.com`

### Authentication

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | `{fullName, email, password}` | Register new user |
| POST | `/api/v1/auth/login` | `{email, password}` | Login → returns JWT |
| GET | `/api/v1/auth/getUser` | — | Get current user profile |
| PUT | `/api/v1/auth/update` | `{fullName, ...}` | Update profile |
| DELETE | `/api/v1/auth/delete` | — | Delete account |
| POST | `/api/v1/auth/upload-image` | `multipart/form-data` | Upload profile picture |

### Income

| Method | Path | Body / Params | Description |
|--------|------|--------------|-------------|
| POST | `/api/v1/income/add` | `{source, amount, date, description, icon}` | Add income |
| GET | `/api/v1/income/get` | — | Get all income records |
| DELETE | `/api/v1/income/:id` | — | Delete income |
| GET | `/api/v1/income/downloadexcel` | — | Download Excel |

### Expense

| Method | Path | Body / Params | Description |
|--------|------|--------------|-------------|
| POST | `/api/v1/expense/add` | `{category, amount, date, description, icon}` | Add expense |
| GET | `/api/v1/expense/get` | — | Get all expense records |
| DELETE | `/api/v1/expense/:id` | — | Delete expense |
| GET | `/api/v1/expense/downloadexcel` | — | Download Excel |

### Budget

| Method | Path | Body / Params | Description |
|--------|------|--------------|-------------|
| POST | `/api/v1/budget/add` | `{amount, startDate, endDate}` | Create budget |
| GET | `/api/v1/budget/get` | — | Get active budgets |
| DELETE | `/api/v1/budget/:id` | — | Delete budget |

### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/dashboard` | Aggregated summary: balance, income, expense, recent transactions |

### AI Features

| Method | Path | Body / Query | Description |
|--------|------|-------------|-------------|
| GET | `/api/v1/ai/health-score` | — | AI-enriched health score (Gemini narrative) |
| GET | `/api/v1/ai/budget-recommendation` | — | 50/30/20 budget advice |
| GET | `/api/v1/ai/spending-analysis` | — | 6-month pattern analysis |
| GET | `/api/v1/ai/expense-prediction` | — | Statistical + AI expense forecast |
| POST | `/api/v1/ai/chat` | `{message, history[]}` | One-off chat (no DB persistence) |
| POST | `/api/v1/ai/voice` | `{transcript}` | Voice intent classification |
| GET | `/api/v1/ai/monthly-report` | `?year=&month=` | JSON monthly report |
| GET | `/api/v1/ai/monthly-report/download` | `?year=&month=` | PDF download |
| GET | `/api/v1/ai/all` | — | Run all 4 analysis agents in parallel |

### Chatbot (DB-persisted)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/v1/chat/history` | — | Load full conversation history |
| POST | `/api/v1/chat/message` | `{message}` | Send message (auto-loads context, persists) |
| DELETE | `/api/v1/chat/clear` | — | Clear all chat history |

### Finance (Algorithmic, No AI)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/finance/health-score` | Algorithmic health score — instant, no Gemini call |

### Predictions (Statistical)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/predictions/current` | Generate/return next-month forecast |
| GET | `/api/v1/predictions/history` | Last 12 months with actuals backfilled |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check: status, uptime, env |

---

## 9. Setup Instructions

### Prerequisites

- Node.js 20+
- npm 10+
- MongoDB Atlas account (free tier works)
- Google AI Studio account — get Gemini API key from https://aistudio.google.com/apikey

### Clone & Install

```bash
# Clone the repository
git clone <your-repo-url> FinGuide
cd FinGuide

# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend/finguide
npm install
```

### Configure Environment

```bash
# Copy example env
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/finGuide
JWT_SECRET=<generate-with: openssl rand -hex 64>
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=<your-gemini-api-key-from-aistudio.google.com>
NODE_ENV=development
```

### Run Development Servers

```bash
# Terminal 1 — Backend
cd backend
npm run dev        # or: node server.js

# Terminal 2 — Frontend
cd frontend/finguide
npm run dev
```

Frontend: http://localhost:5173  
Backend API: http://localhost:5000  
Health check: http://localhost:5000/api/health

### Build for Production

```bash
# Frontend
cd frontend/finguide
npm run build      # outputs to dist/

# Backend — set NODE_ENV=production in .env
# Deploy dist/ to a CDN or static host
# Deploy backend to Render / Railway / EC2
```

---

## 10. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Express port (default: 5000) |
| `MONGO_URI` | **Yes** | MongoDB Atlas connection string |
| `JWT_SECRET` | **Yes** | Secret for signing JWTs (min 32 chars, use `openssl rand -hex 64`) |
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key from https://aistudio.google.com/apikey |
| `CLIENT_URL` | No | Frontend origin for CORS (default: all origins) |
| `NODE_ENV` | No | `development` or `production` |

> **Security note:** Never commit `.env` to version control. The `.gitignore` already excludes it.  
> Generate a strong JWT_SECRET with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

---

## 11. Project Structure

```
FinGuide/
│
├── backend/
│   ├── agents/                    # AI orchestration layer
│   │   ├── shared/
│   │   │   ├── GeminiClient.js    # Single Gemini SDK instance + retry
│   │   │   └── AgentCache.js      # Shared TTL cache for all agents
│   │   ├── HealthAgent.js         # Financial health scoring
│   │   ├── BudgetAgent.js         # Budget recommendations
│   │   ├── PredictionAgent.js     # Expense forecasting
│   │   ├── InsightAgent.js        # Spending pattern analysis
│   │   ├── ReportAgent.js         # Monthly report + PDF generation
│   │   ├── AdvisorAgent.js        # Chat + voice intent
│   │   ├── FinanceAgentCoordinator.js  # Orchestrator (main entry point)
│   │   └── FinanceAgent.js        # Legacy (kept for reference)
│   │
│   ├── config/
│   │   ├── db.js                  # MongoDB connection
│   │   └── constants.js           # TTLs, rate limits, shared config
│   │
│   ├── controllers/
│   │   ├── aiController.js        # AI features HTTP adapter
│   │   ├── authController.js      # Register, login, profile
│   │   ├── chatController.js      # Persistent chatbot (context builder)
│   │   ├── dashboardController.js # Aggregated dashboard data
│   │   ├── expenseController.js   # Expense CRUD
│   │   ├── healthScoreController.js# Algorithmic health score
│   │   ├── incomeController.js    # Income CRUD
│   │   ├── budgetController.js    # Budget CRUD
│   │   └── predictionController.js# Statistical predictions
│   │
│   ├── middleware/
│   │   └── authMiddleware.js      # JWT verification → req.user
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Income.js
│   │   ├── Expense.js
│   │   ├── Budget.js
│   │   ├── ChatHistory.js         # Capped at 200 messages/user
│   │   └── PredictionHistory.js   # Forecasts + actuals
│   │
│   ├── routes/
│   │   ├── aiRoutes.js
│   │   ├── authRoutes.js
│   │   ├── budgetRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── expenseRoutes.js
│   │   ├── healthScoreRoutes.js
│   │   ├── incomeRoutes.js
│   │   └── predictionRoutes.js
│   │
│   ├── services/
│   │   ├── financeDataService.js  # MongoDB aggregation layer (no AI)
│   │   ├── healthScoreService.js  # 5-dimension algorithmic scorer
│   │   └── predictionService.js   # WMA + Linear Regression engine
│   │
│   ├── .env                       # Local secrets (git-ignored)
│   ├── .env.example               # Template for new developers
│   ├── package.json
│   └── server.js                  # Express app entry point
│
├── frontend/
│   └── finguide/
│       └── src/
│           ├── components/
│           │   ├── AI/
│           │   │   ├── BudgetRecommendation.jsx
│           │   │   ├── ExpensePrediction.jsx
│           │   │   ├── HealthScoreCard.jsx
│           │   │   ├── PredictionChart.jsx
│           │   │   ├── SpendingPatterns.jsx
│           │   │   └── VoiceAssistant.jsx    # Floating FAB + overlay
│           │   ├── Cards/
│           │   │   ├── InfoCard.jsx
│           │   │   └── TransactionInfoCard.jsx
│           │   ├── Charts/
│           │   │   ├── CustomBarChart.jsx
│           │   │   ├── CustomPieChart.jsx
│           │   │   └── CustomTooltip.jsx
│           │   ├── Dashboard/
│           │   │   ├── FinanceOverview.jsx
│           │   │   ├── HealthScoreWidget.jsx  # Compact ring widget
│           │   │   ├── Last30DaysExpenses.jsx
│           │   │   └── RecentTransactions.jsx
│           │   └── layouts/
│           │       ├── DashboardLayout.jsx    # Includes VoiceAssistant
│           │       ├── Navbar.jsx
│           │       └── SideMenu.jsx
│           │
│           ├── context/
│           │   └── UserContext.jsx            # Global auth state
│           │
│           ├── hooks/
│           │   ├── useUserAuth.js             # Redirect if not logged in
│           │   └── useVoiceAssistant.js       # Web Speech API hook
│           │
│           ├── pages/
│           │   ├── Auth/
│           │   │   ├── Login.jsx
│           │   │   └── SignUp.jsx
│           │   └── Dashboard/
│           │       ├── AIInsights.jsx         # 7-tab AI features
│           │       ├── Budget.jsx
│           │       ├── Chatbot.jsx            # DB-persisted chat
│           │       ├── Expense.jsx
│           │       ├── FinancialReport.jsx    # AI report + PDF download
│           │       ├── Home.jsx               # Main dashboard
│           │       ├── Income.jsx
│           │       └── Predictions.jsx        # Charts + history table
│           │
│           └── utils/
│               ├── apiPaths.js                # All API URLs centralised
│               ├── axiosInstance.js           # Axios + JWT interceptor
│               ├── data.js                    # Sidebar menu config
│               └── helper.js                  # Formatters
│
└── README.md                                  # This file
```

---

## 12. Security Design

| Concern | Mitigation |
|---------|-----------|
| API Key exposure | Stored only in `.env` (server-side). Never sent to frontend. |
| Password storage | bcrypt with default salt rounds (10). |
| Authentication | JWT in `Authorization: Bearer` header. `protect` middleware on every private route. |
| HTTP headers | `helmet` sets CSP, X-Frame-Options, HSTS, and 11 other headers. |
| Brute-force | `express-rate-limit` — 20 auth requests / 15 min per IP. |
| AI abuse | Separate `aiLimiter` — 20 Gemini requests / minute per IP. |
| CORS | Strict origin whitelist in production (`CLIENT_URL`). |
| Request size | `express.json({ limit: '1mb' })` — rejects large payloads. |
| MongoDB injection | Mongoose schema validation + typed fields. |
| Sensitive data | `.env` in `.gitignore`. `MONGO_URI` and `JWT_SECRET` never logged. |

---

## 13. Performance & Scalability

### Current Optimisations

| Area | Implementation |
|------|---------------|
| **Shared DB fetch** | `FinanceAgentCoordinator._getContext()` caches financial data for 2 min — one MongoDB query serves all four AI agents in a page-load burst |
| **Response caching** | `AgentCache` TTL Map: health score 30 min, predictions 1 hr, monthly reports 2 hr |
| **Parallel agents** | `runAllAnalysis()` uses `Promise.allSettled` — four Gemini calls run in parallel |
| **Client-side voice** | Common voice commands parsed with regex — zero API round-trip |
| **Gemini retry** | Exponential backoff on 429/503 — 1 s → 2 s → 4 s |
| **Compression** | gzip on all HTTP responses via `compression` middleware |
| **DB aggregations** | Monthly trends and category history use MongoDB `$group` pipeline — no in-memory grouping |
| **Lean queries** | `.lean()` on all read-only Mongoose queries — returns plain JS objects (faster, less memory) |
| **Prediction cache** | `predictionService` checks 1-hr cache before running WMA/LR algorithms |

### Scaling Path

```
Current (single Node.js process)
  AgentCache = in-memory Map
  → Works fine for < 1000 concurrent users

Scale-out (multiple instances / containers)
  1. Replace AgentCache Map with Redis (same get/set/invalidatePattern API)
  2. Add PM2 cluster mode or horizontal pod autoscaling (HPA) on Kubernetes
  3. Move PDF generation to a background job queue (BullMQ + Redis)
  4. Add CDN for /uploads (Cloudinary or S3 + CloudFront)

Database
  Current: MongoDB Atlas M0 (free tier, shared)
  Scale:   M10+ dedicated cluster with read replicas
           Add indexes: { userId: 1, date: -1 } on income/expense
```

---

## 14. Future Enhancements

### Short-term (next semester)

| Feature | Description |
|---------|-------------|
| **Push Notifications** | Browser notifications when expenses exceed budget or predictions are ready |
| **Recurring Transactions** | Mark income/expense as recurring; auto-create monthly entries |
| **Multi-currency** | Support USD/EUR alongside ₹; conversion via Exchange Rate API |
| **Goal Tracking** | Set savings goals (e.g., ₹50,000 by December); track progress with AI advice |
| **Dark Mode** | System-preference-aware theme toggle |

### Long-term

| Feature | Description |
|---------|-------------|
| **Bank Statement Import** | Upload PDF/CSV bank statements; auto-parse and categorise transactions |
| **Investment Portfolio** | Track mutual funds and stocks; AI-powered portfolio health score |
| **Tax Estimation** | Estimate annual tax liability based on income and deductions (Indian IT Act) |
| **Family Accounts** | Shared budgets and expense tracking across household members |
| **Redis Caching** | Production-grade distributed cache to replace in-memory TTL Map |
| **Gemini Pro Upgrade** | Use gemini-1.5-pro for monthly reports and long-form analysis |
| **Mobile App** | React Native port sharing the same backend API |
| **Audit Log** | Immutable transaction log for financial record-keeping |

---

## Authors

| Role | Name |
|------|------|
| Full-Stack Developer | Vipin Bhati |
| Project Guide | *[Faculty Name]* |
| Institution | *[College Name]*, B.Tech CSE, 2025 |

---

## License

This project is developed as a B.Tech Final Year Project for academic evaluation.  
All rights reserved © 2025 Vipin Bhati.

---

*Built with ❤️ using React, Node.js, MongoDB, and Google Gemini AI*
