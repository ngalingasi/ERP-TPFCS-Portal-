/**
 * profile.controller.js
 *
 * Admin endpoints for managing software profiles.
 * All routes require a valid ERP token with role = super_admin.
 */

const httpStatus   = require('http-status');
const catchAsync   = require('../utils/catchAsync');
const profileModel = require('../models/profile.model');

// GET /api/v1/profiles  — list all profiles (no secrets exposed)
const list = catchAsync(async (req, res) => {
  const activeOnly = req.query.active !== 'false';
  const profiles   = await profileModel.findAll({ activeOnly });
  res.json({
    status:  true,
    results: profiles.length,
    data:    profiles.map(profileModel.sanitize),
  });
});

// GET /api/v1/profiles/:id
const get = catchAsync(async (req, res) => {
  const profile = await profileModel.findById(req.params.id);
  res.json({ status: true, data: profileModel.sanitize(profile) });
});

// POST /api/v1/profiles
const create = catchAsync(async (req, res) => {
  const profile = await profileModel.create(req.body, req.erpUser?.sub ?? null);
  res.status(httpStatus.CREATED).json({
    status:  true,
    message: 'Profile created',
    data:    profileModel.sanitize(profile),
  });
});

// PATCH /api/v1/profiles/:id
const update = catchAsync(async (req, res) => {
  const profile = await profileModel.update(req.params.id, req.body);
  res.json({
    status:  true,
    message: 'Profile updated',
    data:    profileModel.sanitize(profile),
  });
});

// PATCH /api/v1/profiles/:id/set-default
const setDefault = catchAsync(async (req, res) => {
  const profile = await profileModel.setDefault(req.params.id);
  res.json({
    status:  true,
    message: `"${profile.name}" is now the default authentication system`,
    data:    profileModel.sanitize(profile),
  });
});

// DELETE /api/v1/profiles/:id
const remove = catchAsync(async (req, res) => {
  await profileModel.remove(req.params.id);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { list, get, create, update, setDefault, remove };
