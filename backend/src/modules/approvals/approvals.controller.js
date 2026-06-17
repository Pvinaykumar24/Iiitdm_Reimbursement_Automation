const service = require('./approvals.service');

const deanDecision = async (req, res, next) => {
  try {
    const { action, remarks } = req.body;
    const result = await service.deanDecision(req.params.id, req.user.id, action, remarks);
    res.json(result);
  } catch (err) { next(err); }
};

module.exports = { deanDecision };