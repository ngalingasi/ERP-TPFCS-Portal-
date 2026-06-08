const express  = require('express');
const router   = express.Router();

router.use('/auth',     require('./auth.routes'));
router.use('/profiles', require('./profile.routes'));

// Health check
router.get('/health', (req, res) => {
  res.json({ status: true, service: 'erp-services', uptime: process.uptime() });
});

module.exports = router;
