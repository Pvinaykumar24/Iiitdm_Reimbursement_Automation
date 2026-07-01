const router = require('express').Router();
const { verifyToken, requireRole } = require('../../middleware/auth');
const ctrl = require('./approvals.controller');

router.use(verifyToken);
router.post('/dean/:id', requireRole('DEAN'), ctrl.deanDecision);
router.post('/sric/:id', requireRole('SRIC'), ctrl.sricDecision);

module.exports = router;