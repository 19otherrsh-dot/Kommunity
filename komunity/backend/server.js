require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const communityRoutes = require('./routes/communities');
const postRoutes = require('./routes/posts');
const courseRoutes = require('./routes/courses');
const eventRoutes = require('./routes/events');
const memberRoutes = require('./routes/members');
const gamificationRoutes = require('./routes/gamification');
const billingRoutes = require('./routes/billing');
const spaceRoutes = require('./routes/spaces');
const uploadRoutes = require('./routes/upload');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Security & Middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
// ─── Webhooks (Must be mounted before express.json to preserve raw body) ───
app.use('/api/webhooks', require('./routes/webhooks'));

// Stripe webhook needs raw body too. Since it's inside billingRoutes, we can extract it or use a custom JSON middleware.
// For now, we'll mount a dedicated raw route for Stripe here to fix the existing bug:
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), require('./controllers/billingController').webhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Minimal cookie parser (populates req.cookies) — avoids an extra dependency.
// res.cookie() is provided natively by Express.
const { parseCookies } = require('./utils/cookies');
app.use((req, _res, next) => {
  req.cookies = parseCookies(req.headers.cookie);
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// Stricter limiter for billing/checkout to curb abuse of payment endpoints
const billingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many billing requests, please try again later.' },
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
// Public unsubscribe (no auth — links live in emails)
app.use('/api/unsubscribe', require('./routes/unsubscribe'));
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/communities/:communityId/spaces', spaceRoutes);
app.use('/api/communities/:communityId/reports', require('./routes/reports'));
app.use('/api/communities/:communityId/products', require('./routes/products'));
app.use('/api/communities/:communityId/analytics', require('./routes/analytics'));
app.use('/api/posts', postRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/billing', billingLimiter, billingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/search', require('./routes/search'));
app.use('/api/web3', require('./routes/web3'));

// Public, API-key-authenticated REST API for external integrations (Zapier, CRMs)
app.use('/api/v1', require('./routes/publicApi'));

// ─── Frontend + SEO (production single-origin) ────────────────────────────────
// Serves the built SPA with server-side meta injection for crawlable public pages.
// No-op in dev (frontend is served by Vite). Mounted after API routes.
require('./seo').mountFrontend(app);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Initialize External Services ─────────────────────────────────────────────
const { connectRedis } = require('./db/redis');
connectRedis();

// Background job workers (webhooks, emails). No-op if REDIS_URL is unset.
const jobQueue = require('./queue');
jobQueue.startWorkers();

// ─── Start ────────────────────────────────────────────────────────────────────
const http = require('http');
const { initSocket } = require('./socket');

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Komunity API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown — drain workers/queues before exiting
const shutdown = async (signal) => {
  console.log(`\n${signal} received — shutting down…`);
  try { await jobQueue.close(); } catch (_) {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };
