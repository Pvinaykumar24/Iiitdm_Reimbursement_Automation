const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const { sendEmail } = require('../notifications/notifications.service');

// ── In-memory OTP store (email → { otp, expiresAt, verified, employeeId, name }) ──
const otpStore = new Map();
const resetStore = new Map();

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// Step 1 — validate email + employee_id, send OTP
const sendRegistrationOtp = async ({ email, employee_id, name, department }) => {
  if (!email.toLowerCase().endsWith('@iiitdm.ac.in'))
    throw Object.assign(new Error('Only @iiitdm.ac.in email addresses are allowed'), { status: 400 });

  const exists = await db.query('SELECT id FROM users WHERE email=$1', [email]);
  if (exists.rows.length)
    throw Object.assign(new Error('This email is already registered. Please sign in.'), { status: 409 });

  const empExists = await db.query('SELECT id FROM users WHERE employee_id=$1', [employee_id]);
  if (empExists.rows.length)
    throw Object.assign(new Error('This Faculty ID is already registered.'), { status: 409 });

  const otp = generateOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  otpStore.set(email.toLowerCase(), { otp, expiresAt, verified: false, employee_id, name, department });

  await sendEmail({
    to: email,
    subject: 'Your OTP — IIITDM Reimbursement Portal',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <div style="background:#534AB7;padding:20px 24px;border-radius:8px 8px 0 0">
          <div style="color:#fff;font-size:18px;font-weight:600">IIITDM Kancheepuram</div>
          <div style="color:#c5c0f5;font-size:13px;margin-top:2px">Reimbursement Portal</div>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e5e3;border-radius:0 0 8px 8px">
          <p style="margin:0 0 16px;font-size:14px;color:#333">Dear <strong>${name}</strong>,</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555">Use the OTP below to complete your account registration. It expires in <strong>10 minutes</strong>.</p>
          <div style="text-align:center;margin:24px 0">
            <div style="display:inline-block;background:#EEEDFE;border:2px dashed #534AB7;border-radius:10px;padding:16px 36px">
              <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#26215C">${otp}</div>
            </div>
          </div>
          <p style="font-size:12px;color:#999;margin:0">If you did not request this, please ignore this email.</p>
        </div>
      </div>`,
  });

  return { message: 'OTP sent to your institute email address' };
};

// Step 2 — verify the OTP
const verifyRegistrationOtp = async ({ email, otp }) => {
  const record = otpStore.get(email.toLowerCase());
  if (!record) throw Object.assign(new Error('No OTP request found. Please start again.'), { status: 400 });
  if (Date.now() > record.expiresAt) {
    otpStore.delete(email.toLowerCase());
    throw Object.assign(new Error('OTP has expired. Please request a new one.'), { status: 400 });
  }
  if (record.otp !== otp) throw Object.assign(new Error('Incorrect OTP. Please try again.'), { status: 400 });

  record.verified = true;
  return { message: 'OTP verified successfully' };
};

// Step 3 — set password and create account, then return JWT for auto-login
const completeRegistration = async ({ email, password }) => {
  const record = otpStore.get(email.toLowerCase());
  if (!record || !record.verified)
    throw Object.assign(new Error('Email not verified. Please complete OTP verification first.'), { status: 400 });

  const exists = await db.query('SELECT id FROM users WHERE email=$1', [email]);
  if (exists.rows.length)
    throw Object.assign(new Error('This email is already registered.'), { status: 409 });

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password, role, department, employee_id)
     VALUES ($1,$2,$3,'FACULTY',$4,$5)
     RETURNING id, name, email, role, department`,
    [record.name, email.toLowerCase(), hash, record.department || null, record.employee_id]
  );
  const user = rows[0];

  otpStore.delete(email.toLowerCase());

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.REFRESH_SECRET || (process.env.JWT_SECRET + '_refresh'),
    { expiresIn: '7d' }
  );

  return { token, refreshToken, user };
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
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.REFRESH_SECRET || (process.env.JWT_SECRET + '_refresh'),
    { expiresIn: '7d' }
  );

  return {
    token,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department }
  };
};

const refreshToken = async ({ refresh_token }) => {
  if (!refresh_token) throw Object.assign(new Error('Refresh token is required'), { status: 400 });
  try {
    const payload = jwt.verify(refresh_token, process.env.REFRESH_SECRET || (process.env.JWT_SECRET + '_refresh'));
    const { rows } = await db.query(
      'SELECT id, name, email, role, department FROM users WHERE id=$1 AND is_active=true',
      [payload.id]
    );
    if (!rows.length) throw Object.assign(new Error('User not found or inactive'), { status: 401 });
    const user = rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const newRefreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_SECRET || (process.env.JWT_SECRET + '_refresh'),
      { expiresIn: '7d' }
    );

    return { token, refreshToken: newRefreshToken };
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
  }
};

const getMe = async (userId) => {
  const { rows } = await db.query(
    'SELECT id, name, email, role, department, employee_id, phone, designation FROM users WHERE id=$1', [userId]
  );
  if (!rows.length) throw Object.assign(new Error('User not found'), { status: 404 });
  return rows[0];
};

const getProfile = async (userId) => {
  const { rows } = await db.query(
    'SELECT id, name, email, role, department, employee_id, phone, designation FROM users WHERE id=$1',
    [userId]
  );
  if (!rows.length) throw Object.assign(new Error('User not found'), { status: 404 });
  return rows[0];
};

const updateProfile = async (userId, { name, phone, designation }) => {
  const { rows } = await db.query(
    `UPDATE users
     SET name=COALESCE($2, name),
         phone=COALESCE($3, phone),
         designation=COALESCE($4, designation)
     WHERE id=$1
     RETURNING id, name, email, role, department, employee_id, phone, designation`,
    [userId, name, phone || null, designation || null]
  );
  if (!rows.length) throw Object.assign(new Error('User not found'), { status: 404 });
  return rows[0];
};

const sendResetOtp = async ({ email }) => {
  if (!email || !email.trim()) {
    throw Object.assign(new Error('Email address is required'), { status: 400 });
  }
  const emailLower = email.trim().toLowerCase();
  const exists = await db.query('SELECT name FROM users WHERE email=$1 AND is_active=true', [emailLower]);
  if (!exists.rows.length) {
    throw Object.assign(new Error('No active account found with this email address.'), { status: 404 });
  }
  const userName = exists.rows[0].name;
  const otp = generateOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  resetStore.set(emailLower, { otp, expiresAt, verified: false });

  await sendEmail({
    to: emailLower,
    subject: 'Reset Password OTP — IIITDM Reimbursement Portal',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <div style="background:#534AB7;padding:20px 24px;border-radius:8px 8px 0 0">
          <div style="color:#fff;font-size:18px;font-weight:600">IIITDM Kancheepuram</div>
          <div style="color:#c5c0f5;font-size:13px;margin-top:2px">Reimbursement Portal</div>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e5e3;border-radius:0 0 8px 8px">
          <p style="margin:0 0 16px;font-size:14px;color:#333">Dear <strong>${userName}</strong>,</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555">Use the OTP below to reset your account password. It is valid for <strong>10 minutes</strong>.</p>
          <div style="text-align:center;margin:24px 0">
            <div style="display:inline-block;background:#EEEDFE;border:2px dashed #534AB7;border-radius:10px;padding:16px 36px">
              <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#26215C">${otp}</div>
            </div>
          </div>
          <p style="font-size:12px;color:#999;margin:0">If you did not request this, please ignore this email and secure your account.</p>
        </div>
      </div>`,
  });

  return { message: 'Password reset OTP has been sent to your email address' };
};

const verifyResetOtp = async ({ email, otp }) => {
  if (!email || !otp) throw Object.assign(new Error('Email and OTP are required'), { status: 400 });
  const emailLower = email.trim().toLowerCase();
  const record = resetStore.get(emailLower);
  if (!record) throw Object.assign(new Error('No reset OTP request found. Please start again.'), { status: 400 });
  if (Date.now() > record.expiresAt) {
    resetStore.delete(emailLower);
    throw Object.assign(new Error('OTP has expired. Please request a new one.'), { status: 400 });
  }
  if (record.otp !== otp) throw Object.assign(new Error('Incorrect OTP. Please try again.'), { status: 400 });

  record.verified = true;
  return { message: 'OTP verified successfully' };
};

const completePasswordReset = async ({ email, password }) => {
  if (!email || !password) throw Object.assign(new Error('Email and password are required'), { status: 400 });
  const emailLower = email.trim().toLowerCase();
  const record = resetStore.get(emailLower);
  if (!record || !record.verified) {
    throw Object.assign(new Error('Email verification is pending. Please verify OTP first.'), { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  await db.query(
    'UPDATE users SET password = $1 WHERE email = $2 AND is_active = true',
    [hash, emailLower]
  );

  resetStore.delete(emailLower);
  return { message: 'Password reset successfully. You can now login.' };
};

module.exports = {
  login,
  getMe,
  getProfile,
  updateProfile,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  completeRegistration,
  refreshToken,
  sendResetOtp,
  verifyResetOtp,
  completePasswordReset
};