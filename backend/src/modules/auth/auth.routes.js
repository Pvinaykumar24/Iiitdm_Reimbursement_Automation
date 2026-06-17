const router = require('express').Router();
const ctrl = require('./auth.controller');
const { verifyToken } = require('../../middleware/auth');

router.post('/login',    ctrl.login);
router.post('/register', ctrl.register);
router.get('/me',        verifyToken, ctrl.getMe);

module.exports = router;