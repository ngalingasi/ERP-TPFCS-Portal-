/**
 * erpCtrl.js  —  Controllers/erpCtrl.js
 *
 * ERP portal user-lookup endpoint for the Management System.
 * Uses the same legacy callback-based DB pattern as the rest of the Management System.
 *
 * Add to Management System: Controllers/erpCtrl.js
 */

const JWT = require('jsonwebtoken');
const { getUserByEmailAddress } = require('../Models/userModel');

const JWT_SECRET      = 'tpa_sys_tool'; // matches existing Management System secret
const TOKEN_EXPIRE_S  = 60 * 60;        // 1 hour

const ERP_SECRET = process.env.ERP_SECRET;

// Middleware: validate x-erp-secret header
const erpSecretMiddleware = (req, res, next) => {
  if (!ERP_SECRET) {
    return res.status(500).json({ status: false, message: 'ERP_SECRET not configured' });
  }
  if (req.headers['x-erp-secret'] !== ERP_SECRET) {
    return res.status(401).json({ status: false, message: 'Unauthorized' });
  }
  next();
};

// POST /api/erp/lookup-user
const lookupUser = (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ status: false, message: 'email is required' });
  }

  getUserByEmailAddress({ email }, (user) => {
    if (!user || user.length === 0) {
      return res.status(404).json({
        status:  false,
        message: 'User not found in this system',
      });
    }

    const u = user[0];

    const token = JWT.sign(
      { userid: u.id, email: u.email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRE_S }
    );

    return res.status(200).json({
      status:  true,
      message: 'User found',
      user: {
        user_id:    u.id,
        full_name:  `${u.fname} ${u.mname || ''} ${u.lname}`.trim(),
        email:      u.email,
        mobile:     u.mobile || null,
        gender:     u.gender || null,
        avatar:     u.image  || null,
        role:       u.role_name || null,
        role_id:    u.role_id   || null,
        status:     'active',
        must_change_password: u.changepassword === 1,
      },
      // Management System uses a simple token (not access/refresh pair)
      // We wrap it in the same shape so the ERP portal handles it uniformly
      tokens: {
        access: {
          token,
          expires: new Date(Date.now() + TOKEN_EXPIRE_S * 1000),
        },
        refresh: null,
      },
    });
  });
};

module.exports = { erpSecretMiddleware, lookupUser };
