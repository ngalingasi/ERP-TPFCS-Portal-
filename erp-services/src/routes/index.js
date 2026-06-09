const express  = require('express');
const router   = express.Router();

router.use('/auth',     require('./auth.routes'));
router.use('/profiles', require('./profile.routes'));
router.use('/health',   require('./health.route'));

module.exports = router;
