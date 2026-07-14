const db = require('../../config/db');

const getMyProjects = async (facultyId) => {
  const { rows } = await db.query(
    `SELECT p.*, 
      (SELECT json_agg(bh) FROM budget_heads bh WHERE bh.project_id = p.id) AS budget_heads
     FROM projects p
     WHERE p.pi_id = $1 AND p.is_active = true
     ORDER BY p.created_at DESC`,
    [facultyId]
  );
  return rows;
};

const getBudgetHeads = async (projectId) => {
  const { rows } = await db.query(
    'SELECT * FROM budget_heads WHERE project_id=$1', [projectId]
  );
  return rows;
};

const createProject = async ({ project_no, title, funding_agency, pi_employee_id, total_budget, start_date, end_date, budget_heads }) => {
  let piId = null;
  if (pi_employee_id && pi_employee_id.trim()) {
    const { rows: userRows } = await db.query(
      "SELECT id FROM users WHERE employee_id = $1 AND role = 'FACULTY'",
      [pi_employee_id.trim()]
    );
    if (!userRows.length) {
      throw Object.assign(new Error(`Faculty with Employee ID '${pi_employee_id}' not found.`), { status: 404 });
    }
    piId = userRows[0].id;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO projects (project_no, title, funding_agency, pi_id, total_budget, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [project_no, title, funding_agency, piId, total_budget, start_date || null, end_date || null]
    );
    const project = rows[0];
    if (budget_heads && budget_heads.length) {
      for (const bh of budget_heads) {
        await client.query(
          'INSERT INTO budget_heads (project_id, head_name, allocated) VALUES ($1,$2,$3)',
          [project.id, bh.head_name, bh.allocated]
        );
      }
    }
    await client.query('COMMIT');
    return project;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getAllProjects = async () => {
  const { rows } = await db.query(
    `SELECT p.*, u.name AS pi_name, u.employee_id AS pi_employee_id
     FROM projects p
     LEFT JOIN users u ON u.id = p.pi_id
     ORDER BY p.project_no ASC`
  );
  return rows;
};

const assignProjectPI = async (projectId, employeeId) => {
  if (!employeeId || !employeeId.trim()) {
    const { rows } = await db.query(
      'UPDATE projects SET pi_id = NULL WHERE id = $1 RETURNING *',
      [projectId]
    );
    return { success: true, message: 'Faculty unassigned successfully', project: rows[0] };
  }

  const { rows: userRows } = await db.query(
    "SELECT id FROM users WHERE employee_id = $1 AND role = 'FACULTY'",
    [employeeId.trim()]
  );
  if (!userRows.length) {
    throw Object.assign(new Error(`Faculty with Employee ID '${employeeId}' not found.`), { status: 404 });
  }

  const piId = userRows[0].id;
  const { rows: updatedRows } = await db.query(
    'UPDATE projects SET pi_id = $1 WHERE id = $2 RETURNING *',
    [piId, projectId]
  );
  return { success: true, message: 'Faculty assigned successfully', project: updatedRows[0] };
};

const getFacultiesList = async () => {
  const { rows } = await db.query(
    "SELECT id, name, employee_id, department FROM users WHERE role = 'FACULTY' AND is_active = true ORDER BY name ASC"
  );
  return rows;
};

module.exports = { getMyProjects, getBudgetHeads, createProject, getAllProjects, assignProjectPI, getFacultiesList };