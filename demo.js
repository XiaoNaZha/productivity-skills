#!/usr/bin/env node
/**
 * DataBridge — End-to-End Agent Pipeline Demo
 *
 * Simulates a fully automated scraping pipeline:
 *   Vault (3002) → Crawler (3000) → Purifier (3001) → Output File
 *
 * Usage:
 *   node demo.js [target_url]
 *
 * Default target: https://news.ycombinator.com
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Configuration ─────────────────────────────────────────────

const TARGET_URL = process.argv[2] || 'https://news.ycombinator.com';
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'demo_result.md');

const SERVICES = {
  vault:    { host: 'localhost', port: 3002 },
  crawler:  { host: 'localhost', port: 3000 },
  purifier: { host: 'localhost', port: 3001 },
};

// ─── HTTP Helper ────────────────────────────────────────────────

/**
 * Make an HTTP request. Returns parsed JSON response.
 */
function request(method, service, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: service.host,
      port: service.port,
      path: apiPath,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ httpStatus: res.statusCode, ...parsed });
        } catch {
          // Non-JSON response — return raw
          resolve({ httpStatus: res.statusCode, raw: data, success: false });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after 60s`));
    });

    req.on('error', (err) => {
      reject(new Error(`Connection failed: ${err.message}`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ─── Health Check ───────────────────────────────────────────────

async function checkHealth(name, service) {
  try {
    const r = await request('GET', service, '/health');
    if (r.httpStatus === 200 && (r.status === 'ok' || r.success)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Stage 1: Request Credentials from Vault ────────────────────

async function stage1Vault() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄  STAGE 1 — Request Credentials from Vault');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('  → Calling GET /api/vault/next ...');

  const r = await request('GET', SERVICES.vault, '/api/vault/next');

  if (!r.success) {
    throw new Error(`Vault returned failure: ${JSON.stringify(r.error || r)}`);
  }

  const { proxy, session } = r.data;

  if (proxy) {
    // Mask password in proxy URL for safe logging
    const maskedProxy = proxy.replace(/\/\/(.+?):(.+?)@/, '//$1:****@');
    console.log(`  ✅  Proxy acquired: ${maskedProxy}`);
  } else {
    console.log('  ⚠️   No proxy available — crawling with direct IP');
  }

  if (session) {
    console.log(`  ✅  Session acquired: ${session.domain} (${session.status})`);
    console.log(`      Cookies: ${session.cookies.substring(0, 50)}...`);
  } else {
    console.log('  ⚠️   No active session — crawling without auth');
  }

  console.log('');
  return { proxy, session };
}

// ─── Stage 2: Breach & Capture via Crawler ──────────────────────

async function stage2Crawler(vaultData) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔓  STAGE 2 — Breach & Capture via Crawler');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const payload = {
    url: TARGET_URL,
    format: 'html',
    waitFor: 2000,
  };

  // Inject vault credentials into crawler request
  if (vaultData.proxy) {
    payload.proxy = vaultData.proxy;
  }
  if (vaultData.session?.cookies) {
    payload.cookies = vaultData.session.cookies;
  }

  const credSummary = [
    vaultData.proxy ? 'proxy' : null,
    vaultData.session?.cookies ? 'cookies' : null,
  ].filter(Boolean).join(', ') || 'direct';

  console.log(`  → Target: ${TARGET_URL}`);
  console.log(`  → Calling POST /api/extract with ${credSummary} ...`);

  const startTime = Date.now();

  const r = await request('POST', SERVICES.crawler, '/api/extract', payload);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!r.success) {
    throw new Error(`Crawler returned failure: ${JSON.stringify(r.error || r)}`);
  }

  const html = r.data.content;
  const title = r.data.title;

  console.log(`  ✅  Page captured in ${elapsed}s`);
  console.log(`      Title: ${title}`);
  console.log(`      HTML size: ${html.length.toLocaleString()} bytes`);
  console.log('');

  return { html, title };
}

// ─── Stage 3: Dehydrate & Clean via Purifier ────────────────────

async function stage3Purifier(html, title) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧹  STAGE 3 — Dehydrate & Clean via Purifier');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`  → Input HTML: ${html.length.toLocaleString()} bytes`);
  console.log(`  → Calling POST /api/convert ...`);

  const startTime = Date.now();

  const r = await request('POST', SERVICES.purifier, '/api/convert', { html });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  if (!r.success) {
    throw new Error(`Purifier returned failure: ${JSON.stringify(r.error || r)}`);
  }

  const markdown = r.data.markdown;
  const stats = r.data.stats;

  console.log(`  ✅  Purification complete in ${elapsed}s`);
  console.log(`      Markdown size: ${markdown.length.toLocaleString()} bytes`);
  console.log(`      Reduction: ${stats.reductionPercent}%`);
  console.log(`      Elements stripped: ${stats.strippedElements}`);
  console.log(`        - Hard strip: ${stats.strippedTypes.hardStripped}`);
  console.log(`        - Heuristic strip: ${stats.strippedTypes.heuristicStripped}`);
  console.log(`        - Empty cleanup: ${stats.strippedTypes.emptyCleaned}`);
  console.log('');

  return markdown;
}

// ─── Stage 4: Persist to Disk ───────────────────────────────────

async function stage4Save(markdown, title) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💾  STAGE 4 — Persist to Disk');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const timestamp = new Date().toISOString();
  const header = [
    `# DataBridge Demo Result`,
    ``,
    `> **Source:** ${TARGET_URL}`,
    `> **Title:** ${title}`,
    `> **Extracted at:** ${timestamp}`,
    `> **Pipeline:** Vault (3002) → Crawler (3000) → Purifier (3001)`,
    ``,
    `---`,
    ``,
  ].join('\n');

  const fullContent = header + markdown;

  fs.writeFileSync(OUTPUT_FILE, fullContent, 'utf-8');

  const fileSize = fs.statSync(OUTPUT_FILE).size;

  console.log(`  ✅  Saved to: ${OUTPUT_FILE}`);
  console.log(`      File size: ${fileSize.toLocaleString()} bytes`);
  console.log(`      Path: ${OUTPUT_FILE}`);
  console.log('');
}

// ─── Main Pipeline ──────────────────────────────────────────────

async function run() {
  const t0 = Date.now();

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         DataBridge — Agent Pipeline Demo         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Target: ${TARGET_URL.padEnd(40)}║`);
  console.log(`║  Started: ${new Date().toISOString().padEnd(27)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // ── Pre-flight: Health Checks ──────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏥  PRE-FLIGHT — Service Health Checks');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const healthResults = await Promise.all([
    checkHealth('Vault',    SERVICES.vault).then((ok) => ({ name: 'Vault (3002)',    ok })),
    checkHealth('Crawler',  SERVICES.crawler).then((ok) => ({ name: 'Crawler (3000)',  ok })),
    checkHealth('Purifier', SERVICES.purifier).then((ok) => ({ name: 'Purifier (3001)', ok })),
  ]);

  let allHealthy = true;
  for (const h of healthResults) {
    const icon = h.ok ? '✅' : '❌';
    console.log(`  ${icon}  ${h.name}: ${h.ok ? 'healthy' : 'UNREACHABLE'}`);
    if (!h.ok) allHealthy = false;
  }

  if (!allHealthy) {
    console.log('\n  ❌  One or more services are down. Aborting.');
    console.log('      Start all services first:');
    console.log('        cd databridge-vault    && npm start');
    console.log('        cd databridge-crawler  && npm start');
    console.log('        cd databridge-purifier && npm start');
    console.log('');
    process.exit(1);
  }

  console.log('\n  ✅  All services healthy!\n');

  // ── Execute Pipeline ───────────────────────────────────────
  let vaultData;
  let html, title;
  let markdown;

  try {
    // Stage 1
    vaultData = await stage1Vault();
  } catch (err) {
    console.error(`  ❌  STAGE 1 FAILED — Vault is down or misconfigured.`);
    console.error(`      ${err.message}\n`);
    process.exit(2);
  }

  try {
    // Stage 2
    const result = await stage2Crawler(vaultData);
    html = result.html;
    title = result.title;
  } catch (err) {
    console.error(`  ❌  STAGE 2 FAILED — Crawler could not fetch the page.`);
    console.error(`      ${err.message}`);
    console.error(`      Tip: Check if the target URL is reachable.\n`);
    process.exit(2);
  }

  try {
    // Stage 3
    markdown = await stage3Purifier(html, title);
  } catch (err) {
    console.error(`  ❌  STAGE 3 FAILED — Purifier could not process the HTML.`);
    console.error(`      ${err.message}\n`);
    process.exit(2);
  }

  try {
    // Stage 4
    await stage4Save(markdown, title);
  } catch (err) {
    console.error(`  ❌  STAGE 4 FAILED — Could not write output file.`);
    console.error(`      ${err.message}\n`);
    process.exit(2);
  }

  // ── Summary ────────────────────────────────────────────────
  const totalTime = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         🎉  PIPELINE COMPLETE!                   ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Stages executed:   4/4                          ║`);
  console.log(`║  Total time:        ${totalTime.padEnd(8)}s                      ║`);
  console.log(`║  Output:            ${OUTPUT_FILE.padEnd(34)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('  Pipeline:  🔄 Vault → 🔓 Crawler → 🧹 Purifier → 💾 Disk');
  console.log('');
}

// ─── Entry Point ────────────────────────────────────────────────

run().catch((err) => {
  console.error('');
  console.error('╔══════════════════════════════════════════════════╗');
  console.error('║         ❌  FATAL — Pipeline Crashed             ║');
  console.error('╠══════════════════════════════════════════════════╣');
  console.error(`║  ${err.message.substring(0, 46).padEnd(46)}║`);
  console.error('╚══════════════════════════════════════════════════╝');
  console.error('');
  console.error(err.stack);
  process.exit(3);
});
