/**
 * erp.route.js  —  src/routes/v1/erp.route.js
 *
 * ERP portal internal route for Project Management System.
 * Protected by x-erp-secret header — not for normal users.
 *
 * Add to Project Management: src/routes/v1/erp.route.js
 *
 * Then in src/routes/v1/index.js add these two lines:
 *
 *   const erpRoute = require('./erp.route');
 *   // inside defaultRoutes array:
 *   { path: '/erp', route: erpRoute },
 */

const express   = require('express');
const router    = express.Router();
const erpSecret = require('../../middlewares/erpSecret');
const ctrl      = require('../../controllers/erp.controller');

// All routes protected by ERP secret
router.use(erpSecret);

// POST /api/v1/erp/lookup-user
// ERP portal checks if a user (by email) exists in this system
// and returns fresh tokens if found.
router.post('/lookup-user', ctrl.lookupUser);

module.exports = router;
