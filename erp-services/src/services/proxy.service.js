/**
 * proxy.service.js
 *
 * Handles all outbound HTTP calls from ERP to child systems:
 *   1. Auth proxy  — forwards credential/OTP steps to the default system
 *   2. Lookup fan-out — queries every active profile's /erp/lookup-user endpoint
 */

const axios   = require('axios');
const logger  = require('../config/logger');
const profileModel = require('../models/profile.model');

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

// ── Auth proxy helpers ─────────────────────────────────────────────────────────
// All functions receive the full defaultProfile row so the caller controls
// which profile is used (avoids an extra DB round-trip per step).

const validateCredentials = async (profile, login, password) => {
  const client = makeClient(profile.api_base_url, profile.erp_secret);
  const { data } = await client.post('/api/v1/auth/validate-credentials', { login, password });
  return data;
};

const sendOtp = async (profile, login, channel) => {
  const client = makeClient(profile.api_base_url, profile.erp_secret);
  const { data } = await client.post('/api/v1/auth/send-otp', { login, channel });
  return data;
};

const verifyOtp = async (profile, login, otp) => {
  const client = makeClient(profile.api_base_url, profile.erp_secret);
  const { data } = await client.post('/api/v1/auth/verify-otp', { login, otp });
  return data;
};

// Direct login (used when must_change_password is true — skips OTP)
const directLogin = async (profile, login, password) => {
  const client = makeClient(profile.api_base_url, profile.erp_secret);
  const { data } = await client.post('/api/v1/auth/login', { login, password });
  return data;
};

// ── User lookup fan-out ───────────────────────────────────────────────────────

/**
 * lookupUserInAllSystems
 *
 * Given a verified email (from the default system's auth response),
 * queries every active software profile's ERP lookup endpoint in parallel.
 *
 * The default system result is passed in directly (already authenticated) so
 * we don't make a redundant network call to it.
 *
 * Returns an array of matched systems:
 *   [{ profile: sanitizedProfile, user, tokens }, ...]
 */
const lookupUserInAllSystems = async (email, defaultProfile, defaultAuthResult) => {
  const allProfiles = await profileModel.findAllActive();

  const results = await Promise.allSettled(
    allProfiles.map(async (profile) => {
      // For the default system we already have the auth result — use it directly
      if (profile.id === defaultProfile.id) {
        return {
          profile: profileModel.sanitize(profile),
          user:   defaultAuthResult.user,
          tokens: defaultAuthResult.tokens,
        };
      }

      // For all other systems call their /erp/lookup-user endpoint
      try {
        const client = makeClient(profile.api_base_url, profile.erp_secret, 6000);
        const { data } = await client.post('/api/v1/erp/lookup-user', { email });

        if (!data || !data.user) return null;

        return {
          profile: profileModel.sanitize(profile),
          user:   data.user,
          tokens: data.tokens,
        };
      } catch (err) {
        // 404 = user not found in that system — expected, not an error
        if (err.response?.status === 404) return null;

        logger.warn(
          `ERP lookup failed for profile "${profile.name}" [${profile.api_base_url}]: ` +
          (err.response?.data?.message || err.message)
        );
        return null;
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
