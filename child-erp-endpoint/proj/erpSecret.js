/**
 * erpSecret.js  —  src/middlewares/erpSecret.js
 *
 * Validates the x-erp-secret header on all /erp/* routes.
 * Only the ERP portal knows this secret — stored in .env as ERP_SECRET.
 *
 * Add to Project Management: src/middlewares/erpSecret.js
 */

const httpStatus = require('http-status');

const erpSecret = (req, res, next) => {
  const secret = process.env.ERP_SECRET;

  if (!secret) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status:  false,
      message: 'ERP_SECRET not configured on this server',
    });
  }

  const provided = req.headers['x-erp-secret'];

  if (!provided || provided !== secret) {
    return res.status(httpStatus.UNAUTHORIZED).json({
      status:  false,
      message: 'Unauthorized',
    });
  }

  next();
};

module.exports = erpSecret;
