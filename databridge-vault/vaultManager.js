/**
 * vaultManager.js — Proxy Pool + Session Vault
 *
 * ┌─────────────────────────────────────────────────┐
 * │  ProxyPool    │  Round-Robin proxy rotation     │
 * │  SessionVault │  Cookie store + heartbeat alive  │
 * └─────────────────────────────────────────────────┘
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('./config');

// ─── Error Classes ────────────────────────────────────────────

class VaultError extends Error {
  constructor(message, code = 'VAULT_ERROR', statusCode = 500) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const ERROR_CODES = {
  PROXY_POOL_EMPTY: 'PROXY_POOL_EMPTY',
  PROXY_POOL_FULL: 'PROXY_POOL_FULL',
  PROXY_INVALID_FORMAT: 'PROXY_INVALID_FORMAT',
  SESSION_EXISTS: 'SESSION_EXISTS',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_VAULT_FULL: 'SESSION_VAULT_FULL',
  INVALID_INPUT: 'INVALID_INPUT',
};

// ─── Proxy Pool ───────────────────────────────────────────────

class ProxyPool {
  constructor(initialProxies = []) {
    /** @type {string[]} */
    this.proxies = [...initialProxies];
    /** @type {number} atomic round-robin index */
    this.index = 0;
  }

  /**
   * Add a proxy to the pool. Validates format.
   * @param {string} proxyUrl — http://user:pass@host:port
   */
  add(proxyUrl) {
    if (!proxyUrl || typeof proxyUrl !== 'string') {
      throw new VaultError('Proxy URL must be a non-empty string', ERROR_CODES.INVALID_INPUT, 400);
    }

    const trimmed = proxyUrl.trim();

    // Validate format: must start with http:// or https://
    if (!/^https?:\/\/.+/.test(trimmed)) {
      throw new VaultError(
        `Invalid proxy format: "${trimmed}". Must be http://user:pass@host:port`,
        ERROR_CODES.PROXY_INVALID_FORMAT,
        400
      );
    }

    if (this.proxies.length >= config.MAX_PROXIES) {
      throw new VaultError(
        `Proxy pool full (max ${config.MAX_PROXIES})`,
        ERROR_CODES.PROXY_POOL_FULL,
        429
      );
    }

    // Dedup
    if (this.proxies.includes(trimmed)) {
      return { added: false, reason: 'duplicate', proxy: trimmed };
    }

    this.proxies.push(trimmed);
    return { added: true, proxy: trimmed, poolSize: this.proxies.length };
  }

  /**
   * Remove a proxy by exact match or index.
   * @param {string|number} identifier
   */
  remove(identifier) {
    if (typeof identifier === 'number') {
      if (identifier < 0 || identifier >= this.proxies.length) {
        return null;
      }
      const removed = this.proxies.splice(identifier, 1)[0];
      // Adjust index if we removed before or at current position
      if (identifier <= this.index && this.index > 0) {
        this.index--;
      }
      return removed;
    }

    const idx = this.proxies.indexOf(identifier);
    if (idx === -1) return null;
    return this.remove(idx);
  }

  /**
   * Get next proxy in round-robin order. Thread-safe for single process.
   * @returns {string|null} proxy URL or null if pool empty
   */
  next() {
    if (this.proxies.length === 0) return null;
    const proxy = this.proxies[this.index];
    this.index = (this.index + 1) % this.proxies.length;
    return proxy;
  }

  /** @returns {{ proxies: string[], size: number, currentIndex: number }} */
  status() {
    return {
      proxies: [...this.proxies],
      size: this.proxies.length,
      currentIndex: this.index,
    };
  }
}

// ─── Session Vault ────────────────────────────────────────────

/**
 * Session states:
 *   active   — heartbeat passed, cookie is valid
 *   expired  — heartbeat failed (non-200 or network error)
 *   checking — heartbeat in progress (don't return to consumers)
 *   unknown  — initial state before first heartbeat
 */
const SESSION_STATES = ['active', 'expired', 'checking', 'unknown'];

class SessionVault {
  constructor() {
    /** @type {Map<string, SessionEntry>} domain → session */
    this.sessions = new Map();
    /** @type {ReturnType<setInterval>|null} */
    this.heartbeatTimer = null;
  }

  /**
   * Inject or update a session for a domain.
   * @param {{ domain: string, cookies: string, keepAliveUrl: string }} params
   */
  inject({ domain, cookies, keepAliveUrl }) {
    if (!domain || !cookies || !keepAliveUrl) {
      throw new VaultError(
        'domain, cookies, and keepAliveUrl are all required',
        ERROR_CODES.INVALID_INPUT,
        400
      );
    }

    // Validate URL
    try {
      new URL(keepAliveUrl);
    } catch {
      throw new VaultError(
        `Invalid keepAliveUrl: "${keepAliveUrl}"`,
        ERROR_CODES.INVALID_INPUT,
        400
      );
    }

    const key = domain.toLowerCase();

    const isUpdate = this.sessions.has(key);
    if (!isUpdate && this.sessions.size >= config.MAX_SESSIONS) {
      throw new VaultError(
        `Session vault full (max ${config.MAX_SESSIONS})`,
        ERROR_CODES.SESSION_VAULT_FULL,
        429
      );
    }

    const entry = {
      domain: key,
      cookies,
      keepAliveUrl,
      status: 'unknown',
      lastChecked: null,
      lastError: null,
      injectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(key, entry);
    this.persist();

    // Run an immediate heartbeat check
    setImmediate(() => this.checkSession(key));

    return { injected: !isUpdate ? true : 'updated', domain: key };
  }

  /**
   * Get all active sessions. Only returns sessions with status 'active'.
   * @returns {SessionEntry[]}
   */
  getActive() {
    const active = [];
    for (const [, session] of this.sessions) {
      if (session.status === 'active') {
        active.push(this.sanitize(session));
      }
    }
    return active;
  }

  /**
   * Get session for a specific domain.
   * @param {string} domain
   * @returns {SessionEntry|null}
   */
  get(domain) {
    const session = this.sessions.get(domain.toLowerCase());
    return session ? this.sanitize(session) : null;
  }

  /**
   * Get all sessions with full status.
   */
  listAll() {
    const list = [];
    for (const [, session] of this.sessions) {
      list.push(this.sanitize(session));
    }
    return list;
  }

  /**
   * Remove a session by domain.
   * @param {string} domain
   */
  remove(domain) {
    const key = domain.toLowerCase();
    const existed = this.sessions.has(key);
    this.sessions.delete(key);
    if (existed) this.persist();
    return existed;
  }

  // ─── Heartbeat Engine ──────────────────────────────────

  /**
   * Start the background heartbeat loop.
   */
  startHeartbeat() {
    if (this.heartbeatTimer) return;

    console.log(`[Vault] Heartbeat started — every ${config.HEARTBEAT_INTERVAL / 1000}s`);

    this.heartbeatTimer = setInterval(() => {
      this.heartbeatAll();
    }, config.HEARTBEAT_INTERVAL);

    // Allow garbage collection to clean up the timer
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * Stop the heartbeat loop.
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      console.log('[Vault] Heartbeat stopped');
    }
  }

  /**
   * Check all sessions in parallel.
   */
  async heartbeatAll() {
    const domains = Array.from(this.sessions.keys());
    if (domains.length === 0) return;

    console.log(`[Vault] Heartbeat: checking ${domains.length} session(s)...`);

    const checks = domains.map((domain) => this.checkSession(domain));
    const results = await Promise.allSettled(checks);

    const passed = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.length - passed;

    console.log(`[Vault] Heartbeat done — ${passed} active, ${failed} expired`);
  }

  /**
   * Check a single session's keep-alive URL.
   * @param {string} domain
   * @returns {Promise<boolean>} true if active, false if expired
   */
  async checkSession(domain) {
    const session = this.sessions.get(domain);
    if (!session) return false;

    // Mark as checking during the request
    const previousStatus = session.status;
    session.status = 'checking';

    try {
      const response = await axios.get(session.keepAliveUrl, {
        timeout: config.HEARTBEAT_TIMEOUT,
        headers: {
          Cookie: session.cookies,
          'User-Agent': 'DataBridge-Vault/1.0 (Session-Heartbeat)',
        },
        maxRedirects: 5,
        validateStatus: null, // Don't throw on non-2xx, we check manually
      });

      if (response.status === 200) {
        session.status = 'active';
        session.lastChecked = new Date().toISOString();
        session.lastError = null;
        this.persist();
        return true;
      }

      // Got a response but not 200 — session likely expired
      session.status = 'expired';
      session.lastChecked = new Date().toISOString();
      session.lastError = `HTTP ${response.status}`;
      this.persist();
      return false;
    } catch (error) {
      // Network error — mark as expired
      session.status = 'expired';
      session.lastChecked = new Date().toISOString();
      session.lastError = error.message;
      this.persist();

      // If it was previously active, log the degradation
      if (previousStatus === 'active') {
        console.warn(`[Vault] Session for "${domain}" degraded: active → expired (${error.message})`);
      }

      return false;
    }
  }

  // ─── Persistence ───────────────────────────────────────

  /**
   * Persist sessions to disk as JSON.
   */
  persist() {
    try {
      const data = {};
      for (const [domain, session] of this.sessions) {
        data[domain] = {
          domain: session.domain,
          cookies: session.cookies,
          keepAliveUrl: session.keepAliveUrl,
          status: session.status,
          lastChecked: session.lastChecked,
          lastError: session.lastError,
          injectedAt: session.injectedAt,
          updatedAt: new Date().toISOString(),
        };
      }

      const tmpPath = config.SESSIONS_FILE + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, config.SESSIONS_FILE); // Atomic write
    } catch (error) {
      console.error('[Vault] Failed to persist sessions:', error.message);
    }
  }

  /**
   * Load sessions from disk. Call once at startup.
   */
  load() {
    try {
      if (!fs.existsSync(config.SESSIONS_FILE)) {
        console.log('[Vault] No existing sessions file found — starting fresh');
        return 0;
      }

      const raw = fs.readFileSync(config.SESSIONS_FILE, 'utf-8');
      const data = JSON.parse(raw);

      let count = 0;
      for (const [domain, entry] of Object.entries(data)) {
        // Validate entry has required fields
        if (!entry.cookies || !entry.keepAliveUrl) {
          console.warn(`[Vault] Skipping invalid session entry for "${domain}" — missing fields`);
          continue;
        }

        this.sessions.set(domain, {
          domain,
          cookies: entry.cookies,
          keepAliveUrl: entry.keepAliveUrl,
          status: 'unknown', // Reset to unknown — will re-validate on heartbeat
          lastChecked: entry.lastChecked || null,
          lastError: null,
          injectedAt: entry.injectedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        count++;
      }

      console.log(`[Vault] Loaded ${count} session(s) from ${config.SESSIONS_FILE}`);
      return count;
    } catch (error) {
      console.error(`[Vault] Failed to load sessions: ${error.message}`);
      return 0;
    }
  }

  // ─── Helpers ───────────────────────────────────────────

  /**
   * Return a sanitized copy (strip internal fields).
   */
  sanitize(session) {
    return {
      domain: session.domain,
      cookies: session.cookies,
      keepAliveUrl: session.keepAliveUrl,
      status: session.status,
      lastChecked: session.lastChecked,
      lastError: session.lastError,
      injectedAt: session.injectedAt,
    };
  }
}

// ─── Vault Manager (Facade) ────────────────────────────────────

class VaultManager {
  constructor() {
    this.proxyPool = new ProxyPool(config.INITIAL_PROXIES);
    this.sessionVault = new SessionVault();
  }

  /**
   * Initialize: load persisted sessions, start heartbeat, do initial check.
   */
  async init() {
    const loaded = this.sessionVault.load();
    this.sessionVault.startHeartbeat();

    if (loaded > 0) {
      console.log(`[Vault] Running initial heartbeat for ${loaded} loaded session(s)...`);
      await this.sessionVault.heartbeatAll();
    }

    console.log(`[Vault] Manager initialized — ${this.proxyPool.proxies.length} proxies, ${this.sessionVault.sessions.size} sessions`);
  }

  /**
   * Composite: get next proxy + best active session.
   * Called by crawler before each scrape.
   * @returns {{ proxy: string|null, session: object|null }}
   */
  next() {
    const proxy = this.proxyPool.next();
    const activeSessions = this.sessionVault.getActive();

    // Best session: prefer the first active one (or specific domain if we had filtering)
    const session = activeSessions.length > 0 ? activeSessions[0] : null;

    return { proxy, session };
  }

  /**
   * Graceful shutdown.
   */
  shutdown() {
    this.sessionVault.stopHeartbeat();
    this.sessionVault.persist();
    console.log('[Vault] Manager shut down');
  }
}

module.exports = { VaultManager, ProxyPool, SessionVault, VaultError, ERROR_CODES, SESSION_STATES };
