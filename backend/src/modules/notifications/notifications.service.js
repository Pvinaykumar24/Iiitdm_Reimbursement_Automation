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
    await db.query(
      `INSERT INTO email_queue (recipient, subject, html, status)
       VALUES ($1, $2, $3, 'PENDING')`,
      [to, subject, html]
    );
    console.log(`Email to ${to} queued successfully.`);
  } catch (err) {
    console.error('Failed to queue email:', err);
  }
};

const startEmailWorker = () => {
  console.log('Email background worker started.');
  setInterval(async () => {
    try {
      const { rows } = await db.query(
        `SELECT * FROM email_queue 
         WHERE status IN ('PENDING', 'FAILED') AND attempts < 5 
         ORDER BY created_at ASC 
         LIMIT 5 
         FOR UPDATE SKIP LOCKED`
      );

      if (rows.length === 0) return;

      for (const email of rows) {
        const nextAttempts = email.attempts + 1;
        try {
          await transporter.sendMail({
            from: `"IIITDM Reimbursement Portal" <${process.env.SMTP_USER}>`,
            to: email.recipient,
            subject: email.subject,
            html: email.html,
          });

          await db.query(
            `UPDATE email_queue 
             SET status = 'SENT', attempts = $1, updated_at = NOW(), last_error = NULL
             WHERE id = $2`,
            [nextAttempts, email.id]
          );
          console.log(`Queued email ${email.id} sent successfully to ${email.recipient}.`);
        } catch (err) {
          console.error(`Failed sending queued email ${email.id} to ${email.recipient}:`, err.message);
          await db.query(
            `UPDATE email_queue 
             SET status = 'FAILED', attempts = $1, updated_at = NOW(), last_error = $2
             WHERE id = $3`,
            [nextAttempts, err.message, email.id]
          );
        }
      }
    } catch (workerErr) {
      console.error('Error in email background worker iteration:', workerErr.message);
    }
  }, 15000);
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

module.exports = { sendNotification, sendEmail, getMyNotifications, markRead, startEmailWorker };