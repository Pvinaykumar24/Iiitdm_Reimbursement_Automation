const service = require('./approvals.service');

const sricDecision = async (req, res, next) => {
  try {
    const { action, remarks, itemBudgetHeads } = req.body;
    const result = await service.sricDecision(req.params.id, req.user.id, action, remarks, itemBudgetHeads);
    res.json(result);
  } catch (err) { next(err); }
};

const deanDecision = async (req, res, next) => {
  try {
    const { action, remarks } = req.body;
    const result = await service.deanDecision(req.params.id, req.user.id, action, remarks);
    res.json(result);
  } catch (err) { next(err); }
};

module.exports = { sricDecision, deanDecision };