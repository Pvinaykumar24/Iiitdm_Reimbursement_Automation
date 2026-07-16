require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes      = require('./modules/auth/auth.routes');
const claimsRoutes    = require('./modules/claims/claims.routes');
const approvalsRoutes = require('./modules/approvals/approvals.routes');
const projectsRoutes  = require('./modules/projects/projects.routes');
const notifRoutes     = require('./modules/notifications/notifications.routes');
const { startEmailWorker } = require('./modules/notifications/notifications.service');

const app = express();

app.use(helmet());
const allowedOrigins = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : [];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    if (origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed'));
  },
  credentials: true
}));
app.use(express.json());

// Strict rate limiter for auth (max 5 per minute)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: 'Too many authentication attempts. Please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limiter for APIs (max 100 per minute)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth',          authLimiter,    authRoutes);
app.use('/api/claims',        generalLimiter, claimsRoutes);
app.use('/api/approvals',     generalLimiter, approvalsRoutes);
app.use('/api/projects',      generalLimiter, projectsRoutes);
app.use('/api/notifications', generalLimiter, notifRoutes);

app.use(errorHandler);

// Start the database-backed resilient email background worker
startEmailWorker();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));