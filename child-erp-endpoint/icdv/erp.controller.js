/**
 * erp.controller.js  —  controllers/erp.controller.js
 *
 * ERP portal user-lookup endpoint for ICDV Management System.
 * Protected by x-erp-secret middleware.
 *
 * Add to ICDV Management: controllers/erp.controller.js
 * (Same file works for Project Management — just copy to src/controllers/erp.controller.js)
 */

const httpStatus   = require('http-status');
const catchAsync   = require('../utils/catchAsync');
const { query }    = require('../config/database');
const tokenModel   = require('../models/token.model');

// Safe fields to return — matches what ICDV auth controller returns
const SAFE_USER_FIELDS = [
  'user_id', 'full_name', 'username', 'email',
  'mobile', 'gender', 'avatar', 'role',
  'icdv_id', 'icdv_name',
  'status', 'must_change_password',
];

const sanitizeUser = (user) =>
  SAFE_USER_FIELDS.reduce((obj, key) => {
    obj[key] = user[key] !== undefined ? user[key] : null;
    return obj;
  }, {});

// Enrich with icdv_name (ICDV system only — safe to call even if column missing)
const enrichUser = async (user) => {
  const icdvId = user.icdv_id ?? null;
  if (icdvId) {
    try {
      const rows = await query('SELECT name FROM icdvs WHERE icdv_id = ?', [icdvId]);
      user.icdv_name = rows.length ? rows[0].name : null;
    } catch {
      user.icdv_name = null;
    }
  } else {
    user.icdv_name = null;
  }
  return user;
};

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

  const user = rows[0];
  await enrichUser(user);

  const tokens = await tokenModel.generateAuthTokens(user);

  res.status(httpStatus.OK).json({
    status:  true,
    message: 'User found',
    user:    sanitizeUser(user),
    tokens,
  });
});

module.exports = { lookupUser };
