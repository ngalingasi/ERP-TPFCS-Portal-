const Joi     = require('joi');
const httpStatus = require('http-status');
const ApiError   = require('../utils/ApiError');

const validate = (schema) => (req, res, next) => {
  const validSchema = Joi.object(
    Object.fromEntries(
      ['params', 'query', 'body'].filter((k) => schema[k]).map((k) => [k, schema[k]])
    )
  ).options({ allowUnknown: true });

  const { error, value } = validSchema.validate(
    { params: req.params, query: req.query, body: req.body },
    { abortEarly: false }
  );

  if (error) {
    const msg = error.details.map((d) => d.message).join(', ');
    return next(new ApiError(httpStatus.BAD_REQUEST, msg));
  }

  Object.assign(req, value);
  next();
};

module.exports = validate;
