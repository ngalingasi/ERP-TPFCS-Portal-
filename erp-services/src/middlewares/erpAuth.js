/**
 * erpAuth middleware
 *
 * Protects ERP admin routes (profile management).
 * Verifies the short-lived JWT that the ERP portal itself issues after
 * a successful login — completely separate from child system tokens.
 *
 * The token payload carries:
 *   { sub: user_id, role, systemId, email, iat, exp, type: 'erp_access' }
 */

const jwt        = require('jsonwebtoken');
const httpStatus = require('http-status');
const config     = require('../config/config');
const ApiError   = require('../utils/ApiError');

const ERP_SUPER_ADMIN_ROLES = ['super_admin'];

const erpAuth = (...requiredRoles) => (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
    }

    const token   = authHeader.slice(7);
    const payload = jwt.verify(token, config.jwt.secret);

    if (payload.type !== 'erp_access') {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token type');
    }

    req.erpUser = payload;

    if (requiredRoles.length) {
      const hasRole = requiredRoles.includes(payload.role);
      if (!hasRole) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions');
      }
    }

    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
  }
};

const isSuperAdmin = (req) =>
  ERP_SUPER_ADMIN_ROLES.includes(req.erpUser?.role);

module.exports = erpAuth;
module.exports.isSuperAdmin = isSuperAdmin;
