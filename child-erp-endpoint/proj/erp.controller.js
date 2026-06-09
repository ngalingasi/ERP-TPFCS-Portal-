/**
 * erp.controller.js  —  src/controllers/erp.controller.js
 *
 * ERP portal user-lookup endpoint for Project Management System.
 * Protected by x-erp-secret middleware — not accessible by normal users.
 *
 * Add to Project Management: src/controllers/erp.controller.js
 */

const httpStatus    = require('http-status');
const catchAsync    = require('../utils/catchAsync');
const { query }     = require('../config/database');
const tokenModel    = require('../models/token.model');

// Safe fields — matches what the normal auth controller returns
const SAFE_FIELDS = [
  'user_id', 'full_name', 'username', 'email',
  'mobile', 'gender', 'avatar', 'role',
  'status', 'must_change_password',
];

const sanitizeUser = (user) =>
  SAFE_FIELDS.reduce((obj, key) => {
    obj[key] = user[key] !== undefined ? user[key] : null;
    return obj;
  }, {});

const lookupUser = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status:  false,
      message: 'email is required',
    });
  }

  const rows = await query(
    `SELECT * FROM users WHERE email = ? AND status = 'active' LIMIT 1`,
    [email]
  );

  if (!rows.length) {
    return res.status(httpStatus.NOT_FOUND).json({
      status:  false,
      message: 'User not found in this system',
    });
  }

  const user   = rows[0];
  const tokens = await tokenModel.generateAuthTokens(user);

  return res.status(httpStatus.OK).json({
    status:  true,
    message: 'User found',
    user:    sanitizeUser(user),
    tokens,
  });
});

module.exports = { lookupUser };
