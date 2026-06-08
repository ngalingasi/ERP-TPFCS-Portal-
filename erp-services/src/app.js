const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const morgan       = require('morgan');
const httpStatus   = require('http-status');
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
app.use(helmet({ contentSecurityPolicy: false }));

// ── CORS — allow ERP frontend origin ─────────────────────────────────────────
app.use(cors({
  origin:      '*',               // restrict to ERP frontend origin in production
  methods:     ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-erp-secret'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// ── Rate limiting on auth routes ──────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      30,
  message:  { status: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use('/api/v1/auth', authLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// ── Error handling ────────────────────────────────────────────────────────────
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
