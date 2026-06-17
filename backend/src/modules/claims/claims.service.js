const db = require('../../config/db');
const { sendNotification, sendEmail } = require('../notifications/notifications.service');

const generateClaimNo = async () => {
  const yr = new Date().getFullYear();
  const { rows } = await db.query(
    `SELECT COUNT(*) FROM claims WHERE claim_no LIKE $1`, [`CLM-${yr}-%`]
  );
  const seq = String(parseInt(rows[0].count) + 1).padStart(4, '0');
  return `CLM-${yr}-${seq}`;
};

const createClaim = async (facultyId, { project_id, budget_head_id, purpose }) => {
  const proj = await db.query(
    'SELECT * FROM projects WHERE id=$1 AND pi_id=$2 AND is_active=true',
    [project_id, facultyId]
  );
  if (!proj.rows.length) throw Object.assign(new Error('Invalid project or access denied'), { status: 403 });

  const claimNo = await generateClaimNo();
  const { rows } = await db.query(
    `INSERT INTO claims (claim_no, faculty_id, project_id, budget_head_id, purpose, total_amount, status)
     VALUES ($1,$2,$3,$4,$5,0,'DRAFT') RETURNING *`,
    [claimNo, facultyId, project_id, budget_head_id, purpose]
  );
  return rows[0];
};

const addItem = async (claimId, facultyId, item) => {
  const claim = await db.query(
    `SELECT * FROM claims WHERE id=$1 AND faculty_id=$2 AND status='DRAFT'`,
    [claimId, facultyId]
  );
  if (!claim.rows.length) throw Object.assign(new Error('Claim not found or already submitted'), { status: 404 });

  if (parseFloat(item.total_amount) > 25000)
    throw Object.assign(new Error('Single bill cannot exceed ₹25,000 as per institute policy'), { status: 400 });

  const billAge = (Date.now() - new Date(item.bill_date)) / (1000 * 60 * 60 * 24);
  if (billAge > 60)
    throw Object.assign(new Error('Bills older than 60 days are not accepted'), { status: 400 });

  const { rows } = await db.query(
    `INSERT INTO claim_items
     (claim_id, vendor_name, bill_no, bill_date, description,
      quantity, unit_price, cgst_percent, sgst_percent, igst_percent,
      total_amount, gstin_vendor, item_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
       (SELECT COALESCE(MAX(item_order),0)+1 FROM claim_items WHERE claim_id=$1))
     RETURNING *`,
    [claimId, item.vendor_name, item.bill_no, item.bill_date, item.description,
     item.quantity, item.unit_price,
     item.cgst_percent || 0, item.sgst_percent || 0, item.igst_percent || 0,
     item.total_amount, item.gstin_vendor || null]
  );

  await db.query(
    `UPDATE claims SET total_amount=(SELECT SUM(total_amount) FROM claim_items WHERE claim_id=$1),
     updated_at=NOW() WHERE id=$1`,
    [claimId]
  );
  return rows[0];
};

const removeItem = async (itemId, claimId, facultyId) => {
  const claim = await db.query(
    `SELECT * FROM claims WHERE id=$1 AND faculty_id=$2 AND status='DRAFT'`,
    [claimId, facultyId]
  );
  if (!claim.rows.length) throw Object.assign(new Error('Cannot modify submitted claim'), { status: 403 });

  await db.query('DELETE FROM claim_items WHERE id=$1 AND claim_id=$2', [itemId, claimId]);
  await db.query(
    `UPDATE claims SET total_amount=COALESCE((SELECT SUM(total_amount) FROM claim_items WHERE claim_id=$1),0),
     updated_at=NOW() WHERE id=$1`,
    [claimId]
  );
  return { message: 'Item removed' };
};

const submitClaim = async (claimId, facultyId) => {
  const { rows } = await db.query(
    `SELECT c.*, u.name AS faculty_name, u.email AS faculty_email
     FROM claims c JOIN users u ON u.id=c.faculty_id
     WHERE c.id=$1 AND c.faculty_id=$2 AND c.status='DRAFT'`,
    [claimId, facultyId]
  );
  if (!rows.length) throw Object.assign(new Error('Claim not found or already submitted'), { status: 404 });
  const claim = rows[0];

  // ── Validate bill items ──────────────────────────────────────────────────────
  const itemsRes = await db.query(
    'SELECT * FROM claim_items WHERE claim_id=$1 ORDER BY item_order', [claimId]
  );
  if (itemsRes.rows.length === 0)
    throw Object.assign(new Error('Cannot submit a claim with no bill items'), { status: 400 });

  const today = Date.now();
  for (const item of itemsRes.rows) {
    const billAge = (today - new Date(item.bill_date)) / (1000 * 60 * 60 * 24);
    if (billAge > 60)
      throw Object.assign(
        new Error(`Bill #${item.bill_no} (${item.vendor_name}) is older than 60 days and cannot be reimbursed`),
        { status: 400 }
      );
    if (parseFloat(item.total_amount) > 25000)
      throw Object.assign(
        new Error(`Bill #${item.bill_no} (${item.vendor_name}) exceeds the ₹25,000 per-bill limit`),
        { status: 400 }
      );
  }

  // ── Validate project belongs to faculty and is active ───────────────────────
  const projRes = await db.query(
    `SELECT p.id, bh.id AS bh_id
     FROM projects p
     JOIN budget_heads bh ON bh.project_id=p.id AND bh.id=$1
     WHERE p.id=$2 AND p.pi_id=$3 AND p.is_active=true`,
    [claim.budget_head_id, claim.project_id, facultyId]
  );
  if (!projRes.rows.length)
    throw Object.assign(
      new Error('Project or budget head is invalid / no longer active'),
      { status: 400 }
    );
  // ────────────────────────────────────────────────────────────────────────────

  await db.query(
    `UPDATE claims SET status='DEAN_PENDING', submitted_at=NOW(), updated_at=NOW() WHERE id=$1`,
    [claimId]
  );

  await db.query(
    `INSERT INTO audit_logs (claim_id, user_id, action, metadata)
     VALUES ($1,$2,'CLAIM_SUBMITTED',$3)`,
    [claimId, facultyId, JSON.stringify({ claim_no: claim.claim_no })]
  );

  const deans = await db.query(`SELECT id, email FROM users WHERE role='DEAN' AND is_active=true`);
  for (const dean of deans.rows) {
    await sendNotification(dean.id, claimId,
      `New claim ${claim.claim_no} submitted by ${claim.faculty_name} — awaiting your review.`
    );
  }

  return { message: 'Claim submitted successfully', claim_no: claim.claim_no };
};

const getMyClaims = async (facultyId) => {
  const { rows } = await db.query(
    `SELECT c.*, p.title AS project_title, p.funding_agency,
      bh.head_name AS budget_head,
      (SELECT COUNT(*) FROM claim_items ci WHERE ci.claim_id=c.id) AS item_count
     FROM claims c
     LEFT JOIN projects p ON p.id=c.project_id
     LEFT JOIN budget_heads bh ON bh.id=c.budget_head_id
     WHERE c.faculty_id=$1
     ORDER BY c.created_at DESC`,
    [facultyId]
  );
  return rows;
};

const getClaimById = async (claimId, userId, userRole) => {
  const { rows } = await db.query(
    `SELECT c.*, 
      u.name AS faculty_name, u.email AS faculty_email, u.department,
      p.title AS project_title, p.project_no, p.funding_agency,
      bh.head_name AS budget_head
     FROM claims c
     JOIN users u ON u.id=c.faculty_id
     LEFT JOIN projects p ON p.id=c.project_id
     LEFT JOIN budget_heads bh ON bh.id=c.budget_head_id
     WHERE c.id=$1`,
    [claimId]
  );
  if (!rows.length) throw Object.assign(new Error('Claim not found'), { status: 404 });
  const claim = rows[0];

  if (userRole === 'FACULTY' && claim.faculty_id !== userId)
    throw Object.assign(new Error('Access denied'), { status: 403 });

  const items = await db.query(
    'SELECT * FROM claim_items WHERE claim_id=$1 ORDER BY item_order', [claimId]
  );
  const approvals = await db.query(
    `SELECT a.*, u.name AS actor_name FROM approvals a
     JOIN users u ON u.id=a.actor_id WHERE a.claim_id=$1 ORDER BY a.acted_at`,
    [claimId]
  );
  const logs = await db.query(
    `SELECT al.*, u.name AS actor_name FROM audit_logs al
     JOIN users u ON u.id=al.user_id WHERE al.claim_id=$1 ORDER BY al.created_at`,
    [claimId]
  );

  return { ...claim, items: items.rows, approvals: approvals.rows, audit_logs: logs.rows };
};

const getPendingForDean = async () => {
  const { rows } = await db.query(
    `SELECT c.*, u.name AS faculty_name, u.department,
      p.title AS project_title, p.funding_agency,
      bh.head_name AS budget_head
     FROM claims c
     JOIN users u ON u.id=c.faculty_id
     LEFT JOIN projects p ON p.id=c.project_id
     LEFT JOIN budget_heads bh ON bh.id=c.budget_head_id
     WHERE c.status='DEAN_PENDING'
     ORDER BY c.submitted_at ASC`
  );
  return rows;
};

const getDecidedByDean = async () => {
  const { rows } = await db.query(
    `SELECT c.*, u.name AS faculty_name, u.department,
      p.title AS project_title, p.funding_agency,
      bh.head_name AS budget_head,
      a.action AS dean_action, a.remarks AS dean_remarks, a.acted_at AS decided_at,
      actor.name AS decided_by
     FROM claims c
     JOIN users u ON u.id=c.faculty_id
     LEFT JOIN projects p ON p.id=c.project_id
     LEFT JOIN budget_heads bh ON bh.id=c.budget_head_id
     LEFT JOIN approvals a ON a.claim_id=c.id AND a.stage='DEAN_REVIEW'
     LEFT JOIN users actor ON actor.id=a.actor_id
     WHERE c.status IN ('DEAN_APPROVED','DEAN_REJECTED','ACCOUNTS_PENDING','PROCESSED')
     ORDER BY a.acted_at DESC NULLS LAST`
  );
  return rows;
};

const deleteDraft = async (claimId, facultyId) => {
  const { rows } = await db.query(
    `SELECT * FROM claims WHERE id=$1 AND faculty_id=$2 AND status='DRAFT'`,
    [claimId, facultyId]
  );
  if (!rows.length) throw Object.assign(new Error('Draft not found'), { status: 404 });
  await db.query('DELETE FROM claim_items WHERE claim_id=$1', [claimId]);
  await db.query('DELETE FROM claims WHERE id=$1', [claimId]);
  return { message: 'Draft deleted' };
};

module.exports = {
  createClaim, addItem, removeItem, submitClaim,
  getMyClaims, getClaimById, getPendingForDean, getDecidedByDean, deleteDraft
};