/**
 * FinGuide Backend — Express entry point.
 *
 * Middleware order (intentional):
 *   1. helmet       — security headers (first, before anything touches the response)
 *   2. compression  — gzip response bodies
 *   3. cors         — cross-origin policy
 *   4. rate-limiter — per-route limits BEFORE the body is parsed (saves CPU on floods)
 *   5. json parser  — parse request bodies
 *   6. routes       — business logic
 *   7. error handler— catch-all for unhandled throws
 */
// Hello

'use strict';

require('dotenv').config();

// ── Startup environment validation ───────────────────────────────────────────
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'GEMINI_API_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
    console.error(`[startup] ❌  Missing required environment variables: ${missing.join(', ')}`);
    console.error('[startup]     Add them to backend/.env and restart.\n');
    // Warn but don't exit — allow running without GEMINI_API_KEY in dev
}

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
const connectDB    = require('./config/db');
const { RATE_LIMIT } = require('./config/constants');

// ── Route imports ────────────────────────────────────────────────────────────
const authRoutes       = require('./routes/authRoutes');
const incomeRoutes     = require('./routes/incomeRoutes');
const expenseRoutes    = require('./routes/expenseRoutes');
const dashboardRoutes  = require('./routes/dashboardRoutes');
const budgetRoutes     = require('./routes/budgetRoutes');
const aiRoutes         = require('./routes/aiRoutes');
const chatRoutes       = require('./routes/chatRoutes');
const healthScoreRoutes = require('./routes/healthScoreRoutes');
const predictionRoutes = require('./routes/predictionRoutes');

const app = express();

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow /uploads images
}));

// ── Performance ───────────────────────────────────────────────────────────────
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────────────────────
// Build the allowed-origin set from env vars.
// Always include localhost so the dev server works regardless of NODE_ENV.
// CLIENT_URL kept for backwards compatibility with existing Render config.
const _originSet = new Set([
    'http://localhost:5173',
    'http://localhost:3000',
]);
if (process.env.FRONTEND_URL)            _originSet.add(process.env.FRONTEND_URL);
if (process.env.PRODUCTION_FRONTEND_URL) _originSet.add(process.env.PRODUCTION_FRONTEND_URL);
if (process.env.CLIENT_URL)              _originSet.add(process.env.CLIENT_URL);

const allowedOrigins = [..._originSet];

console.log('[cors] allowed origins:', allowedOrigins);

const corsOptions = {
    origin: (requestOrigin, callback) => {
        // No Origin header = server-to-server / Postman / curl — allow
        if (!requestOrigin) return callback(null, true);

        if (allowedOrigins.includes(requestOrigin)) {
            callback(null, true);
        } else {
            console.warn(`[cors] blocked origin: ${requestOrigin}`);
            callback(new Error(`CORS: origin '${requestOrigin}' is not allowed`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,   // some legacy browsers choke on 204
};

// Apply CORS to all routes (including OPTIONS preflight).
// cors() with preflightContinue:false (the default) terminates OPTIONS
// requests itself, so no separate app.options('*') handler is needed.
// This also sits before the rate limiters, so preflight is never rate-limited.
app.use(cors(corsOptions));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
    ...RATE_LIMIT.GENERAL,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { message: 'Too many requests, please try again later.' },
});

const aiLimiter = rateLimit({
    ...RATE_LIMIT.AI,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { message: 'AI rate limit reached. Please wait a moment.' },
});

const authLimiter = rateLimit({
    ...RATE_LIMIT.AUTH,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { message: 'Too many auth attempts. Try again in 15 minutes.' },
});

// ── Body Parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ── Database ──────────────────────────────────────────────────────────────────
connectDB();

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',        authLimiter,    authRoutes);
app.use('/api/v1/income',      generalLimiter, incomeRoutes);
app.use('/api/v1/expense',     generalLimiter, expenseRoutes);
app.use('/api/v1/dashboard',   generalLimiter, dashboardRoutes);
app.use('/api/v1/budget',      generalLimiter, budgetRoutes);
app.use('/api/v1/ai',          aiLimiter,      aiRoutes);
app.use('/api/v1/chat',        aiLimiter,      chatRoutes);
app.use('/api/v1/finance',     generalLimiter, healthScoreRoutes);
app.use('/api/v1/predictions', generalLimiter, predictionRoutes);

// ── Static assets ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health-check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        env:    process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        ts:     new Date().toISOString(),
    });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[server] Unhandled error:', err.message);
    res.status(err.status || 500).json({
        message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred.'
            : err.message,
    });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n✅  FinGuide backend running on port ${PORT}`);
    console.log(`   ENV:     ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Gemini:  ${process.env.GEMINI_API_KEY ? '✓ configured' : '⚠ not set'}`);
    console.log(`   MongoDB: connecting…\n`);
});
