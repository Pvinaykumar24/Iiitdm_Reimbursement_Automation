const router = require('express').Router();
const { verifyToken, requireRole } = require('../../middleware/auth');
const service = require('./projects.service');

router.use(verifyToken);

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

router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const project = await service.createProject(req.body);
    res.status(201).json(project);
  } catch (err) { next(err); }
});

module.exports = router;