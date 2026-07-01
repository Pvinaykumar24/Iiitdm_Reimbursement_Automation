require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes      = require('./modules/auth/auth.routes');
const claimsRoutes    = require('./modules/claims/claims.routes');
const approvalsRoutes = require('./modules/approvals/approvals.routes');
const projectsRoutes  = require('./modules/projects/projects.routes');
const notifRoutes     = require('./modules/notifications/notifications.routes');

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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth',          authRoutes);
app.use('/api/claims',        claimsRoutes);
app.use('/api/approvals',     approvalsRoutes);
app.use('/api/projects',      projectsRoutes);
app.use('/api/notifications', notifRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));