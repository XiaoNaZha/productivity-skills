require('dotenv').config();

module.exports = {
  PORT: parseInt(process.env.PORT) || 3002,

  // Heartbeat: how often (ms) to check if stored sessions are still alive
  HEARTBEAT_INTERVAL: parseInt(process.env.HEARTBEAT_INTERVAL) || 5 * 60 * 1000, // 5 min

  // Timeout for each heartbeat HTTP request
  HEARTBEAT_TIMEOUT: parseInt(process.env.HEARTBEAT_TIMEOUT) || 10000, // 10s

  // File path for session persistence (survives restarts)
  SESSIONS_FILE: process.env.SESSIONS_FILE || './sessions.json',

  // Initial proxy pool — populate via API or env var
  // PROXIES env: comma-separated, e.g. "http://u:p@h1:8080,http://u:p@h2:8080"
  INITIAL_PROXIES: process.env.PROXIES
    ? process.env.PROXIES.split(',').map((p) => p.trim()).filter(Boolean)
    : [],

  // Maximum proxies allowed in the pool
  MAX_PROXIES: parseInt(process.env.MAX_PROXIES) || 100,

  // Maximum sessions allowed
  MAX_SESSIONS: parseInt(process.env.MAX_SESSIONS) || 50,
};
