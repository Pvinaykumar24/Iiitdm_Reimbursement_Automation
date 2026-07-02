const router = require('express').Router();
const ctrl = require('./auth.controller');
const { verifyToken } = require('../../middleware/auth');
const { rateLimit } = require('../../middleware/rateLimiter');
const { validate } = require('../../middleware/validator');

const loginSchema = {
  email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  password: { required: true, type: 'string', minLength: 6 },
};

const sendOtpSchema = {
  email: { required: true, type: 'string', pattern: /^[^\s@]+@iiitdm\.ac\.in$/i },
  employee_id: { required: true, type: 'string' },
  name: { required: true, type: 'string' },
};

const verifyOtpSchema = {
  email: { required: true, type: 'string' },
  otp: { required: true, type: 'string', pattern: /^\d{6}$/ },
};

const completeRegSchema = {
  email: { required: true, type: 'string' },
  password: { required: true, type: 'string', minLength: 6 },
};

router.post('/login',                  rateLimit(15 * 60 * 1000, 5, 'Too many login attempts. Please try again after 15 minutes.'), validate(loginSchema), ctrl.login);

router.post('/refresh',                ctrl.refreshToken);
router.get('/me',                      verifyToken, ctrl.getMe);
router.get('/profile',                 verifyToken, ctrl.getProfile);
router.patch('/profile',               verifyToken, ctrl.updateProfile);

// Faculty self-registration via OTP
router.post('/register/send-otp',      rateLimit(10 * 60 * 1000, 3, 'Too many OTP requests. Please try again after 10 minutes.'), validate(sendOtpSchema), ctrl.sendOtp);
router.post('/register/verify-otp',    validate(verifyOtpSchema), ctrl.verifyOtp);
router.post('/register/complete',      validate(completeRegSchema), ctrl.completeReg);

module.exports = router;