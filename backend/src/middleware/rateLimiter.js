const rateLimit = (windowMs, max, message = 'Too many requests, please try again later.') => {
  const store = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (!store.has(ip)) {
      store.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const record = store.get(ip);
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    record.count++;
    if (record.count > max) {
      return res.status(429).json({ message });
    }
    next();
  };
};

module.exports = { rateLimit };
