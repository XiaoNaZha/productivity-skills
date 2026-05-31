require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  API_KEY: process.env.API_KEY || '',
  TIMEOUT: parseInt(process.env.TIMEOUT) || 30000,
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
};
