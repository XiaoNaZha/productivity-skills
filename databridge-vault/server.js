const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { VaultManager, VaultError, ERROR_CODES } = require('./vaultManager');
const config = require('./config');

const app = express();
const vault = new VaultManager();

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '100kb' }));

// ─── Health ────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  const pool = vault.proxyPool.status();
  const sessions = vault.sessionVault.listAll();
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    stats: {
      proxies: pool.size,
      sessions: sessions.length,
      sessionsActive: sessions.filter((s) => s.status === 'active').length,
      sessionsExpired: sessions.filter((s) => s.status === 'expired').length,
    },
  });
});

// ─── Proxy Management ──────────────────────────────────────────

/**
 * POST /api/proxy/add
 * Body: { proxy: "http://user:pass@host:port" }
 */
app.post('/api/proxy/add', (req, res) => {
  try {
    const { proxy } = req.body;
    const result = vault.proxyPool.add(proxy);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * DELETE /api/proxy/remove
 * Body: { proxy: "http://..." } or { index: 0 }
 */
app.delete('/api/proxy/remove', (req, res) => {
  try {
    const { proxy, index } = req.body;
    // Support both query params (GET-style) and JSON body
    const qIndex = req.query.index !== undefined ? parseInt(req.query.index) : undefined;
    const identifier = index !== undefined ? index : (qIndex !== undefined ? qIndex : proxy);
    if (identifier === undefined) {
      throw new VaultError('Either "proxy" or "index" is required (body or query param)', ERROR_CODES.INVALID_INPUT, 400);
    }
    const removed = vault.proxyPool.remove(identifier);
    if (removed === null) {
      return res.status(404).json({ success: false, error: { message: 'Proxy not found', code: 'NOT_FOUND' } });
    }
    res.json({ success: true, data: { removed, poolSize: vault.proxyPool.proxies.length } });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * GET /api/proxy/list
 */
app.get('/api/proxy/list', (req, res) => {
  const status = vault.proxyPool.status();
  res.json({ success: true, data: status });
});

// ─── Session Management ────────────────────────────────────────

/**
 * POST /api/session/inject
 * Body: { domain, cookies, keepAliveUrl }
 */
app.post('/api/session/inject', async (req, res) => {
  try {
    const { domain, cookies, keepAliveUrl } = req.body;
    const result = vault.sessionVault.inject({ domain, cookies, keepAliveUrl });

    // After injection, immediately check the session
    const session = vault.sessionVault.get(result.domain);
    res.status(result.injected === true ? 201 : 200).json({
      success: true,
      data: { ...result, session },
    });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * GET /api/session/list
 * Returns all sessions with their current status.
 */
app.get('/api/session/list', (req, res) => {
  const sessions = vault.sessionVault.listAll();
  res.json({ success: true, data: sessions });
});

/**
 * GET /api/session/status?domain=example.com
 */
app.get('/api/session/status', (req, res) => {
  const { domain } = req.query;
  if (!domain) {
    return res.status(400).json({
      success: false,
      error: { message: 'Query parameter "domain" is required', code: ERROR_CODES.INVALID_INPUT },
    });
  }
  const session = vault.sessionVault.get(domain);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: { message: `No session for domain "${domain}"`, code: ERROR_CODES.SESSION_NOT_FOUND },
    });
  }
  res.json({ success: true, data: session });
});

/**
 * DELETE /api/session/remove
 * Body: { domain: "example.com" }
 */
app.delete('/api/session/remove', (req, res) => {
  const { domain } = req.body;
  if (!domain) {
    return res.status(400).json({
      success: false,
      error: { message: '"domain" is required', code: ERROR_CODES.INVALID_INPUT },
    });
  }
  const removed = vault.sessionVault.remove(domain);
  if (!removed) {
    return res.status(404).json({
      success: false,
      error: { message: `No session for domain "${domain}"`, code: ERROR_CODES.SESSION_NOT_FOUND },
    });
  }
  res.json({ success: true, data: { removed: domain } });
});

/**
 * POST /api/session/heartbeat
 * Manually trigger a heartbeat check for a specific domain or all domains.
 * Body: { domain?: "example.com" }
 */
app.post('/api/session/heartbeat', async (req, res) => {
  try {
    const { domain } = req.body || {};
    if (domain) {
      const alive = await vault.sessionVault.checkSession(domain);
      res.json({ success: true, data: { domain, active: alive } });
    } else {
      await vault.sessionVault.heartbeatAll();
      const active = vault.sessionVault.getActive();
      res.json({ success: true, data: { checkedAll: true, activeCount: active.length } });
    }
  } catch (error) {
    handleError(res, error);
  }
});

// ─── Vault (Composite) ─────────────────────────────────────────

/**
 * GET /api/vault/next
 * Returns next proxy + best active session. Called by crawler before scraping.
 */
app.get('/api/vault/next', (req, res) => {
  const { domain } = req.query;
  const result = vault.next(domain);
  res.json({
    success: true,
    data: {
      proxy: result.proxy,
      session: result.session,
      matchedDomain: !!domain,
      _hint: result.session
        ? 'Use proxy in crawler args, cookies in request headers'
        : 'No active session. Inject one via POST /api/session/inject',
    },
  });
});

// ─── 404 ───────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { message: 'Endpoint not found', code: 'NOT_FOUND' },
  });
});

// ─── Error Handler ─────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[API] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { message: err.message || 'Internal server error', code: 'INTERNAL_ERROR' },
  });
});

function handleError(res, error) {
  const statusCode = error instanceof VaultError ? error.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    error: {
      message: error.message,
      code: error.code || 'INTERNAL_ERROR',
    },
  });
}

// ─── Start ─────────────────────────────────────────────────────

async function start() {
  await vault.init();

  app.listen(config.PORT, () => {
    console.log(`
========================================
  DataBridge Vault — Infrastructure
  Server running on http://localhost:${config.PORT}

  Endpoints:
  ── Proxy Pool ──
  POST /api/proxy/add       - Add proxy to rotation pool
  GET  /api/proxy/list      - List all proxies
  DELETE /api/proxy/remove  - Remove a proxy

  ── Session Vault ──
  POST   /api/session/inject    - Inject cookies + keep-alive URL
  GET    /api/session/list      - List all sessions
  GET    /api/session/status    - Get session by domain
  DELETE /api/session/remove    - Remove a session
  POST   /api/session/heartbeat - Trigger manual heartbeat

  ── Composite ──
  GET /api/vault/next       - Next proxy + best active session

  Pipeline:
  GET /api/vault/next → feed proxy + cookies → databridge-crawler
========================================
  `);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => vault.shutdown());
process.on('SIGINT', () => {
  vault.shutdown();
  process.exit(0);
});

start().catch((err) => {
  console.error('[API] Failed to start:', err);
  process.exit(1);
});

module.exports = app;
