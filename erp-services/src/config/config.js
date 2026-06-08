const dotenv = require('dotenv');
const path   = require('path');
const Joi    = require('joi');

const envPaths = [
  path.join(__dirname, '../../.env'),
  path.join(process.cwd(), '.env'),
];
for (const p of envPaths) {
  const r = dotenv.config({ path: p });
  if (!r.error) break;
}

const schema = Joi.object().keys({
  NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
  PORT:     Joi.number().default(4500),

  DB_HOST:     Joi.string().required(),
  DB_PORT:     Joi.number().default(3306),
  DB_USER:     Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME:     Joi.string().required(),

  JWT_SECRET:                        Joi.string().required(),
  JWT_ACCESS_EXPIRATION_MINUTES:     Joi.number().default(60),
  JWT_REFRESH_EXPIRATION_DAYS:       Joi.number().default(7),
}).unknown();

const { value: env, error } = schema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) throw new Error(`Config validation error: ${error.message}`);

module.exports = {
  env:  env.NODE_ENV,
  port: env.PORT,
  db: {
    host:     env.DB_HOST,
    port:     env.DB_PORT,
    user:     env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  },
  jwt: {
    secret:                    env.JWT_SECRET,
    accessExpirationMinutes:   env.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays:     env.JWT_REFRESH_EXPIRATION_DAYS,
  },
};
