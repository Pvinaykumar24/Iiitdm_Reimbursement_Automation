const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');

const register = async ({ name, email, password, role, department, employee_id, bank_account, ifsc_code }) => {
  const exists = await db.query('SELECT id FROM users WHERE email=$1', [email]);
  if (exists.rows.length) throw Object.assign(new Error('Email already registered'), { status: 409 });

  const validRoles = ['FACULTY', 'DEAN', 'ACCOUNTS', 'ADMIN'];
  if (!validRoles.includes(role)) throw Object.assign(new Error('Invalid role'), { status: 400 });

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password, role, department, employee_id, bank_account, ifsc_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, name, email, role, department`,
    [name, email, hash, role, department || null, employee_id || null, bank_account || null, ifsc_code || null]
  );
  return rows[0];
};

const login = async ({ email, password }) => {
  const { rows } = await db.query(
    'SELECT * FROM users WHERE email=$1 AND is_active=true', [email]
  );
  if (!rows.length) throw Object.assign(new Error('Invalid email or password'), { status: 401 });

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) throw Object.assign(new Error('Invalid email or password'), { status: 401 });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department }
  };
};

const getMe = async (userId) => {
  const { rows } = await db.query(
    'SELECT id, name, email, role, department, employee_id FROM users WHERE id=$1', [userId]
  );
  if (!rows.length) throw Object.assign(new Error('User not found'), { status: 404 });
  return rows[0];
};

module.exports = { register, login, getMe };