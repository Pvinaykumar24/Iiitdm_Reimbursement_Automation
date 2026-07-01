const router = require('express').Router();
const { verifyToken, requireRole } = require('../../middleware/auth');
const { validate } = require('../../middleware/validator');
const ctrl = require('./claims.controller');

const claimSchema = {
  project_no: { required: true, type: 'string' },
  purpose: { required: true, type: 'string' },
};

const itemSchema = {
  vendor_name: { required: true, type: 'string' },
  bill_no: { required: true, type: 'string' },
  bill_date: { required: true, type: 'date' },
  description: { required: true, type: 'string' },
  quantity: { required: true, type: 'number', positive: true, integer: true },
  unit_price: { required: true, type: 'number', positive: true },
  total_amount: { required: true, type: 'number', positive: true },
};

router.use(verifyToken);

router.post('/',                             requireRole('FACULTY'),         validate(claimSchema), ctrl.createClaim);
router.patch('/:id',                          requireRole('FACULTY'),         validate(claimSchema), ctrl.editDraftClaim);
router.post('/:id/items',                    requireRole('FACULTY'),         validate(itemSchema), ctrl.addItem);
router.delete('/:id/items',                  requireRole('FACULTY'),         ctrl.clearItems);
router.delete('/:id/items/:itemId',          requireRole('FACULTY'),         ctrl.removeItem);
router.post('/:id/submit',                   requireRole('FACULTY'),         ctrl.submitClaim);
router.delete('/:id',                        requireRole('FACULTY'),         ctrl.deleteDraft);
router.get('/my',                            requireRole('FACULTY'),         ctrl.myClaims);
router.get('/pending-sric',                  requireRole('SRIC'),            ctrl.pendingForSric);
router.get('/decided-sric',                  requireRole('SRIC'),            ctrl.decidedForSric);
router.get('/pending-dean',                  requireRole('DEAN'),            ctrl.pendingForDean);
router.get('/decided-dean',                  requireRole('DEAN'),            ctrl.decidedClaims);
router.get('/all',                           requireRole('SRIC', 'DEAN'),    ctrl.getAllClaims);
router.get('/budget-summary',                requireRole('SRIC', 'DEAN'),    ctrl.budgetSummary);
router.get('/faculty-profile/:facultyId',   requireRole('SRIC', 'DEAN'),    ctrl.getFacultyProfile);
router.get('/:id',                           verifyToken,                    ctrl.getClaimById);

module.exports = router;