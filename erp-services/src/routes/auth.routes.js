const express  = require('express');
const router   = express.Router();
const Joi      = require('joi');
const validate = require('../middlewares/validate');
const ctrl     = require('../controllers/auth.controller');

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

// OTP 3-step flow (proxied to default system)
router.post('/validate-credentials', validate(credentialsSchema), ctrl.validateCredentials);
router.post('/send-otp',             validate(sendOtpSchema),     ctrl.sendOtp);
router.post('/verify-otp',           validate(verifyOtpSchema),   ctrl.verifyOtp);

// Direct login (for must_change_password short-circuit or non-OTP systems)
router.post('/login', validate(credentialsSchema), ctrl.directLogin);

module.exports = router;
