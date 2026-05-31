require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  TIMEOUT: parseInt(process.env.TIMEOUT) || 30000,
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
  HEADLESS: process.env.HEADLESS !== 'false',
  USER_AGENT: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  LAUNCH_OPTIONS: {
    headless: process.env.HEADLESS !== 'false' ? true : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
      '--lang=en-US,en',
    ],
    ignoreHTTPSErrors: true,
    slowMo: 10,
  },
};
