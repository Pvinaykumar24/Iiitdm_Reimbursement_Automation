const db = require('../../config/db');

const getMyProjects = async (facultyId) => {
  const { rows } = await db.query(
    `SELECT p.*, 
      (SELECT json_agg(bh) FROM budget_heads bh WHERE bh.project_id = p.id) AS budget_heads
     FROM projects p
     WHERE (p.pi_id = $1 OR p.id IN (SELECT project_id FROM project_copis WHERE co_pi_id = $1)) AND p.is_active = true
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

const createProject = async ({ project_no, title, funding_agency, pi_employee_id, total_budget, start_date, end_date, budget_heads, co_pi_employee_ids }) => {
  let piId = null;
  if (pi_employee_id && pi_employee_id.trim()) {
    const { rows: userRows } = await db.query(
      "SELECT id FROM users WHERE employee_id = $1 AND role = 'FACULTY'",
      [pi_employee_id.trim()]
    );
    if (!userRows.length) {
      throw Object.assign(new Error(`PI with Employee ID '${pi_employee_id}' not found.`), { status: 404 });
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

    // Create Co-PI associations
    if (co_pi_employee_ids && co_pi_employee_ids.length) {
      for (const empId of co_pi_employee_ids) {
        if (!empId || !empId.trim()) continue;
        const { rows: userRows } = await client.query(
          "SELECT id FROM users WHERE employee_id = $1 AND role = 'FACULTY'",
          [empId.trim()]
        );
        if (!userRows.length) {
          throw Object.assign(new Error(`Co-PI with Employee ID '${empId}' not found.`), { status: 404 });
        }
        const coPiId = userRows[0].id;

        if (coPiId === piId) {
          throw Object.assign(new Error(`A faculty member cannot be both PI and Co-PI on the same project.`), { status: 400 });
        }

        await client.query(
          'INSERT INTO project_copis (project_id, co_pi_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [project.id, coPiId]
        );
      }
    }

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
    `SELECT p.*, u.name AS pi_name, u.employee_id AS pi_employee_id,
       COALESCE(
         (SELECT json_agg(json_build_object('id', u2.id, 'name', u2.name, 'employee_id', u2.employee_id, 'department', u2.department))
          FROM project_copis pc
          JOIN users u2 ON u2.id = pc.co_pi_id
          WHERE pc.project_id = p.id),
         '[]'::json
       ) AS co_pis
     FROM projects p
     LEFT JOIN users u ON u.id = p.pi_id
     ORDER BY p.project_no ASC`
  );
  return rows;
};

const updateProjectFaculty = async (projectId, { pi_employee_id, co_pi_employee_ids }) => {
  let piId = null;
  if (pi_employee_id && pi_employee_id.trim()) {
    const { rows: userRows } = await db.query(
      "SELECT id FROM users WHERE employee_id = $1 AND role = 'FACULTY'",
      [pi_employee_id.trim()]
    );
    if (!userRows.length) {
      throw Object.assign(new Error(`PI with Employee ID '${pi_employee_id}' not found.`), { status: 404 });
    }
    piId = userRows[0].id;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update PI ID
    await client.query(
      'UPDATE projects SET pi_id = $1 WHERE id = $2',
      [piId, projectId]
    );

    // Update Co-PI associations
    await client.query(
      'DELETE FROM project_copis WHERE project_id = $1',
      [projectId]
    );

    if (co_pi_employee_ids && co_pi_employee_ids.length) {
      for (const empId of co_pi_employee_ids) {
        if (!empId || !empId.trim()) continue;
        const { rows: userRows } = await client.query(
          "SELECT id FROM users WHERE employee_id = $1 AND role = 'FACULTY'",
          [empId.trim()]
        );
        if (!userRows.length) {
          throw Object.assign(new Error(`Co-PI with Employee ID '${empId}' not found.`), { status: 404 });
        }
        const coPiId = userRows[0].id;

        if (coPiId === piId) {
          throw Object.assign(new Error(`A faculty member cannot be both PI and Co-PI on the same project.`), { status: 400 });
        }

        await client.query(
          'INSERT INTO project_copis (project_id, co_pi_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [projectId, coPiId]
        );
      }
    }

    await client.query('COMMIT');
    return { success: true, message: 'Project assignment updated successfully' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getFacultiesList = async () => {
  const { rows } = await db.query(
    "SELECT id, name, employee_id, department FROM users WHERE role = 'FACULTY' AND is_active = true ORDER BY name ASC"
  );
  return rows;
};

module.exports = { getMyProjects, getBudgetHeads, createProject, getAllProjects, updateProjectFaculty, getFacultiesList };