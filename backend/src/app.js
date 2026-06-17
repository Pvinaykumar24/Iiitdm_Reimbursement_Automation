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
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
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