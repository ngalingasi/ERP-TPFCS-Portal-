const express  = require('express');
const router   = express.Router();
const catchAsync  = require('../utils/catchAsync');
const erpAuth     = require('../middlewares/erpAuth');
const proxyService = require('../services/proxy.service');

// GET /api/v1/health
// Public — basic ERP service ping
router.get('/', (req, res) => {
  res.json({
    status:      true,
    service:     'ERP Services',
    uptime:      Math.floor(process.uptime()),
    timestamp:   new Date().toISOString(),
  });
});

// GET /api/v1/health/systems
// Protected — admin only — fetches health from all child systems
router.get('/systems', erpAuth(), catchAsync(async (req, res) => {
  const systems = await proxyService.fetchSystemHealth();
  res.json({
    status:    true,
    fetched_at: new Date().toISOString(),
    systems,
  });
}));

module.exports = router;

// GET /api/v1/health/logs?profileId=1&page=1&limit=50&status=error
router.get('/logs', erpAuth(), catchAsync(async (req, res) => {
  const { profileId, ...filters } = req.query;
  if (!profileId) {
    return res.status(400).json({ status: false, message: 'profileId is required' });
  }
  const result = await proxyService.fetchSystemLogs(profileId, filters);
  res.json(result);
}));

// POST /api/v1/health/profile?profileId=1
// Proxies to child system POST /erp/me — returns user profile for ERP ProfilePage
router.post('/profile', erpAuth(), catchAsync(async (req, res) => {
  const { profileId } = req.query;
  const { email }     = req.body;

  if (!profileId) return res.status(400).json({ status: false, message: 'profileId is required' });
  if (!email)     return res.status(400).json({ status: false, message: 'email is required' });

  const result = await proxyService.fetchUserProfile(Number(profileId), email);
  res.json(result);
}));
