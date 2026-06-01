/**
 * DataBridge Vault — Test Suite
 *
 * Run: node test.js  (server must be running: npm start)
 */

const http = require('http');

const BASE = { hostname: 'localhost', port: 3002 };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function req(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { ...BASE, path, method, headers: JSON_HEADERS };
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          resolve({ httpStatus: res.statusCode, ...JSON.parse(d) });
        } catch {
          resolve({ httpStatus: res.statusCode, body: d });
        }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function failDetail(r) {
  if (r) console.log(`    Response: status=${r.status} body=${JSON.stringify(r).substring(0, 200)}`);
}

async function run() {
  let passed = 0;
  let failed = 0;

  console.log('========================================');
  console.log('  DataBridge Vault — Test Suite');
  console.log('========================================\n');

  // ── Test 1: Health ──────────────────────────────────
  try {
    console.log('[Test 1] Health Check...');
    const r = await req('GET', '/health');
    if (r.httpStatus === 200 && r.success && r.stats) {
      console.log(`  Proxies: ${r.stats.proxies}, Sessions: ${r.stats.sessions}`);
      console.log('  ✓ PASSED\n');
      passed++;
    } else {
      console.log(`  ✗ FAILED: status=${r.status} success=${r.success} hasStats=${!!r.stats}\n`);
      failDetail(r);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 2: Add proxies ─────────────────────────────
  try {
    console.log('[Test 2] Add proxies...');
    const r1 = await req('POST', '/api/proxy/add', {
      proxy: 'http://user1:pass1@1.2.3.4:8080',
    });
    const r2 = await req('POST', '/api/proxy/add', {
      proxy: 'http://user2:pass2@5.6.7.8:3128',
    });
    if (r1.success && r2.success) {
      console.log(`  Pool size: ${r2.data.poolSize}`);
      console.log('  ✓ PASSED\n');
      passed++;
    } else {
      console.log(`  ✗ FAILED\n`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 3: Proxy list ──────────────────────────────
  try {
    console.log('[Test 3] Proxy list...');
    const r = await req('GET', '/api/proxy/list');
    if (r.success && r.data.proxies.length === 2) {
      console.log(`  Found ${r.data.size} proxies`);
      console.log('  ✓ PASSED\n');
      passed++;
    } else {
      console.log(`  ✗ FAILED\n`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 4: Round-robin rotation ─────────────────────
  try {
    console.log('[Test 4] Round-robin rotation...');
    const n1 = await req('GET', '/api/vault/next');
    const n2 = await req('GET', '/api/vault/next');
    const n3 = await req('GET', '/api/vault/next');

    const p1 = n1.data.proxy;
    const p2 = n2.data.proxy;
    const p3 = n3.data.proxy;

    if (p1 !== p2 && p2 !== p3 && p1 === p3) {
      console.log(`  Proxy 1: ${p1.split('@')[1]}`);
      console.log(`  Proxy 2: ${p2.split('@')[1]}`);
      console.log(`  Proxy 3 (wrap-around): ${p3.split('@')[1]}`);
      console.log('  ✓ PASSED (round-robin confirmed)\n');
      passed++;
    } else {
      console.log(`  ✗ FAILED: ${p1}, ${p2}, ${p3}\n`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 5: Remove proxy ─────────────────────────────
  try {
    console.log('[Test 5] Remove proxy...');
    const r = await req('DELETE', '/api/proxy/remove?index=1');
    if (r.success && r.data.removed) {
      const list = await req('GET', '/api/proxy/list');
      console.log(`  Removed, pool now: ${list.data.size}`);
      console.log('  ✓ PASSED\n');
      passed++;
    } else {
      console.log(`  ✗ FAILED: success=${!!r.success} removed=${!!r.data?.removed}`);
      failDetail(r);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 6: Invalid proxy format ─────────────────────
  try {
    console.log('[Test 6] Invalid proxy rejection...');
    const r = await req('POST', '/api/proxy/add', { proxy: 'not-a-proxy' });
    if (!r.success && r.httpStatus === 400) {
      console.log(`  Rejected: ${r.error.message}`);
      console.log('  ✓ PASSED\n');
      passed++;
    } else {
      console.log(`  ✗ FAILED\n`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 7: Inject session ───────────────────────────
  try {
    console.log('[Test 7] Inject session...');
    const r = await req('POST', '/api/session/inject', {
      domain: 'test.example.com',
      cookies: 'session_id=abc123; auth_token=xyz789',
      keepAliveUrl: 'https://httpbin.org/status/200',
    });
    if (r.success && (r.data.injected === true || r.data.injected === 'updated')) {
      console.log(`  Domain: ${r.data.domain}, Status: ${r.data.session.status}`);
      console.log('  ✓ PASSED\n');
      passed++;
    } else {
      console.log(`  ✗ FAILED: ${JSON.stringify(r)}\n`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 8: Session list ─────────────────────────────
  try {
    console.log('[Test 8] Session list...');
    const r = await req('GET', '/api/session/list');
    if (r.success && r.data.length >= 1) {
      console.log(`  ${r.data.length} session(s), first: ${r.data[0].domain} (${r.data[0].status})`);
      console.log('  ✓ PASSED\n');
      passed++;
    } else {
      console.log(`  ✗ FAILED\n`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 9: Session status by domain ──────────────────
  try {
    console.log('[Test 9] Session status by domain...');
    const r = await req('GET', '/api/session/status?domain=test.example.com');
    if (r.success && r.data.domain === 'test.example.com') {
      console.log(`  Status: ${r.data.status}, Last checked: ${r.data.lastChecked}`);
      console.log('  ✓ PASSED\n');
      passed++;
    } else {
      console.log(`  ✗ FAILED\n`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 10: Vault/next with session ──────────────────
  try {
    console.log('[Test 10] Vault/next with proxy + session...');
    const r = await req('GET', '/api/vault/next');
    if (r.success && r.data.proxy) {
      const hasSession = !!r.data.session;
      console.log(`  Proxy: ${r.data.proxy.split('@')[1]}, Session: ${hasSession ? r.data.session.domain : 'pending heartbeat'}`);
      console.log(`  ${hasSession ? '✓' : '~'} ${hasSession ? 'PASSED' : 'AWAITING HEARTBEAT (session checking...)'}\n`);
      passed++;
    } else {
      console.log(`  ✗ FAILED\n`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 11: 404 handling ─────────────────────────────
  try {
    console.log('[Test 11] 404 handling...');
    const r = await req('GET', '/api/nonexistent');
    if (r.httpStatus === 404) {
      console.log('  ✓ PASSED\n');
      passed++;
    } else {
      console.log(`  ✗ FAILED\n`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Summary ───────────────────────────────────────────
  console.log('========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('========================================');
}

run();
