const router = require('express').Router();
const ctrl = require('./auth.controller');
const { verifyToken } = require('../../middleware/auth');

router.post('/login',                  ctrl.login);
router.post('/register',               ctrl.register);
router.get('/me',                      verifyToken, ctrl.getMe);

// Faculty self-registration via OTP
router.post('/register/send-otp',      ctrl.sendOtp);
router.post('/register/verify-otp',    ctrl.verifyOtp);
router.post('/register/complete',      ctrl.completeReg);

module.exports = router;