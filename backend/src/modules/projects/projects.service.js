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

const createProject = async ({ project_no, title, funding_agency, pi_id, total_budget, start_date, end_date, budget_heads }) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO projects (project_no, title, funding_agency, pi_id, total_budget, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [project_no, title, funding_agency, pi_id, total_budget, start_date || null, end_date || null]
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

module.exports = { getMyProjects, getBudgetHeads, createProject };