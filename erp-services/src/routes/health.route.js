const express = require('express');
const router  = express.Router();
const { ping } = require('../config/database');
const profileModel = require('../models/profile.model');

router.get('/', async (req, res) => {
  const dbOk = await ping();
  let defaultSystem = null;

  if (dbOk) {
    try {
      const p = await profileModel.findDefault();
      defaultSystem = { id: p.id, name: p.name, api_base_url: p.api_base_url };
    } catch { /* no default set */ }
  }

  const status = dbOk ? 200 : 503;
  res.status(status).json({
    status:        dbOk,
    service:       'erp-services',
    uptime:        process.uptime(),
    database:      dbOk ? 'connected' : 'disconnected',
    defaultSystem: defaultSystem || 'none configured',
    timestamp:     new Date().toISOString(),
  });
});

module.exports = router;
