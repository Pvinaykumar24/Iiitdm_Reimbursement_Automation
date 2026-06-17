const router = require('express').Router();
const { verifyToken, requireRole } = require('../../middleware/auth');
const ctrl = require('./claims.controller');

router.use(verifyToken);

router.post('/',                             requireRole('FACULTY'),         ctrl.createClaim);
router.post('/:id/items',                    requireRole('FACULTY'),         ctrl.addItem);
router.delete('/:id/items/:itemId',          requireRole('FACULTY'),         ctrl.removeItem);
router.post('/:id/submit',                   requireRole('FACULTY'),         ctrl.submitClaim);
router.delete('/:id',                        requireRole('FACULTY'),         ctrl.deleteDraft);
router.get('/my',                            requireRole('FACULTY'),         ctrl.myClaims);
router.get('/pending-dean',                  requireRole('DEAN'),            ctrl.pendingForDean);
router.get('/decided-dean',                  requireRole('DEAN'),            ctrl.decidedClaims);
router.get('/:id',                           verifyToken,                    ctrl.getClaimById);

module.exports = router;