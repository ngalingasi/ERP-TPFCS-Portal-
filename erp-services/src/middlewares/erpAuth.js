/**
 * erpAuth middleware
 *
 * Protects ERP admin routes (profile management).
 * Verifies the short-lived JWT that the ERP portal itself issues after
 * a successful login — completely separate from child system tokens.
 *
 * Token payload:
 *   { sub, role, systemId, email, iat, exp, type: 'erp_access', must_change_password? }
 *
 * Tokens with must_change_password: true are ONLY valid for /auth/change-password.
 * All other routes reject them.
 */

const jwt        = require('jsonwebtoken');
const httpStatus = require('http-status');
const config     = require('../config/config');
const ApiError   = require('../utils/ApiError');

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

    // Tokens with must_change_password flag may ONLY call /auth/change-password
    if (payload.must_change_password && !req.path.includes('change-password')) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You must change your password before continuing.');
    }

    req.erpUser = payload;

    if (requiredRoles.length) {
      if (!requiredRoles.includes(payload.role)) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions');
      }
    }

    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
  }
};

const isSuperAdmin = (req) => req.erpUser?.role === 'super_admin';

module.exports = erpAuth;
module.exports.isSuperAdmin = isSuperAdmin;
