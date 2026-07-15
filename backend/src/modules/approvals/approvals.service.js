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
      // Fetch all items belonging to the claim (need bill_no + all faculty GST columns for invoice-level grouping)
      const { rows: itemRows } = await client.query(
        `SELECT id, bill_no, cgst_amount, sgst_amount, igst_amount, other_charges FROM claim_items WHERE claim_id = $1`,
        [claimId]
      );

      // Group items by invoice (bill_no) and validate at invoice level
      const invoiceGroups = {};
      for (const it of itemRows) {
        const key = it.bill_no || 'unknown';
        if (!invoiceGroups[key]) {
          invoiceGroups[key] = { bill_no: it.bill_no, facultyCGST: 0, facultySGST: 0, facultyIGST: 0, facultyOther: 0, sricCGST: 0, sricSGST: 0, sricIGST: 0, sricOther: 0 };
        }
        invoiceGroups[key].facultyCGST += parseFloat(it.cgst_amount || 0);
        invoiceGroups[key].facultySGST += parseFloat(it.sgst_amount || 0);
        invoiceGroups[key].facultyIGST += parseFloat(it.igst_amount || 0);
        invoiceGroups[key].facultyOther += parseFloat(it.other_charges || 0);

        const val = itemBudgetHeads[it.id];
        if (val && typeof val === 'object') {
          invoiceGroups[key].sricCGST += parseFloat(val.sric_cgst || 0);
          invoiceGroups[key].sricSGST += parseFloat(val.sric_sgst || 0);
          invoiceGroups[key].sricIGST += parseFloat(val.sric_igst || 0);
          invoiceGroups[key].sricOther += parseFloat(val.sric_other_charges || 0);
        }
      }

      for (const inv of Object.values(invoiceGroups)) {
        const facultyTotal = inv.facultyCGST + inv.facultySGST + inv.facultyIGST;
        const sricTotal = inv.sricCGST + inv.sricSGST + inv.sricIGST;
        if (Math.abs(sricTotal - facultyTotal) > 0.10) {
          throw Object.assign(
            new Error(`Invoice "${inv.bill_no}": Segregated GST total (₹${sricTotal.toFixed(2)}) does not match faculty-entered GST (₹${facultyTotal.toFixed(2)}). Please adjust the tax allocations.`),
            { status: 400 }
          );
        }
        if (Math.abs(inv.sricOther - inv.facultyOther) > 0.10) {
          throw Object.assign(
            new Error(`Invoice "${inv.bill_no}": Segregated Other Charges (₹${inv.sricOther.toFixed(2)}) does not match faculty-entered Other Charges (₹${inv.facultyOther.toFixed(2)}). Please adjust the other charge allocations.`),
            { status: 400 }
          );
        }
      }

      // Now save each segregation update
      for (const [itemId, val] of Object.entries(itemBudgetHeads)) {
        let budgetHead = 'Consumable';
        let sricCgst = 0;
        let sricSgst = 0;
        let sricIgst = 0;
        let sricOther = 0;

        if (val && typeof val === 'object') {
          budgetHead = val.budget_head || 'Consumable';
          sricCgst = parseFloat(val.sric_cgst || 0);
          sricSgst = parseFloat(val.sric_sgst || 0);
          sricIgst = parseFloat(val.sric_igst || 0);
          sricOther = parseFloat(val.sric_other_charges || 0);
        } else {
          budgetHead = val || 'Consumable';
        }

        if (!VALID_BUDGET_HEADS.includes(budgetHead)) {
          throw Object.assign(new Error(`Invalid budget head: ${budgetHead}`), { status: 400 });
        }

        await client.query(
          `UPDATE claim_items 
           SET budget_head = $1, sric_cgst = $2, sric_sgst = $3, sric_igst = $4, sric_other_charges = $5
           WHERE id = $6 AND claim_id = $7`,
          [budgetHead, sricCgst, sricSgst, sricIgst, sricOther, itemId, claimId]
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
      ? `Your claim ${claim.claim_no} has been recommended by SRIC and forwarded to Dean.`
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
          [d.id, claimId, `Claim ${claim.claim_no} recommended by SRIC and forwarded — pending your review.`]
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
       <strong style="color:green">recommended</strong> by SRIC and forwarded to Dean SR for final approval.</p>
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
    subject: `Claim ${claim.claim_no} — ${action === 'APPROVED' ? 'SRIC Recommended & Forwarded to Dean' : 'Returned by SRIC'}`,
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
    } else {
      const srics = await client.query(`SELECT id FROM users WHERE role='SRIC' AND is_active=true`);
      for (const s of srics.rows) {
        await client.query(
          'INSERT INTO notifications (user_id, claim_id, message) VALUES ($1,$2,$3)',
          [s.id, claimId, `Claim ${claim.claim_no} was rejected by Dean SR. Reason: ${remarks}`]
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

const updateSricSegregation = async (claimId, sricUserId, itemBudgetHeads) => {
  if (!itemBudgetHeads || typeof itemBudgetHeads !== 'object')
    throw Object.assign(new Error('Budget head segregation is required'), { status: 400 });

  const { rows } = await db.query(
    `SELECT * FROM claims WHERE id=$1`,
    [claimId]
  );
  if (!rows.length) throw Object.assign(new Error('Claim not found'), { status: 404 });
  const claim = rows[0];

  if (claim.status !== 'SRIC_PENDING' && claim.status !== 'DEAN_PENDING') {
    throw Object.assign(new Error('Claim segregation can only be modified for pending or dean-review claims.'), { status: 400 });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch all items belonging to the claim (need bill_no + all faculty GST columns for invoice-level grouping)
    const { rows: itemRows } = await client.query(
      `SELECT id, bill_no, cgst_amount, sgst_amount, igst_amount, other_charges FROM claim_items WHERE claim_id = $1`,
      [claimId]
    );

    // Group items by invoice (bill_no) and validate at invoice level
    const invoiceGroups = {};
    for (const it of itemRows) {
      const key = it.bill_no || 'unknown';
      if (!invoiceGroups[key]) {
        invoiceGroups[key] = { bill_no: it.bill_no, facultyCGST: 0, facultySGST: 0, facultyIGST: 0, facultyOther: 0, sricCGST: 0, sricSGST: 0, sricIGST: 0, sricOther: 0 };
      }
      invoiceGroups[key].facultyCGST += parseFloat(it.cgst_amount || 0);
      invoiceGroups[key].facultySGST += parseFloat(it.sgst_amount || 0);
      invoiceGroups[key].facultyIGST += parseFloat(it.igst_amount || 0);
      invoiceGroups[key].facultyOther += parseFloat(it.other_charges || 0);

      const val = itemBudgetHeads[it.id];
      if (val && typeof val === 'object') {
        invoiceGroups[key].sricCGST += parseFloat(val.sric_cgst || 0);
        invoiceGroups[key].sricSGST += parseFloat(val.sric_sgst || 0);
        invoiceGroups[key].sricIGST += parseFloat(val.sric_igst || 0);
        invoiceGroups[key].sricOther += parseFloat(val.sric_other_charges || 0);
      }
    }

    for (const inv of Object.values(invoiceGroups)) {
      const facultyTotal = inv.facultyCGST + inv.facultySGST + inv.facultyIGST;
      const sricTotal = inv.sricCGST + inv.sricSGST + inv.sricIGST;
      if (Math.abs(sricTotal - facultyTotal) > 0.10) {
        throw Object.assign(
          new Error(`Invoice "${inv.bill_no}": Segregated GST total (₹${sricTotal.toFixed(2)}) does not match faculty-entered GST (₹${facultyTotal.toFixed(2)}). Please adjust the tax allocations.`),
          { status: 400 }
        );
      }
      if (Math.abs(inv.sricOther - inv.facultyOther) > 0.10) {
        throw Object.assign(
          new Error(`Invoice "${inv.bill_no}": Segregated Other Charges (₹${inv.sricOther.toFixed(2)}) does not match faculty-entered Other Charges (₹${inv.facultyOther.toFixed(2)}). Please adjust the other charge allocations.`),
          { status: 400 }
        );
      }
    }

    // Now save each segregation update
    for (const [itemId, val] of Object.entries(itemBudgetHeads)) {
      let budgetHead = 'Consumable';
      let sricCgst = 0;
      let sricSgst = 0;
      let sricIgst = 0;
      let sricOther = 0;

      if (val && typeof val === 'object') {
        budgetHead = val.budget_head || 'Consumable';
        sricCgst = parseFloat(val.sric_cgst || 0);
        sricSgst = parseFloat(val.sric_sgst || 0);
        sricIgst = parseFloat(val.sric_igst || 0);
        sricOther = parseFloat(val.sric_other_charges || 0);
      } else {
        budgetHead = val || 'Consumable';
      }

      if (!VALID_BUDGET_HEADS.includes(budgetHead)) {
        throw Object.assign(new Error(`Invalid budget head: ${budgetHead}`), { status: 400 });
      }

      await client.query(
        `UPDATE claim_items 
         SET budget_head = $1, sric_cgst = $2, sric_sgst = $3, sric_igst = $4, sric_other_charges = $5
         WHERE id = $6 AND claim_id = $7`,
        [budgetHead, sricCgst, sricSgst, sricIgst, sricOther, itemId, claimId]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (claim_id, user_id, action, metadata)
       VALUES ($1,$2,$3,$4)`,
      [claimId, sricUserId, 'SRIC_SEGREGATION_UPDATED',
        JSON.stringify({ claim_no: claim.claim_no })]
    );

    await client.query('COMMIT');
    return { message: 'Segregation updated successfully' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { sricDecision, deanDecision, updateSricSegregation };