/**
 * proxy.service.js
 *
 * Handles all outbound HTTP calls from ERP to child systems.
 *
 * api_base_url in software_profiles includes the full API base path:
 *   e.g. "http://localhost:3001/api/v1"  (URA, ICDV, Project Management)
 *        "http://localhost:8686/api"      (Management System — no /v1)
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

// ── Upstream error handler ────────────────────────────────────────────────────

const handleUpstreamError = (err, systemName) => {
  if (err.response) {
    const status  = err.response.status;
    const message = err.response.data?.message || err.response.statusText || 'Upstream error';
    throw new ApiError(status, message);
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    logger.error(`ERP proxy — cannot reach "${systemName}" [${err.config?.baseURL}]: ${err.code}`);
    throw new ApiError(httpStatus.BAD_GATEWAY, `Cannot reach ${systemName}. Please ensure the system is running.`);
  }
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
    throw new ApiError(httpStatus.GATEWAY_TIMEOUT, `${systemName} did not respond in time. Please try again.`);
  }
  logger.error(`ERP proxy unexpected error for "${systemName}":`, err.message);
  throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'An unexpected error occurred.');
};

// ── Normalise child system response ──────────────────────────────────────────
// Each child system returns slightly different shapes.
// This ensures the ERP portal always works with a consistent structure.

const normaliseUser = (user) => {
  if (!user) return user;
  return {
    ...user,
    // Management system uses role_name instead of role
    role: user.role || user.role_name || 'user',
    // Ensure boolean
    must_change_password: user.must_change_password === true || user.must_change_password === 1 ? 1 : 0,
  };
};

const normaliseTokens = (tokens) => {
  if (!tokens) return { access: null, refresh: null };

  // Standard shape: { access: { token, expires }, refresh: { token, expires } }
  if (tokens.access?.token) return tokens;

  // Management System returns a raw token string (legacy)
  if (typeof tokens === 'string') {
    return {
      access:  { token: tokens, expires: null },
      refresh: null,
    };
  }

  // access is a raw string (not wrapped)
  if (typeof tokens.access === 'string') {
    return {
      access:  { token: tokens.access, expires: null },
      refresh: tokens.refresh ?? null,
    };
  }

  return tokens;
};

const normaliseAuthResult = (data) => ({
  ...data,
  user:   normaliseUser(data.user),
  tokens: normaliseTokens(data.tokens),
});

// ── Auth proxy helpers ────────────────────────────────────────────────────────

const validateCredentials = async (profile, login, password) => {
  try {
    const client = makeClient(profile.api_base_url, profile.erp_secret);
    const { data } = await client.post('/auth/validate-credentials', { login, password });
    return data;
  } catch (err) {
    if (err.isOperational) throw err;
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
    return normaliseAuthResult(data);
  } catch (err) {
    if (err.isOperational) throw err;
    handleUpstreamError(err, profile.name);
  }
};

const directLogin = async (profile, login, password) => {
  try {
    const client = makeClient(profile.api_base_url, profile.erp_secret);
    const { data } = await client.post('/auth/login', { login, password });
    return normaliseAuthResult(data);
  } catch (err) {
    if (err.isOperational) throw err;
    handleUpstreamError(err, profile.name);
  }
};

const changePassword = async (profile, user, currentPassword, newPassword) => {
  try {
    // Use the user's own access token to call change-password on the default system
    const client = axios.create({
      baseURL:  profile.api_base_url,
      timeout:  8000,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${user.accessToken}`,
      },
    });
    const { data } = await client.post('/auth/change-password', { currentPassword, newPassword });
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
      // Default system — already authenticated, use result directly
      if (profile.id === defaultProfile.id) {
        return {
          profile: profileModel.sanitize(profile),
          user:    normaliseUser(defaultAuthResult.user),
          tokens:  normaliseTokens(defaultAuthResult.tokens),
        };
      }

      try {
        const client = makeClient(profile.api_base_url, profile.erp_secret, 6000);
        const { data } = await client.post('/erp/lookup-user', { email });

        if (!data?.user) return null;

        return {
          profile: profileModel.sanitize(profile),
          user:    normaliseUser(data.user),
          tokens:  normaliseTokens(data.tokens),
        };
      } catch (err) {
        if (err.response?.status === 404) return null; // user not in this system — expected

        logger.warn(
          `ERP lookup failed for "${profile.name}" [${profile.api_base_url}]: ` +
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
  changePassword,
  lookupUserInAllSystems,
};


// ── Health check fan-out ──────────────────────────────────────────────────────
// Called by the monitoring page. Hits GET /erp/health on every active profile.

const fetchSystemHealth = async () => {
  const allProfiles = await profileModel.findAllActive();

  const results = await Promise.allSettled(
    allProfiles.map(async (profile) => {
      const start = Date.now();
      try {
        const client = makeClient(profile.api_base_url, profile.erp_secret, 5000);
        const { data } = await client.get('/erp/health');
        return {
          profile:       profileModel.sanitize(profile),
          reachable:     true,
          latency_ms:    Date.now() - start,
          ...data,
        };
      } catch (err) {
        return {
          profile:       profileModel.sanitize(profile),
          reachable:     false,
          latency_ms:    Date.now() - start,
          status:        false,
          error:         err.response?.data?.message || err.message,
          db:            { status: 'unknown', latency_ms: null },
          users:         { total: 0, active: 0 },
          errors_last_24h: null,
          uptime_human:  null,
          memory_mb:     null,
        };
      }
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
};

module.exports.fetchSystemHealth = fetchSystemHealth;


// ── Integration logs fan-out ──────────────────────────────────────────────────
// Fetches logs from a specific system (by profile id) with filters

const fetchSystemLogs = async (profileId, filters = {}) => {
  const allProfiles = await profileModel.findAllActive();
  const profile     = allProfiles.find(p => p.id === Number(profileId));
  if (!profile) throw new Error('Profile not found');

  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

  try {
    const client = makeClient(profile.api_base_url, profile.erp_secret, 8000);
    const { data } = await client.get(`/erp/integration-logs?${params.toString()}`);
    return {
      profile: profileModel.sanitize(profile),
      ...data,
    };
  } catch (err) {
    logger.warn(`ERP logs fetch failed for "${profile.name}": ${err.message}`);
    return {
      profile: profileModel.sanitize(profile),
      status:  false,
      total:   0,
      data:    [],
      error:   err.response?.data?.message || err.message,
    };
  }
};

module.exports.fetchSystemLogs = fetchSystemLogs;


// ── Fetch user profile from a specific child system ───────────────────────────
const fetchUserProfile = async (profileId, email) => {
  const allProfiles = await profileModel.findAllActive();
  const profile     = allProfiles.find(p => p.id === Number(profileId));
  if (!profile) throw new Error('Profile not found');

  try {
    const client = makeClient(profile.api_base_url, profile.erp_secret, 6000);
    const { data } = await client.post('/erp/me', { email });

    // Response shape can be:
    //   { status: true, user: { user_id, full_name, ... } }  ← preferred (nested)
    //   { status: true, user_id, full_name, ... }             ← flat (old shape)
    const user = data.user ?? (({ status: _s, message: _m, ...rest }) => rest)(data);

    return { status: true, profile: profileModel.sanitize(profile), user };
  } catch (err) {
    return {
      status:  false,
      profile: profileModel.sanitize(profile),
      user:    null,
      error:   err.response?.data?.message || err.message,
    };
  }
};

module.exports.fetchUserProfile = fetchUserProfile;
