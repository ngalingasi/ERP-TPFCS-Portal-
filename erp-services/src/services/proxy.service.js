/**
 * proxy.service.js
 *
 * Handles all outbound HTTP calls from ERP to child systems.
 *
 * api_base_url in software_profiles includes the full API base path:
 *   e.g. "http://localhost:3001/api/v1"  (URA, ICDV, Project Management)
 *        "http://localhost:8686/api"      (Management System — no /v1)
 *
 * The proxy only appends the specific endpoint — never hardcodes /api/v1.
 */

const axios        = require('axios');
const httpStatus   = require('http-status');
const logger       = require('../config/logger');
const profileModel = require('../models/profile.model');
const ApiError     = require('../utils/ApiError');

// ── Axios factory ─────────────────────────────────────────────────────────────

const makeClient = (baseURL, secret, timeoutMs = 8000) =>
  axios.create({
    baseURL,
    timeout: timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'x-erp-secret': secret,
    },
  });

// ── Upstream error helper ─────────────────────────────────────────────────────
// Converts axios errors into clean ApiErrors so the ERP error handler
// returns a proper JSON response instead of a raw 500.

const handleUpstreamError = (err, systemName) => {
  if (err.response) {
    // Upstream responded with an error status — forward it as-is
    const status  = err.response.status;
    const message = err.response.data?.message || err.response.statusText || 'Upstream error';
    throw new ApiError(status, message);
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    logger.error(`ERP proxy — cannot reach "${systemName}" [${err.config?.baseURL}]: ${err.code}`);
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      `Cannot reach ${systemName}. Please ensure the system is running.`
    );
  }

  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
    throw new ApiError(
      httpStatus.GATEWAY_TIMEOUT,
      `${systemName} did not respond in time. Please try again.`
    );
  }

  // Unknown error — log and re-throw as 500
  logger.error(`ERP proxy unexpected error for "${systemName}":`, err.message);
  throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'An unexpected error occurred.');
};

// ── Auth proxy helpers ────────────────────────────────────────────────────────

const validateCredentials = async (profile, login, password) => {
  try {
    const client = makeClient(profile.api_base_url, profile.erp_secret);
    const { data } = await client.post('/auth/validate-credentials', { login, password });
    return data;
  } catch (err) {
    if (err.isOperational) throw err; // already an ApiError
    handleUpstreamError(err, profile.name);
  }
};

const sendOtp = async (profile, login, channel) => {
  try {
    const client = makeClient(profile.api_base_url, profile.erp_secret);
    const { data } = await client.post('/auth/send-otp', { login, channel });
    return data;
  } catch (err) {
    if (err.isOperational) throw err;
    handleUpstreamError(err, profile.name);
  }
};

const verifyOtp = async (profile, login, otp) => {
  try {
    const client = makeClient(profile.api_base_url, profile.erp_secret);
    const { data } = await client.post('/auth/verify-otp', { login, otp });
    return data;
  } catch (err) {
    if (err.isOperational) throw err;
    handleUpstreamError(err, profile.name);
  }
};

const directLogin = async (profile, login, password) => {
  try {
    const client = makeClient(profile.api_base_url, profile.erp_secret);
    const { data } = await client.post('/auth/login', { login, password });
    return data;
  } catch (err) {
    if (err.isOperational) throw err;
    handleUpstreamError(err, profile.name);
  }
};

// ── User lookup fan-out ───────────────────────────────────────────────────────

const lookupUserInAllSystems = async (email, defaultProfile, defaultAuthResult) => {
  const allProfiles = await profileModel.findAllActive();

  const results = await Promise.allSettled(
    allProfiles.map(async (profile) => {
      // Default system — already have result, skip network call
      if (profile.id === defaultProfile.id) {
        return {
          profile: profileModel.sanitize(profile),
          user:    defaultAuthResult.user,
          tokens:  defaultAuthResult.tokens,
        };
      }

      try {
        const client = makeClient(profile.api_base_url, profile.erp_secret, 6000);
        const { data } = await client.post('/erp/lookup-user', { email });

        if (!data || !data.user) return null;

        return {
          profile: profileModel.sanitize(profile),
          user:    data.user,
          tokens:  data.tokens,
        };
      } catch (err) {
        if (err.response?.status === 404) return null; // user not in this system — expected

        logger.warn(
          `ERP lookup failed for "${profile.name}" [${profile.api_base_url}]: ` +
          (err.response?.data?.message || err.message)
        );
        return null; // don't block the whole flow if one system is down
      }
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);
};

module.exports = {
  validateCredentials,
  sendOtp,
  verifyOtp,
  directLogin,
  lookupUserInAllSystems,
};
