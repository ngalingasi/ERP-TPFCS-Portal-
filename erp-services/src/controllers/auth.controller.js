/**
 * auth.controller.js
 *
 * ERP unified login flow:
 *  Step 1  POST /api/v1/auth/validate-credentials
 *  Step 2  POST /api/v1/auth/send-otp
 *  Step 3  POST /api/v1/auth/verify-otp  ← fan-out happens here
 *
 * must_change_password is handled HERE — user gets a change-password
 * token back and is blocked from accessing any child system until done.
 */

const httpStatus   = require('http-status');
const catchAsync   = require('../utils/catchAsync');
const profileModel = require('../models/profile.model');
const proxyService = require('../services/proxy.service');
const jwt          = require('jsonwebtoken');
const config       = require('../config/config');

// ── Helpers ───────────────────────────────────────────────────────────────────

const issueErpToken = (user, systemId) => {
  return jwt.sign(
    {
      sub:      user.user_id,
      email:    user.email,
      role:     user.role,
      systemId,
      type:     'erp_access',
    },
    config.jwt.secret,
    { expiresIn: `${config.jwt.accessExpirationMinutes}m` }
  );
};

// Issue a short-lived token specifically for the change-password flow.
// The ERP frontend checks for must_change_password and shows a change
// password form before allowing access to any child system.
const issueChangePasswordToken = (user, systemId) => {
  return jwt.sign(
    {
      sub:                  user.user_id,
      email:                user.email,
      role:                 user.role,
      systemId,
      type:                 'erp_access',
      must_change_password: true,
    },
    config.jwt.secret,
    { expiresIn: '30m' }   // short window to complete password change
  );
};

// ── Step 1: Validate credentials ──────────────────────────────────────────────
const validateCredentials = catchAsync(async (req, res) => {
  const { login, password } = req.body;

  const defaultProfile = await profileModel.findDefault();
  const result = await proxyService.validateCredentials(defaultProfile, login, password);

  // must_change_password — ERP intercepts, issues change-password token
  // The frontend will show the change-password form before anything else
  if (result.must_change_password) {
    // Need the user record to issue a token — do a direct login to get it
    try {
      const authResult = await proxyService.directLogin(defaultProfile, login, password);
      if (authResult?.user) {
        const cpToken = issueChangePasswordToken(authResult.user, defaultProfile.id);
        return res.status(httpStatus.OK).json({
          status:               false,
          must_change_password: true,
          message:              'You must change your password before continuing.',
          erpToken:             cpToken,
          user: {
            email:     authResult.user.email,
            full_name: authResult.user.full_name,
          },
        });
      }
    } catch { /* fall through to original response */ }
  }

  res.status(httpStatus.OK).json(result);
});

// ── Step 2: Send OTP ──────────────────────────────────────────────────────────
const sendOtp = catchAsync(async (req, res) => {
  const { login, channel } = req.body;
  const defaultProfile = await profileModel.findDefault();
  const result = await proxyService.sendOtp(defaultProfile, login, channel);
  res.status(httpStatus.OK).json(result);
});

// ── Step 3: Verify OTP → fan-out ──────────────────────────────────────────────
const verifyOtp = catchAsync(async (req, res) => {
  const { login, otp } = req.body;

  const defaultProfile = await profileModel.findDefault();
  const authResult = await proxyService.verifyOtp(defaultProfile, login, otp);

  if (!authResult.user?.email) {
    return res.status(httpStatus.UNAUTHORIZED).json({
      status:  false,
      message: 'Authentication failed — no user email returned from default system',
    });
  }

  // must_change_password check — intercept before fan-out
  if (authResult.user.must_change_password) {
    const cpToken = issueChangePasswordToken(authResult.user, defaultProfile.id);
    return res.status(httpStatus.OK).json({
      status:               true,
      must_change_password: true,
      message:              'You must change your password before continuing.',
      erpToken:             cpToken,
      user: {
        email:     authResult.user.email,
        full_name: authResult.user.full_name,
      },
    });
  }

  const email          = authResult.user.email;
  const matchedSystems = await proxyService.lookupUserInAllSystems(
    email, defaultProfile, authResult
  );
  const erpToken = issueErpToken(authResult.user, defaultProfile.id);

  res.status(httpStatus.OK).json({
    status:       true,
    message:      'Authentication successful',
    erpToken,
    matchedSystems,
    totalMatches: matchedSystems.length,
  });
});

// ── Direct login (no OTP path) ────────────────────────────────────────────────
const directLogin = catchAsync(async (req, res) => {
  const { login, password } = req.body;

  const defaultProfile = await profileModel.findDefault();
  const authResult = await proxyService.directLogin(defaultProfile, login, password);

  if (!authResult.user?.email) {
    return res.status(httpStatus.UNAUTHORIZED).json({
      status:  false,
      message: 'Authentication failed',
    });
  }

  // must_change_password intercept
  if (authResult.user.must_change_password) {
    const cpToken = issueChangePasswordToken(authResult.user, defaultProfile.id);
    return res.status(httpStatus.OK).json({
      status:               true,
      must_change_password: true,
      message:              'You must change your password before continuing.',
      erpToken:             cpToken,
      user: {
        email:     authResult.user.email,
        full_name: authResult.user.full_name,
      },
    });
  }

  const email          = authResult.user.email;
  const matchedSystems = await proxyService.lookupUserInAllSystems(
    email, defaultProfile, authResult
  );
  const erpToken = issueErpToken(authResult.user, defaultProfile.id);

  res.status(httpStatus.OK).json({
    status:       true,
    message:      'Authentication successful',
    erpToken,
    matchedSystems,
    totalMatches: matchedSystems.length,
  });
});

// ── Change password via ERP ───────────────────────────────────────────────────
// The ERP frontend posts here after showing the change-password form.
// We proxy the change to the default system and then do the full fan-out.
const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword, login } = req.body;

  const defaultProfile = await profileModel.findDefault();

  // Proxy change-password to default system
  await proxyService.changePassword(defaultProfile, req.erpUser, currentPassword, newPassword);

  // After successful change, do a fresh direct login to get new tokens
  const authResult = await proxyService.directLogin(defaultProfile, login, newPassword);

  if (!authResult.user?.email) {
    return res.status(httpStatus.UNAUTHORIZED).json({
      status:  false,
      message: 'Password changed but login failed. Please log in again.',
    });
  }

  const email          = authResult.user.email;
  const matchedSystems = await proxyService.lookupUserInAllSystems(
    email, defaultProfile, authResult
  );
  const erpToken = issueErpToken(authResult.user, defaultProfile.id);

  res.status(httpStatus.OK).json({
    status:       true,
    message:      'Password changed successfully.',
    erpToken,
    matchedSystems,
    totalMatches: matchedSystems.length,
  });
});

module.exports = { validateCredentials, sendOtp, verifyOtp, directLogin, changePassword };
