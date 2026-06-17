const service = require('./auth.service');

const register = async (req, res, next) => {
  try {
    const user = await service.register(req.body);
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const result = await service.login(req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const getMe = async (req, res, next) => {
  try {
    const user = await service.getMe(req.user.id);
    res.json(user);
  } catch (err) { next(err); }
};

module.exports = { register, login, getMe };