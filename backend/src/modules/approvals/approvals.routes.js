const router = require('express').Router();
const { verifyToken, requireRole } = require('../../middleware/auth');
const ctrl = require('./approvals.controller');

router.use(verifyToken);
router.post('/dean/:id', requireRole('DEAN'), ctrl.deanDecision);

module.exports = router;