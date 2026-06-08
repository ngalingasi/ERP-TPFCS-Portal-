/**
 * erp.route.js  —  routes/v1/erp.route.js
 *
 * ERP portal internal route for ICDV Management.
 *
 * Add to ICDV Management:    routes/v1/erp.route.js
 * Add to Project Management: src/routes/v1/erp.route.js
 *
 * Then in routes/v1/index.js add:
 *   router.use('/erp', require('./erp.route'));
 */

const express   = require('express');
const router    = express.Router();
const erpSecret = require('../../middlewares/erpSecret');
const ctrl      = require('../../controllers/erp.controller');

router.use(erpSecret);

router.post('/lookup-user', ctrl.lookupUser);

module.exports = router;
