const db = require('../../config/db');
const { sendNotification, sendEmail } = require('../notifications/notifications.service');

const deanDecision = async (claimId, deanId, action, remarks) => {
  if (!['APPROVED', 'REJECTED'].includes(action))
    throw Object.assign(new Error('Invalid action'), { status: 400 });

  if (action === 'REJECTED' && !remarks?.trim())
    throw Object.assign(new Error('Remarks are required when rejecting a claim'), { status: 400 });

  const { rows } = await db.query(
    `SELECT c.*, u.id AS fac_id, u.name AS fac_name, u.email AS fac_email
     FROM claims c JOIN users u ON u.id=c.faculty_id
     WHERE c.id=$1 AND c.status='DEAN_PENDING'`,
    [claimId]
  );
  if (!rows.length) throw Object.assign(new Error('Claim not found or not pending Dean review'), { status: 404 });
  const claim = rows[0];

  const newStatus = action === 'APPROVED' ? 'ACCOUNTS_PENDING' : 'DEAN_REJECTED';

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE claims SET status=$1, updated_at=NOW() WHERE id=$2`,
      [newStatus, claimId]
    );

    await client.query(
      `INSERT INTO approvals (claim_id, actor_id, stage, action, remarks)
       VALUES ($1,$2,'DEAN_REVIEW',$3,$4)`,
      [claimId, deanId, action, remarks || null]
    );

    await client.query(
      `INSERT INTO audit_logs (claim_id, user_id, action, metadata)
       VALUES ($1,$2,$3,$4)`,
      [claimId, deanId, `DEAN_${action}`,
       JSON.stringify({ remarks, claim_no: claim.claim_no })]
    );

    const notifMsg = action === 'APPROVED'
      ? `Your claim ${claim.claim_no} has been approved by Dean SR and forwarded to Accounts.`
      : `Your claim ${claim.claim_no} was rejected by Dean SR. Reason: ${remarks}`;

    await client.query(
      'INSERT INTO notifications (user_id, claim_id, message) VALUES ($1,$2,$3)',
      [claim.fac_id, claimId, notifMsg]
    );

    if (action === 'APPROVED') {
      const accts = await client.query(`SELECT id FROM users WHERE role='ACCOUNTS' AND is_active=true`);
      for (const a of accts.rows) {
        await client.query(
          'INSERT INTO notifications (user_id, claim_id, message) VALUES ($1,$2,$3)',
          [a.id, claimId, `Claim ${claim.claim_no} approved by Dean — pending your processing.`]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const emailHtml = action === 'APPROVED'
    ? `<p>Dear ${claim.fac_name},</p>
       <p>Your claim <strong>${claim.claim_no}</strong> (₹${claim.total_amount}) has been
       <strong style="color:green">approved</strong> by Dean SR and forwarded to Accounts for processing.</p>
       <a href="${process.env.CLIENT_URL}/faculty/claims/${claimId}" 
          style="background:#534AB7;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">
         View claim →
       </a>`
    : `<p>Dear ${claim.fac_name},</p>
       <p>Your claim <strong>${claim.claim_no}</strong> (₹${claim.total_amount}) has been
       <strong style="color:#c0392b">rejected</strong> by Dean SR.</p>
       <p><strong>Reason:</strong> ${remarks}</p>
       <p>Please log in to review and resubmit if needed.</p>
       <a href="${process.env.CLIENT_URL}/faculty/claims/${claimId}"
          style="background:#534AB7;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">
         View claim →
       </a>`;

  await sendEmail({
    to: claim.fac_email,
    subject: `Claim ${claim.claim_no} — ${action === 'APPROVED' ? 'Approved by Dean SR' : 'Returned by Dean SR'}`,
    html: emailHtml,
  });

  return { message: `Claim ${action.toLowerCase()} successfully` };
};

module.exports = { deanDecision };