const db = require('../../config/db');
const { sendNotification, sendEmail } = require('../notifications/notifications.service');

const VALID_BUDGET_HEADS = ['Consumable', 'Contingency', 'Travel', 'Equipment', 'Others', 'Accountable Consumable'];

const sricDecision = async (claimId, sricUserId, action, remarks, itemBudgetHeads) => {
  if (!['APPROVED', 'REJECTED'].includes(action))
    throw Object.assign(new Error('Invalid action'), { status: 400 });

  if (action === 'REJECTED' && !remarks?.trim())
    throw Object.assign(new Error('Remarks are required when rejecting a claim'), { status: 400 });

  if (action === 'APPROVED' && (!itemBudgetHeads || typeof itemBudgetHeads !== 'object'))
    throw Object.assign(new Error('Budget head segregation is required for verification'), { status: 400 });

  const { rows } = await db.query(
    `SELECT c.*, u.id AS fac_id, u.name AS fac_name, u.email AS fac_email
     FROM claims c JOIN users u ON u.id=c.faculty_id
     WHERE c.id=$1 AND c.status='SRIC_PENDING'`,
    [claimId]
  );
  if (!rows.length) throw Object.assign(new Error('Claim not found or not pending SRIC verification'), { status: 404 });
  const claim = rows[0];

  const newStatus = action === 'APPROVED' ? 'DEAN_PENDING' : 'SRIC_REJECTED';

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE claims SET status=$1, updated_at=NOW() WHERE id=$2`,
      [newStatus, claimId]
    );

    if (action === 'APPROVED' && itemBudgetHeads) {
      for (const [itemId, budgetHead] of Object.entries(itemBudgetHeads)) {
        if (!VALID_BUDGET_HEADS.includes(budgetHead)) {
          throw Object.assign(new Error(`Invalid budget head: ${budgetHead}`), { status: 400 });
        }
        await client.query(
          `UPDATE claim_items SET budget_head=$1 WHERE id=$2 AND claim_id=$3`,
          [budgetHead, itemId, claimId]
        );
      }
    }

    await client.query(
      `INSERT INTO approvals (claim_id, actor_id, stage, action, remarks)
       VALUES ($1,$2,'SRIC_REVIEW',$3,$4)`,
      [claimId, sricUserId, action === 'APPROVED' ? 'VERIFIED' : 'REJECTED', remarks || null]
    );

    await client.query(
      `INSERT INTO audit_logs (claim_id, user_id, action, metadata)
       VALUES ($1,$2,$3,$4)`,
      [claimId, sricUserId, `SRIC_${action === 'APPROVED' ? 'VERIFIED' : 'REJECTED'}`,
       JSON.stringify({ remarks, claim_no: claim.claim_no })]
    );

    const notifMsg = action === 'APPROVED'
      ? `Your claim ${claim.claim_no} has been verified by SRIC and forwarded to Dean.`
      : `Your claim ${claim.claim_no} was rejected by SRIC. Reason: ${remarks}`;

    await client.query(
      'INSERT INTO notifications (user_id, claim_id, message) VALUES ($1,$2,$3)',
      [claim.fac_id, claimId, notifMsg]
    );

    if (action === 'APPROVED') {
      const deans = await client.query(`SELECT id FROM users WHERE role='DEAN' AND is_active=true`);
      for (const d of deans.rows) {
        await client.query(
          'INSERT INTO notifications (user_id, claim_id, message) VALUES ($1,$2,$3)',
          [d.id, claimId, `Claim ${claim.claim_no} verified by SRIC — pending your review.`]
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
       <strong style="color:green">verified</strong> by SRIC and forwarded to Dean SR for final approval.</p>
       <a href="${process.env.CLIENT_URL}/faculty/claims/${claimId}" 
          style="background:#534AB7;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">
         View claim →
       </a>`
    : `<p>Dear ${claim.fac_name},</p>
       <p>Your claim <strong>${claim.claim_no}</strong> (₹${claim.total_amount}) has been
       <strong style="color:#c0392b">rejected</strong> by SRIC.</p>
       <p><strong>Reason:</strong> ${remarks}</p>
       <p>Please log in to review, edit, and resubmit.</p>
       <a href="${process.env.CLIENT_URL}/faculty/claims/${claimId}"
          style="background:#534AB7;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">
         View claim →
       </a>`;

  await sendEmail({
    to: claim.fac_email,
    subject: `Claim ${claim.claim_no} — ${action === 'APPROVED' ? 'Verified by SRIC' : 'Returned by SRIC'}`,
    html: emailHtml,
  });

  return { message: `Claim ${action === 'APPROVED' ? 'verified' : 'rejected'} successfully` };
};

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

  const newStatus = action === 'APPROVED' ? 'DEAN_FORWARDED' : 'DEAN_REJECTED';

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
      [claimId, deanId, action === 'APPROVED' ? 'APPROVED' : 'REJECTED', remarks || null]
    );

    await client.query(
      `INSERT INTO audit_logs (claim_id, user_id, action, metadata)
       VALUES ($1,$2,$3,$4)`,
      [claimId, deanId, `DEAN_${action === 'APPROVED' ? 'APPROVED' : 'REJECTED'}`,
       JSON.stringify({ remarks, claim_no: claim.claim_no })]
    );

    const notifMsg = action === 'APPROVED'
      ? `Your claim ${claim.claim_no} has been recommended and forwarded by Dean SR.`
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
          [a.id, claimId, `Claim ${claim.claim_no} recommended and forwarded by Dean — pending your processing.`]
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
       <strong style="color:green">recommended and forwarded</strong> by Dean SR for further processing.</p>
       <a href="${process.env.CLIENT_URL}/faculty/claims/${claimId}" 
          style="background:#534AB7;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">
         View claim →
       </a>`
    : `<p>Dear ${claim.fac_name},</p>
       <p>Your claim <strong>${claim.claim_no}</strong> (₹${claim.total_amount}) has been
       <strong style="color:#c0392b">rejected</strong> by Dean SR.</p>
       <p><strong>Reason:</strong> ${remarks}</p>
       <p>Please log in to review, edit, and resubmit.</p>
       <a href="${process.env.CLIENT_URL}/faculty/claims/${claimId}"
          style="background:#534AB7;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">
         View claim →
       </a>`;

  await sendEmail({
    to: claim.fac_email,
    subject: `Claim ${claim.claim_no} — ${action === 'APPROVED' ? 'Forwarded by Dean SR' : 'Returned by Dean SR'}`,
    html: emailHtml,
  });

  return { message: `Claim ${action === 'APPROVED' ? 'approved and forwarded' : 'rejected'} successfully` };
};

module.exports = { sricDecision, deanDecision };