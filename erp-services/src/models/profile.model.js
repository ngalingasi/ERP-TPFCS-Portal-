const { query, transaction, connQuery } = require('../config/database');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

// ── Read ──────────────────────────────────────────────────────────────────────

const findAll = async ({ activeOnly = true } = {}) => {
  const where = activeOnly ? 'WHERE is_active = 1' : '';
  return query(
    `SELECT id, name, description, api_base_url, app_url, icon,
            is_default, is_active, sort_order, created_by, created_at, updated_at
     FROM software_profiles ${where}
     ORDER BY sort_order ASC, id ASC`
  );
};

const findById = async (id) => {
  const rows = await query(
    `SELECT * FROM software_profiles WHERE id = ?`,
    [id]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Profile not found');
  return rows[0];
};

// Returns the full row (including erp_secret) for the default system
const findDefault = async () => {
  const rows = await query(
    `SELECT * FROM software_profiles WHERE is_default = 1 AND is_active = 1 LIMIT 1`
  );
  if (!rows.length) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'No default authentication system configured. Please set one in software_profiles.'
    );
  }
  return rows[0];
};

// Returns all active non-default profiles (for the lookup-user fan-out)
const findAllActive = async () => {
  return query(
    `SELECT * FROM software_profiles WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`
  );
};

// ── Write ─────────────────────────────────────────────────────────────────────

const create = async (body, createdBy = null) => {
  const {
    name, description = null, api_base_url, app_url,
    icon = '🖥️', erp_secret, is_default = 0, is_active = 1, sort_order = 0,
  } = body;

  const existing = await query(
    `SELECT id FROM software_profiles WHERE name = ?`, [name]
  );
  if (existing.length) {
    throw new ApiError(httpStatus.CONFLICT, 'A profile with this name already exists');
  }

  // If setting as default, unset others first (trigger also does this, belt-and-braces)
  if (is_default) {
    await query(`UPDATE software_profiles SET is_default = 0`);
  }

  const result = await query(
    `INSERT INTO software_profiles
       (name, description, api_base_url, app_url, icon, erp_secret, is_default, is_active, sort_order, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description, api_base_url, app_url, icon, erp_secret,
     is_default ? 1 : 0, is_active ? 1 : 0, sort_order, createdBy]
  );
  return findById(result.insertId);
};

const update = async (id, body) => {
  await findById(id); // throws 404 if not found

  const ALLOWED = [
    'name', 'description', 'api_base_url', 'app_url',
    'icon', 'erp_secret', 'is_active', 'sort_order',
  ];
  const fields = Object.keys(body).filter((k) => ALLOWED.includes(k));
  if (!fields.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields to update');
  }

  const set    = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => body[f]);
  await query(`UPDATE software_profiles SET ${set} WHERE id = ?`, [...values, id]);
  return findById(id);
};

// Setting a new default: atomically unset old, set new
const setDefault = async (id) => {
  await findById(id);
  await transaction(async (conn) => {
    await connQuery(conn, `UPDATE software_profiles SET is_default = 0`);
    await connQuery(conn, `UPDATE software_profiles SET is_default = 1 WHERE id = ?`, [id]);
  });
  return findById(id);
};

const remove = async (id) => {
  const profile = await findById(id);
  if (profile.is_default) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot delete the default authentication system. Set another profile as default first.'
    );
  }
  await query(`DELETE FROM software_profiles WHERE id = ?`, [id]);
};

// Safe public view — never exposes erp_secret
const sanitize = (p) => ({
  id:          p.id,
  name:        p.name,
  description: p.description,
  api_base_url: p.api_base_url,
  app_url:     p.app_url,
  icon:        p.icon,
  is_default:  !!p.is_default,
  is_active:   !!p.is_active,
  sort_order:  p.sort_order,
  created_by:  p.created_by,
  created_at:  p.created_at,
  updated_at:  p.updated_at,
});

module.exports = {
  findAll, findById, findDefault, findAllActive,
  create, update, setDefault, remove,
  sanitize,
};
