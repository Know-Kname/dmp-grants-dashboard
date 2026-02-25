import cors from 'cors';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { normalizeRequest } from './middleware/normalizeRequest.js';
import { requestContext } from './middleware/requestContext.js';
import { healthCheck } from './db/index.js';
import authRoutes from './routes/auth.js';
import workOrderRoutes from './routes/workOrders.js';
import inventoryRoutes from './routes/inventory.js';
import financialRoutes from './routes/financial.js';
import burialsRoutes from './routes/burials.js';
import contractsRoutes from './routes/contracts.js';
import grantsRoutes from './routes/grants.js';
import customersRoutes from './routes/customers.js';
import statsRoutes from './routes/stats.js';

const app = express();

// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------
app.use(helmet());

// ---------------------------------------------------------------------------
// CORS configuration
// ---------------------------------------------------------------------------
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Allow Vercel preview deployments
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ---------------------------------------------------------------------------
// Response compression (gzip + brotli)
// Research: Use compression middleware for APIs; reverse proxy for high-traffic.
// Only compress responses > 1KB (avoids overhead on tiny JSON payloads).
// ---------------------------------------------------------------------------
app.use(compression({
  threshold: 1024,      // Only compress responses >= 1KB
  level: 6,             // Balance between speed and compression ratio
  filter: (req, res) => {
    // Don't compress server-sent events
    if (req.headers['accept'] === 'text/event-stream') return false;
    return compression.filter(req, res);
  },
}));

// ---------------------------------------------------------------------------
// ETag support — Express enables weak ETags by default.
// This lets browsers send If-None-Match headers; unchanged responses
// return 304 Not Modified (zero body transfer).
// ---------------------------------------------------------------------------
app.set('etag', 'weak');

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later.', code: 'RATE_LIMITED' } },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts, please try again later.', code: 'RATE_LIMITED' } },
});

app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);

// ---------------------------------------------------------------------------
// Body parsing & request middleware
// ---------------------------------------------------------------------------
app.use(requestContext);
app.use(express.json({ limit: '10mb' }));
app.use(normalizeRequest);

// ---------------------------------------------------------------------------
// Request timing middleware — adds X-Response-Time header
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    // Log slow API requests (> 1 second)
    if (durationMs > 1000) {
      console.warn('[PERF] Slow request', {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
        userId: req.user?.id,
      });
    }
  });
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/burials', burialsRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/grants', grantsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/stats', statsRoutes);

// ---------------------------------------------------------------------------
// Health check — includes database connectivity + pool stats
// ---------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  const dbHealth = await healthCheck();
  const status = dbHealth.status === 'ok' ? 200 : 503;
  res.status(status).json({
    status: dbHealth.status === 'ok' ? 'ok' : 'degraded',
    message: 'DMP Cemetery API',
    uptime: Math.round(process.uptime()),
    database: dbHealth,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
