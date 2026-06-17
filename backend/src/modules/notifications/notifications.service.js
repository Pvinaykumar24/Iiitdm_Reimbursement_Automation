const db = require('../../config/db');
const transporter = require('../../config/mailer');

const sendNotification = async (userId, claimId, message) => {
  await db.query(
    'INSERT INTO notifications (user_id, claim_id, message) VALUES ($1,$2,$3)',
    [userId, claimId, message]
  );
};

const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: '"IIITDM Reimbursement Portal" <noreply@iiitdm.ac.in>',
      to, subject, html,
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
};

const getMyNotifications = async (userId) => {
  const { rows } = await db.query(
    `SELECT n.*, c.claim_no FROM notifications n
     LEFT JOIN claims c ON c.id = n.claim_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC LIMIT 30`,
    [userId]
  );
  return rows;
};

const markRead = async (notifId, userId) => {
  await db.query(
    'UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2',
    [notifId, userId]
  );
};

module.exports = { sendNotification, sendEmail, getMyNotifications, markRead };