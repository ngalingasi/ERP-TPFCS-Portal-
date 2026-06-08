const express  = require('express');
const router   = express.Router();
const Joi      = require('joi');
const validate = require('../middlewares/validate');
const erpAuth  = require('../middlewares/erpAuth');
const ctrl     = require('../controllers/profile.controller');

const createSchema = {
  body: Joi.object().keys({
    name:        Joi.string().max(120).required(),
    description: Joi.string().max(255).allow('', null),
    api_base_url: Joi.string().uri().required(),
    app_url:     Joi.string().uri().required(),
    icon:        Joi.string().max(80).default('🖥️'),
    erp_secret:  Joi.string().min(16).required(),
    is_default:  Joi.boolean().default(false),
    is_active:   Joi.boolean().default(true),
    sort_order:  Joi.number().integer().default(0),
  }),
};

const updateSchema = {
  body: Joi.object().keys({
    name:        Joi.string().max(120),
    description: Joi.string().max(255).allow('', null),
    api_base_url: Joi.string().uri(),
    app_url:     Joi.string().uri(),
    icon:        Joi.string().max(80),
    erp_secret:  Joi.string().min(16),
    is_active:   Joi.boolean(),
    sort_order:  Joi.number().integer(),
  }),
};

// All profile routes require a valid ERP token with super_admin role
router.use(erpAuth('super_admin'));

router.get('/',                         ctrl.list);
router.get('/:id',                      ctrl.get);
router.post('/',    validate(createSchema), ctrl.create);
router.patch('/:id', validate(updateSchema), ctrl.update);
router.patch('/:id/set-default',        ctrl.setDefault);
router.delete('/:id',                   ctrl.remove);

module.exports = router;
