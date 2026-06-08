/**
 * auth.controller.js
 *
 * Handles the ERP unified login flow:
 *  Step 1  POST /api/v1/auth/validate-credentials
 *  Step 2  POST /api/v1/auth/send-otp
 *  Step 3  POST /api/v1/auth/verify-otp       ← fan-out happens here
 *
 * Also exposes a direct login path for systems that don't use OTP.
 *
 * After successful authentication against the default system,
 * we fan out to all other active profiles using their /erp/lookup-user
 * endpoint and return the list of matched systems to the frontend.
 */

const httpStatus   = require('http-status');
const catchAsync   = require('../utils/catchAsync');
const profileModel = require('../models/profile.model');
const proxyService = require('../services/proxy.service');
const jwt          = require('jsonwebtoken');
const config       = require('../config/config');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Issue a short-lived ERP portal JWT so the frontend can call admin routes.
 * This is separate from the child-system tokens.
 */
const issueErpToken = (user, systemId) => {
  const payload = {
    sub:      user.user_id,
    email:    user.email,
    role:     user.role,
    systemId, // which profile this user authenticated against
    type:     'erp_access',
  };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: `${config.jwt.accessExpirationMinutes}m`,
  });
};

// ── Step 1: Validate credentials ──────────────────────────────────────────────
const validateCredentials = catchAsync(async (req, res) => {
  const { login, password } = req.body;

  const defaultProfile = await profileModel.findDefault();
  const result = await proxyService.validateCredentials(defaultProfile, login, password);

  // Proxy the response as-is — includes { status, channels } or { must_change_password }
  res.status(httpStatus.OK).json(result);
});

// ── Step 2: Send OTP ──────────────────────────────────────────────────────────
const sendOtp = catchAsync(async (req, res) => {
  const { login, channel } = req.body;

  const defaultProfile = await profileModel.findDefault();
  const result = await proxyService.sendOtp(defaultProfile, login, channel);

  res.status(httpStatus.OK).json(result);
});

// ── Step 3: Verify OTP → fan-out → return matched systems ─────────────────────
const verifyOtp = catchAsync(async (req, res) => {
  const { login, otp } = req.body;

  const defaultProfile = await profileModel.findDefault();

  // Authenticate against the default system
  const authResult = await proxyService.verifyOtp(defaultProfile, login, otp);

  if (!authResult.user?.email) {
    return res.status(httpStatus.UNAUTHORIZED).json({
      status:  false,
      message: 'Authentication failed — no user email returned from default system',
    });
  }

  const email = authResult.user.email;

  // Fan-out: look up this email in every active profile
  const matchedSystems = await proxyService.lookupUserInAllSystems(
    email, defaultProfile, authResult
  );

  // Issue an ERP portal token (for admin routes)
  const erpToken = issueErpToken(authResult.user, defaultProfile.id);

  res.status(httpStatus.OK).json({
    status:        true,
    message:       'Authentication successful',
    erpToken,                    // portal admin token
    matchedSystems,              // [{ profile, user, tokens }, ...]
    totalMatches:  matchedSystems.length,
  });
});

// ── Direct login (for systems without OTP, e.g. Management System) ────────────
// Also used when must_change_password = true (OTP step 1 short-circuits here)
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

  const email = authResult.user.email;
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

module.exports = { validateCredentials, sendOtp, verifyOtp, directLogin };
