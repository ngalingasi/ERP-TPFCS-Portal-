/**
 * erp.controller.js  —  src/controllers/erp.controller.js
 *
 * Handles the ERP portal's user-lookup request.
 * Only reachable if the x-erp-secret header is valid (enforced by erpSecret middleware).
 *
 * Add to URA Security System: src/controllers/erp.controller.js
 */

const httpStatus     = require('http-status');
const catchAsync     = require('../utils/helpers').catchAsync || require('../utils/catchAsync');
const { query }      = require('../database/db');
const tokenService   = require('../services/token.service');
const authService    = require('../services/auth.service');

const lookupUser = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status:  false,
      message: 'email is required',
    });
  }

  // Find active user by email
  const rows = await query(
    `SELECT user_id, full_name, username, email, mobile, gender, avatar,
            role, status, must_change_password
     FROM users
     WHERE email = ? AND status = 'active'
     LIMIT 1`,
    [email]
  );

  if (!rows.length) {
    return res.status(httpStatus.NOT_FOUND).json({
      status:  false,
      message: 'User not found in this system',
    });
  }

  const user   = rows[0];
  const tokens = await tokenService.generateAuthTokens(user);

  res.status(httpStatus.OK).json({
    status:  true,
    message: 'User found',
    user:    authService.sanitizeUser(user),
    tokens,
  });
});

module.exports = { lookupUser };
