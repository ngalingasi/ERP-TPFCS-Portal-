const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const morgan       = require('morgan');
const httpStatus   = require('http-status');
const path         = require('path');
const fs           = require('fs');
const config       = require('./config/config');
const logger       = require('./config/logger');
const routes       = require('./routes');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError     = require('./utils/ApiError');

const app = express();

// ── Logging ───────────────────────────────────────────────────────────────────
if (config.env !== 'test') {
  app.use(morgan('combined', { stream: { write: (m) => logger.info(m.trim()) } }));
}

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy:      false,
  crossOriginEmbedderPolicy:  false,
  crossOriginOpenerPolicy:    true,
  crossOriginResourcePolicy:  { policy: 'cross-origin' },
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:         '*',
  methods:        ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-erp-secret'],
}));
app.options('*', cors());

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// ── Rate limiting on auth routes ──────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      30,
  message:  { status: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use('/api/v1/auth', authLimiter);

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── Serve React ERP frontend from dist/ ──────────────────────────────────────
// __dirname = /var/www/erp.tpfcs.co.tz/api/src
// We look for dist/ in these locations (in order):
//   1. /var/www/erp.tpfcs.co.tz/dist          (__dirname/../../dist)
//   2. /var/www/erp.tpfcs.co.tz/api/dist       (__dirname/../dist)
//   3. /var/www/erp.tpfcs.co.tz/api/src/dist   (__dirname/dist)

const distCandidates = [
  path.join(__dirname, '..', '..', 'dist'),   // beside api/ folder
  path.join(__dirname, '..', 'dist'),          // inside api/ folder
  path.join(__dirname, 'dist'),                // inside src/ folder (fallback)
];

const distPath = distCandidates.find(p => fs.existsSync(p));

if (distPath) {
  app.use(express.static(distPath, {
    maxAge:  config.env === 'production' ? '1y' : '0',
    etag:    false,
  }));

  // SPA fallback — non-API routes → index.html
  app.get(/^(?!\/api).*$/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  logger.info(`ERP frontend served from: ${distPath}`);
} else {
  app.get('/', (req, res) => {
    res.json({
      message:   'ERP Services API is running.',
      dashboard: 'Frontend not built yet. Copy dist/ folder to /var/www/erp.tpfcs.co.tz/dist',
      api:       '/api/v1',
      health:    '/api/v1/health',
    });
  });

  logger.warn(`ERP frontend dist not found. Tried: ${distCandidates.join(', ')}`);
}

// ── 404 for unmatched API routes ──────────────────────────────────────────────
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// ── Error handling ────────────────────────────────────────────────────────────
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
