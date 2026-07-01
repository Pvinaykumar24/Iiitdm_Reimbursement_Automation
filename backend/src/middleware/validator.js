const validate = (rules) => (req, res, next) => {
  for (const [field, constraints] of Object.entries(rules)) {
    const val = req.body[field];

    if (constraints.required && (val === undefined || val === null || val === '')) {
      return res.status(400).json({ message: `${field} is required.` });
    }

    if (val !== undefined && val !== null && val !== '') {
      if (constraints.type === 'string' && typeof val !== 'string') {
        return res.status(400).json({ message: `${field} must be a string.` });
      }
      if (constraints.type === 'number') {
        const num = Number(val);
        if (isNaN(num)) {
          return res.status(400).json({ message: `${field} must be a number.` });
        }
        if (constraints.positive && num <= 0) {
          return res.status(400).json({ message: `${field} must be a positive number.` });
        }
        if (constraints.nonNegative && num < 0) {
          return res.status(400).json({ message: `${field} must be a non-negative number.` });
        }
        if (constraints.integer && !Number.isInteger(num)) {
          return res.status(400).json({ message: `${field} must be an integer.` });
        }
      }
      if (constraints.type === 'date' && isNaN(Date.parse(val))) {
        return res.status(400).json({ message: `${field} must be a valid date.` });
      }
      if (constraints.pattern && !constraints.pattern.test(String(val))) {
        return res.status(400).json({ message: `${field} format is invalid.` });
      }
      if (constraints.minLength && String(val).length < constraints.minLength) {
        return res.status(400).json({ message: `${field} must be at least ${constraints.minLength} characters long.` });
      }
    }
  }
  next();
};

module.exports = { validate };
