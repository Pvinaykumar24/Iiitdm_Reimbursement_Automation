const router = require('express').Router();
const { verifyToken } = require('../../middleware/auth');
const { getMyNotifications, markRead } = require('./notifications.service');

router.use(verifyToken);

router.get('/', async (req, res, next) => {
  try {
    const notifs = await getMyNotifications(req.user.id);
    res.json(notifs);
  } catch (err) { next(err); }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    await markRead(req.params.id, req.user.id);
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
});

module.exports = router;