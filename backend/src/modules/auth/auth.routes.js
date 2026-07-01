const router = require('express').Router();
const ctrl = require('./auth.controller');
const { verifyToken } = require('../../middleware/auth');
const { rateLimit } = require('../../middleware/rateLimiter');

router.post('/login',                  rateLimit(15 * 60 * 1000, 5, 'Too many login attempts. Please try again after 15 minutes.'), ctrl.login);
router.post('/register',               ctrl.register);
router.get('/me',                      verifyToken, ctrl.getMe);
router.get('/profile',                 verifyToken, ctrl.getProfile);
router.patch('/profile',               verifyToken, ctrl.updateProfile);

// Faculty self-registration via OTP
router.post('/register/send-otp',      rateLimit(10 * 60 * 1000, 3, 'Too many OTP requests. Please try again after 10 minutes.'), ctrl.sendOtp);
router.post('/register/verify-otp',    ctrl.verifyOtp);
router.post('/register/complete',      ctrl.completeReg);

module.exports = router;