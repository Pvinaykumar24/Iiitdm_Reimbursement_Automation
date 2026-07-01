const db = require('../../config/db');
const { sendNotification } = require('../notifications/notifications.service');

const VALID_BUDGET_HEADS = ['Consumable', 'Contingency', 'Travel', 'Equipment', 'Others', 'Accountable Consumable'];

const generateClaimNo = async () => {
  const yr = new Date().getFullYear().toString().slice(-2);
  const { rows } = await db.query(
    `SELECT COUNT(*) FROM claims WHERE claim_no LIKE $1`, [`CLM-${yr}-%`]
  );
  const seq = String(parseInt(rows[0].count) + 1).padStart(5, '0');
  return `CLM-${yr}-${seq}`;
};

const createClaim = async (facultyId, { project_no, purpose }) => {
  if (!project_no || !project_no.trim())
    throw Object.assign(new Error('Project number / name is required'), { status: 400 });

  const { rows } = await db.query(
    `INSERT INTO claims (claim_no, faculty_id, project_no, budget_head, purpose, total_amount, status)
     VALUES ($1,$2,$3,$4,$5,0,'DRAFT') RETURNING *`,
    [null, facultyId, project_no.trim(), null, purpose]
  );
  return rows[0];
};

const addItem = async (claimId, facultyId, item) => {
  const claim = await db.query(
    `SELECT * FROM claims WHERE id=$1 AND faculty_id=$2 AND status IN ('DRAFT', 'SRIC_REJECTED', 'DEAN_REJECTED')`,
    [claimId, facultyId]
  );
  if (!claim.rows.length) throw Object.assign(new Error('Claim not found or not in editable status'), { status: 404 });

  if (parseFloat(item.total_amount) > 25000)
    throw Object.assign(new Error('Single bill cannot exceed ₹25,000 as per institute policy'), { status: 400 });

  const billAge = (Date.now() - new Date(item.bill_date)) / (1000 * 60 * 60 * 24);
  if (billAge > 60)
    throw Object.assign(new Error('Bills older than 60 days are not accepted'), { status: 400 });

  const { rows } = await db.query(
    `INSERT INTO claim_items
     (claim_id, vendor_name, bill_no, bill_date, description,
      quantity, unit_price, cgst_percent, sgst_percent, igst_percent,
      total_amount, gstin_vendor, quantity_unit, other_charges, item_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
       (SELECT COALESCE(MAX(item_order),0)+1 FROM claim_items WHERE claim_id=$1))
     RETURNING *`,
    [claimId, item.vendor_name, item.bill_no, item.bill_date, item.description,
     item.quantity, item.unit_price,
     item.cgst_percent || 0, item.sgst_percent || 0, item.igst_percent || 0,
     item.total_amount, item.gstin_vendor || null,
     item.quantity_unit || 'pcs', item.other_charges || 0]
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
    `SELECT * FROM claims WHERE id=$1 AND faculty_id=$2 AND status IN ('DRAFT', 'SRIC_REJECTED', 'DEAN_REJECTED')`,
    [claimId, facultyId]
  );
  if (!claim.rows.length) throw Object.assign(new Error('Cannot modify claim in current status'), { status: 403 });

  await db.query('DELETE FROM claim_items WHERE id=$1 AND claim_id=$2', [itemId, claimId]);
  await db.query(
    `UPDATE claims SET total_amount=COALESCE((SELECT SUM(total_amount) FROM claim_items WHERE claim_id=$1),0),
     updated_at=NOW() WHERE id=$1`,
    [claimId]
  );
  return { message: 'Item removed' };
};

const clearItems = async (claimId, facultyId) => {
  const claim = await db.query(
    `SELECT * FROM claims WHERE id=$1 AND faculty_id=$2 AND status IN ('DRAFT', 'SRIC_REJECTED', 'DEAN_REJECTED')`,
    [claimId, facultyId]
  );
  if (!claim.rows.length) throw Object.assign(new Error('Cannot modify claim in current status'), { status: 403 });

  await db.query('DELETE FROM claim_items WHERE claim_id=$1', [claimId]);
  await db.query(
    `UPDATE claims SET total_amount=0, updated_at=NOW() WHERE id=$1`,
    [claimId]
  );
  return { message: 'All items cleared' };
};

const submitClaim = async (claimId, facultyId) => {
  const { rows } = await db.query(
    `SELECT c.*, u.name AS faculty_name, u.email AS faculty_email
     FROM claims c JOIN users u ON u.id=c.faculty_id
     WHERE c.id=$1 AND c.faculty_id=$2 AND c.status IN ('DRAFT', 'SRIC_REJECTED', 'DEAN_REJECTED')`,
    [claimId, facultyId]
  );
  if (!rows.length) throw Object.assign(new Error('Claim not found or not in editable status'), { status: 404 });
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

  const isResubmit = ['SRIC_REJECTED', 'DEAN_REJECTED'].includes(claim.status);
  const nextVer = isResubmit ? (claim.version || 1) + 1 : (claim.version || 1);

  let claimNo = claim.claim_no;
  if (!claimNo) {
    claimNo = await generateClaimNo();
  }

  await db.query(
    `UPDATE claims SET status='SRIC_PENDING', claim_no=$3, submitted_at=NOW(), updated_at=NOW(), version=$2 WHERE id=$1`,
    [claimId, nextVer, claimNo]
  );

  const actionName = isResubmit ? 'CLAIM_RESUBMITTED' : 'CLAIM_SUBMITTED';

  await db.query(
    `INSERT INTO audit_logs (claim_id, user_id, action, metadata)
     VALUES ($1,$2,$3,$4)`,
    [claimId, facultyId, actionName, JSON.stringify({ claim_no: claimNo, version: nextVer })]
  );

  const srics = await db.query(`SELECT id, email FROM users WHERE role='SRIC' AND is_active=true`);
  for (const sric of srics.rows) {
    await sendNotification(sric.id, claimId,
      `New claim ${claimNo} submitted by ${claim.faculty_name} — awaiting your verification.`
    );
  }

  return { message: 'Claim submitted successfully', claim_no: claimNo };
};

const getMyClaims = async (facultyId) => {
  const { rows } = await db.query(
    `SELECT c.*,
      (SELECT COUNT(*) FROM claim_items ci WHERE ci.claim_id=c.id) AS item_count
     FROM claims c
     WHERE c.faculty_id=$1
     ORDER BY c.created_at DESC`,
    [facultyId]
  );
  return rows;
};

const getClaimById = async (claimId, userId, userRole) => {
  const { rows } = await db.query(
    `SELECT c.*,
      u.name AS faculty_name, u.email AS faculty_email, u.department
     FROM claims c
     JOIN users u ON u.id=c.faculty_id
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
    `SELECT c.*, u.name AS faculty_name, u.department
     FROM claims c
     JOIN users u ON u.id=c.faculty_id
     WHERE c.status='DEAN_PENDING'
     ORDER BY c.submitted_at ASC`
  );
  return rows;
};

const getPendingForSric = async () => {
  const { rows } = await db.query(
    `SELECT c.*, u.name AS faculty_name, u.department
     FROM claims c
     JOIN users u ON u.id=c.faculty_id
     WHERE c.status='SRIC_PENDING'
     ORDER BY c.submitted_at ASC`
  );
  return rows;
};

const getDecidedBySric = async () => {
  const { rows } = await db.query(
    `SELECT c.*, u.name AS faculty_name, u.department,
      a.action AS sric_action, a.remarks AS sric_remarks, a.acted_at AS decided_at,
      actor.name AS decided_by
     FROM claims c
     JOIN users u ON u.id=c.faculty_id
     LEFT JOIN approvals a ON a.claim_id=c.id AND a.stage='SRIC_REVIEW'
     LEFT JOIN users actor ON actor.id=a.actor_id
     WHERE c.status IN ('SRIC_VERIFIED', 'SRIC_REJECTED', 'DEAN_PENDING', 'DEAN_FORWARDED', 'DEAN_REJECTED', 'PROCESSED', 'REJECTED')
     ORDER BY a.acted_at DESC NULLS LAST`
  );
  return rows;
};

const getDecidedByDean = async () => {
  const { rows } = await db.query(
    `SELECT c.*, u.name AS faculty_name, u.department,
      a.action AS dean_action, a.remarks AS dean_remarks, a.acted_at AS decided_at,
      actor.name AS decided_by
     FROM claims c
     JOIN users u ON u.id=c.faculty_id
     LEFT JOIN approvals a ON a.claim_id=c.id AND a.stage='DEAN_REVIEW'
     LEFT JOIN users actor ON actor.id=a.actor_id
     WHERE c.status IN ('DEAN_FORWARDED','DEAN_REJECTED','PROCESSED','REJECTED')
     ORDER BY a.acted_at DESC NULLS LAST`
  );
  return rows;
};

const getAllClaims = async (searchQuery = '', userId, userRole, startDate, endDate) => {
  let query = `
    SELECT c.*, u.name AS faculty_name, u.email AS faculty_email, u.department, u.employee_id,
      (SELECT COUNT(*) FROM claim_items ci WHERE ci.claim_id=c.id) AS item_count
    FROM claims c
    JOIN users u ON u.id=c.faculty_id
  `;
  const params = [];
  const whereClauses = [];

  if (userRole === 'DEAN') {
    whereClauses.push(`(c.status IN ('DEAN_PENDING', 'DEAN_FORWARDED', 'PROCESSED', 'DEAN_REJECTED')
      OR EXISTS (
        SELECT 1 FROM audit_logs al 
        WHERE al.claim_id = c.id AND al.action = 'DEAN_REJECTED'
      ))`);
  }

  if (userRole === 'SRIC') {
    whereClauses.push(`c.status <> 'DRAFT'`);
  }

  if (startDate) {
    params.push(startDate);
    whereClauses.push(`c.created_at >= $${params.length}::date`);
  }
  if (endDate) {
    params.push(endDate);
    whereClauses.push(`c.created_at < ($${params.length}::date + interval '1 day')`);
  }

  if (searchQuery && searchQuery.trim()) {
    params.push(`%${searchQuery.trim()}%`);
    const idx = params.length;
    whereClauses.push(`(c.claim_no ILIKE $${idx} OR u.name ILIKE $${idx} OR u.employee_id ILIKE $${idx} OR c.purpose ILIKE $${idx} OR c.status ILIKE $${idx})`);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ` ORDER BY c.created_at DESC`;
  const { rows } = await db.query(query, params);
  return rows;
};

const getBudgetSummary = async (startDate, endDate) => {
  let query = `
    SELECT
      EXTRACT(YEAR FROM c.submitted_at)::int AS year,
      COALESCE(ci.budget_head, 'Unclassified') AS budget_head,
      SUM(ci.total_amount) AS total
    FROM claim_items ci
    JOIN claims c ON c.id = ci.claim_id
    WHERE c.status IN ('DEAN_FORWARDED', 'PROCESSED')
      AND c.submitted_at IS NOT NULL
  `;
  const params = [];
  if (startDate) {
    params.push(startDate);
    query += ` AND c.submitted_at >= $${params.length}::date`;
  }
  if (endDate) {
    params.push(endDate);
    query += ` AND c.submitted_at < ($${params.length}::date + interval '1 day')`;
  }
  query += `
    GROUP BY EXTRACT(YEAR FROM c.submitted_at)::int, COALESCE(ci.budget_head, 'Unclassified')
    ORDER BY year DESC, budget_head
  `;
  const { rows } = await db.query(query, params);
  return rows;
};

const getFacultyProfile = async (facultyId) => {
  const userRes = await db.query(
    `SELECT id, name, email, department, employee_id, phone, designation FROM users WHERE id=$1`,
    [facultyId]
  );
  if (!userRes.rows.length) throw Object.assign(new Error('Faculty not found'), { status: 404 });
  const user = userRes.rows[0];

  const claimsRes = await db.query(
    `SELECT c.*, 
      (SELECT COUNT(*) FROM claim_items ci WHERE ci.claim_id=c.id) AS item_count
     FROM claims c 
     WHERE c.faculty_id=$1 AND c.status <> 'DRAFT'
     ORDER BY c.created_at DESC`,
    [facultyId]
  );

  return {
    profile: user,
    claims: claimsRes.rows
  };
};

const editDraftClaim = async (claimId, facultyId, { project_no, purpose }) => {
  const { rows } = await db.query(
    `UPDATE claims 
     SET project_no=COALESCE($3, project_no), 
         purpose=COALESCE($4, purpose), 
         updated_at=NOW() 
     WHERE id=$1 AND faculty_id=$2 AND status IN ('DRAFT', 'SRIC_REJECTED', 'DEAN_REJECTED')
     RETURNING *`,
    [claimId, facultyId, project_no ? project_no.trim() : null, purpose ? purpose.trim() : null]
  );
  if (!rows.length) throw Object.assign(new Error('Claim not found or not editable'), { status: 404 });
  return rows[0];
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
  createClaim, addItem, removeItem, clearItems, submitClaim,
  getMyClaims, getClaimById, getPendingForDean, getDecidedByDean, deleteDraft,
  getPendingForSric, getDecidedBySric, getAllClaims, getFacultyProfile, editDraftClaim,
  getBudgetSummary
};