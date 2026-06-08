/**
 * erpRt.js  —  Routes/erpRt.js
 *
 * ERP portal internal route for the Management System.
 *
 * Add to Management System: Routes/erpRt.js
 *
 * Then in server.js add:
 *   const erpRoutes = require('./Routes/erpRt');
 *   App.use('/api/erp', erpRoutes);
 */

const Express = require('express');
const Router  = Express.Router();
const { erpSecretMiddleware, lookupUser } = require('../Controllers/erpCtrl');

// All routes protected by ERP secret
Router.use(erpSecretMiddleware);

Router.post('/lookup-user', lookupUser);

module.exports = Router;
