/**
 * erp.routes.js  —  src/routes/erp.routes.js
 *
 * ERP portal internal routes — protected by x-erp-secret header only.
 * NOT accessible by normal users or JWT tokens.
 *
 * Add to URA Security System: src/routes/erp.routes.js
 *
 * Then in src/routes/index.js add:
 *   router.use('/erp', require('./erp.routes'));
 */

const express   = require('express');
const router    = express.Router();
const erpSecret = require('../middlewares/erpSecret');
const ctrl      = require('../controllers/erp.controller');

// All routes in this file are protected by ERP secret
router.use(erpSecret);

// POST /api/v1/erp/lookup-user
// ERP portal uses this to check if a user (identified by email) exists in this system
// and to get fresh tokens for them if found.
router.post('/lookup-user', ctrl.lookupUser);

module.exports = router;
