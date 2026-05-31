const http = require('http');

const BASE_URL = 'http://localhost:3001';

function makeRequest(path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// A realistic noisy HTML sample — simulates a typical blog/article page
const NOISY_HTML = `
<html>
<head><title>Test Article — AI Productivity</title>
<style>body{font:16px sans-serif}.sidebar{float:right;width:300px}.ad-banner{background:#eee}</style>
</head>
<body>
  <nav class="main-nav">
    <ul><li><a href="/">Home</a></li><li><a href="/blog">Blog</a></li></ul>
  </nav>
  <header>
    <h1>Test Article — AI Productivity</h1>
    <div class="social-share">
      <a href="https://twitter.com/share">Tweet</a>
      <a href="https://facebook.com/share">Share</a>
    </div>
  </header>
  <div class="ad-banner">Sponsored: Buy our AI course for $499!</div>
  <main>
    <article>
      <h2>Introduction</h2>
      <p>AI is transforming how we work. <strong>Productivity</strong> has never been more accessible.</p>
      <h2>Key Findings</h2>
      <p>Our research shows three major trends:</p>
      <ul>
        <li>Automation reduces context switching by 40%</li>
        <li>LLMs handle 80% of routine documentation</li>
        <li>Teams ship <em>2x faster</em> with AI pair programming</li>
      </ul>
      <h2>Code Example</h2>
      <pre><code class="language-python">def greet(name):
    return f"Hello, {name}!"</code></pre>
      <blockquote>
        <p>"The best way to predict the future is to invent it." — Alan Kay</p>
      </blockquote>
      <p>Check out <a href="https://example.com/tools">our tools</a> for more details.</p>
    </article>
  </main>
  <aside class="sidebar">
    <div class="newsletter-signup"><h3>Subscribe!</h3><form><input type="email"/></form></div>
    <div class="related-posts"><h3>Related</h3><ul><li>Post 1</li><li>Post 2</li></ul></div>
    <div class="advertisement"><img src="ad.jpg" alt="Buy now!"/></div>
  </aside>
  <footer>
    <p>© 2026 Test Corp. All rights reserved.</p>
    <nav class="footer-nav"><a href="/privacy">Privacy</a></nav>
  </footer>
  <div class="cookie-banner" id="cookie-consent">
    <p>We use cookies. <button>Accept</button></p>
  </div>
  <script>console.log('tracking pixel');</script>
</body>
</html>
`;

async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('========================================');
  console.log('  HTML → Markdown Purifier — Test Suite');
  console.log('========================================\n');

  // Test 1
  try {
    console.log('[Test 1] Health Check...');
    const health = await makeRequest('/health');
    if (health.statusCode === 200 && health.data.status === 'ok') {
      console.log('  ✓ PASSED\n');
      passed++;
    } else {
      console.log('  ✗ FAILED\n');
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // Test 2: Basic HTML conversion
  try {
    console.log('[Test 2] Basic HTML → Markdown...');
    const result = await makeRequest('/api/convert', {
      html: '<html><head><title>Test</title></head><body><main><h1>Hello</h1><p>World</p></main></body></html>',
    });
    if (result.data.success && result.data.data.markdown.includes('Hello')) {
      console.log(`  Title: ${result.data.data.title}`);
      console.log(`  Markdown preview: ${result.data.data.markdown.substring(0, 100)}...`);
      console.log('  ✓ PASSED\n');
      passed++;
    } else {
      console.log(`  Error: ${JSON.stringify(result.data)}\n`);
      console.log('  ✗ FAILED\n');
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // Test 3: Noise stripping
  try {
    console.log('[Test 3] Noise stripping (nav, footer, ads, script, sidebar)...');
    const result = await makeRequest('/api/convert', { html: NOISY_HTML });

    if (!result.data.success) {
      console.log(`  Error: ${JSON.stringify(result.data)}\n`);
      console.log('  ✗ FAILED\n');
      failed++;
    } else {
      const md = result.data.data.markdown;
      const stats = result.data.data.stats;
      let checks = [];

      // Should NOT contain noise
      checks.push({ label: 'nav stripped', pass: !md.includes('Home') && !md.includes('Blog') });
      checks.push({ label: 'footer stripped', pass: !md.includes('Test Corp') && !md.includes('Privacy') });
      checks.push({ label: 'ad banner stripped', pass: !md.includes('Sponsored') && !md.includes('$499') });
      checks.push({ label: 'newsletter stripped', pass: !md.includes('Subscribe') });
      checks.push({ label: 'sidebar stripped', pass: !md.includes('Related') });
      checks.push({ label: 'cookie banner stripped', pass: !md.includes('cookies') && !md.includes('Accept') });
      checks.push({ label: 'script stripped', pass: !md.includes('tracking pixel') });
      checks.push({ label: 'social share stripped', pass: !md.includes('Tweet') && !md.includes('facebook') });

      // Should CONTAIN core content
      checks.push({ label: 'title preserved', pass: md.includes('AI Productivity') });
      checks.push({ label: 'heading preserved', pass: md.includes('Introduction') });
      checks.push({ label: 'strong preserved', pass: md.includes('Productivity') });
      checks.push({ label: 'list preserved', pass: md.includes('Automation') });
      checks.push({ label: 'code block preserved', pass: md.includes('def greet') });
      checks.push({ label: 'blockquote preserved', pass: md.includes('Alan Kay') });
      checks.push({ label: 'link preserved', pass: md.includes('example.com/tools') });

      checks.forEach((c) => {
        console.log(`  ${c.pass ? '✓' : '✗'} ${c.label}`);
      });

      const allPassed = checks.every((c) => c.pass);
      if (allPassed) {
        console.log(`\n  ✓ ALL CHECKS PASSED`);
        console.log(`  Stats: ${stats.strippedElements} elements stripped, ${stats.reductionPercent}% reduction`);
        passed++;
      } else {
        console.log(`\n  ✗ SOME CHECKS FAILED`);
        failed++;
      }
      console.log('');
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // Test 4: Invalid input validation
  try {
    console.log('[Test 4] Invalid input (no html or url)...');
    const result = await makeRequest('/api/convert', {});
    if (result.statusCode === 400 && !result.data.success) {
      console.log('  ✓ PASSED (correctly rejected)\n');
      passed++;
    } else {
      console.log('  ✗ FAILED\n');
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  // Test 5: 404 handling
  try {
    console.log('[Test 5] 404 endpoint...');
    const result = await makeRequest('/api/nonexistent');
    if (result.statusCode === 404) {
      console.log('  ✓ PASSED\n');
      passed++;
    } else {
      console.log('  ✗ FAILED\n');
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}\n`);
    failed++;
  }

  console.log('========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('========================================');
}

runTests();
