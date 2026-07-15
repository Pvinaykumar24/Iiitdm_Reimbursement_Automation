const router = require('express').Router();
const { verifyToken, requireRole } = require('../../middleware/auth');
const service = require('./projects.service');

router.use(verifyToken);

router.get('/', requireRole('SRIC', 'DEAN'), async (req, res, next) => {
  try {
    const projects = await service.getAllProjects();
    res.json(projects);
  } catch (err) { next(err); }
});

router.get('/faculties', requireRole('SRIC'), async (req, res, next) => {
  try {
    const list = await service.getFacultiesList();
    res.json(list);
  } catch (err) { next(err); }
});

router.patch('/:id/assign', requireRole('SRIC'), async (req, res, next) => {
  try {
    const { employee_id, pi_employee_id, co_pi_employee_ids } = req.body;
    const pi = pi_employee_id !== undefined ? pi_employee_id : employee_id;
    const result = await service.updateProjectFaculty(req.params.id, {
      pi_employee_id: pi,
      co_pi_employee_ids: co_pi_employee_ids || []
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/my', requireRole('FACULTY'), async (req, res, next) => {
  try {
    const projects = await service.getMyProjects(req.user.id);
    res.json(projects);
  } catch (err) { next(err); }
});

router.get('/:id/budget-heads', requireRole('FACULTY'), async (req, res, next) => {
  try {
    const heads = await service.getBudgetHeads(req.params.id);
    res.json(heads);
  } catch (err) { next(err); }
});

router.post('/', requireRole('SRIC', 'ADMIN'), async (req, res, next) => {
  try {
    const project = await service.createProject(req.body);
    res.status(201).json(project);
  } catch (err) { next(err); }
});

module.exports = router;