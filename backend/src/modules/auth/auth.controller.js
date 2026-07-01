const service = require('./auth.service');

const register   = async (req, res, next) => {
  try { const user = await service.register(req.body); res.status(201).json({ message: 'User registered successfully', user }); }
  catch (err) { next(err); }
};
const login      = async (req, res, next) => {
  try { res.json(await service.login(req.body)); }
  catch (err) { next(err); }
};
const getMe = async (req, res, next) => {
  try { res.json(await service.getMe(req.user.id)); }
  catch (err) { next(err); }
};
const getProfile = async (req, res, next) => {
  try { res.json(await service.getProfile(req.user.id)); }
  catch (err) { next(err); }
};
const updateProfile = async (req, res, next) => {
  try { res.json(await service.updateProfile(req.user.id, req.body)); }
  catch (err) { next(err); }
};
const sendOtp    = async (req, res, next) => {
  try { res.json(await service.sendRegistrationOtp(req.body)); }
  catch (err) { next(err); }
};
const verifyOtp  = async (req, res, next) => {
  try { res.json(await service.verifyRegistrationOtp(req.body)); }
  catch (err) { next(err); }
};
const completeReg = async (req, res, next) => {
  try { res.status(201).json(await service.completeRegistration(req.body)); }
  catch (err) { next(err); }
};

module.exports = { register, login, getMe, getProfile, updateProfile, sendOtp, verifyOtp, completeReg };