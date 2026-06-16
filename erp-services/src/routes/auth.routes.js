const express  = require('express');
const router   = express.Router();
const Joi      = require('joi');
const validate = require('../middlewares/validate');
const ctrl     = require('../controllers/auth.controller');
const erpAuth  = require('../middlewares/erpAuth');

const credentialsSchema = {
  body: Joi.object().keys({
    login:    Joi.string().required(),
    password: Joi.string().required(),
  }),
};

const sendOtpSchema = {
  body: Joi.object().keys({
    login:   Joi.string().required(),
    channel: Joi.string().valid('email', 'sms').required(),
  }),
};

const verifyOtpSchema = {
  body: Joi.object().keys({
    login: Joi.string().required(),
    otp:   Joi.string().length(6).pattern(/^\d{6}$/).required(),
  }),
};

const changePasswordSchema = {
  body: Joi.object().keys({
    login:           Joi.string().required(),
    currentPassword: Joi.string().required(),
    newPassword:     Joi.string().min(8).required(),
  }),
};

// ── Public auth routes (no token required) ────────────────────────────────────
router.post('/validate-credentials', validate(credentialsSchema), ctrl.validateCredentials);
router.post('/send-otp',             validate(sendOtpSchema),     ctrl.sendOtp);
router.post('/verify-otp',           validate(verifyOtpSchema),   ctrl.verifyOtp);
router.post('/login',                validate(credentialsSchema), ctrl.directLogin);

// ── Protected: change password (requires ERP token with must_change_password) ─
router.post('/change-password', erpAuth(), validate(changePasswordSchema), ctrl.changePassword);

module.exports = router;
