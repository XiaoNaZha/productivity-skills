const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('========================================');
  console.log('  WAF Bypass Crawler - Test Suite');
  console.log('========================================\n');

  try {
    console.log('[Test 1] Health Check...');
    const health = await makeRequest('/health');
    console.log(`  Status: ${health.statusCode}`);
    console.log(`  Response:`, health.data);
    console.log('  ✓ PASSED\n');

    console.log('[Test 2] Extract simple page (HTML)...');
    const result1 = await makeRequest('/api/extract', {
      url: 'https://example.com',
      format: 'html',
    });
    console.log(`  Status: ${result1.statusCode}`);
    if (result1.data.success) {
      console.log(`  Title: ${result1.data.data.title}`);
      console.log(`  Content length: ${result1.data.data.content.length} bytes`);
      console.log('  ✓ PASSED\n');
    } else {
      console.log(`  Error: ${result1.data.error.message}`);
      console.log('  ✗ FAILED\n');
    }

    console.log('[Test 3] Extract simple page (Text)...');
    const result2 = await makeRequest('/api/extract', {
      url: 'https://example.com',
      format: 'text',
    });
    console.log(`  Status: ${result2.statusCode}`);
    if (result2.data.success) {
      console.log(`  Title: ${result2.data.data.title}`);
      console.log(`  Content preview: ${result2.data.data.content.substring(0, 200)}...`);
      console.log('  ✓ PASSED\n');
    } else {
      console.log(`  Error: ${result2.data.error.message}`);
      console.log('  ✗ FAILED\n');
    }

    console.log('[Test 4] Extract with selector...');
    const result3 = await makeRequest('/api/extract', {
      url: 'https://example.com',
      selector: 'h1',
    });
    console.log(`  Status: ${result3.statusCode}`);
    if (result3.data.success) {
      console.log(`  Title: ${result3.data.data.title}`);
      console.log(`  Content: ${result3.data.data.content}`);
      console.log('  ✓ PASSED\n');
    } else {
      console.log(`  Error: ${result3.data.error.message}`);
      console.log('  ✗ FAILED\n');
    }

    console.log('[Test 5] Invalid URL handling...');
    const result4 = await makeRequest('/api/extract', {
      url: 'not-a-valid-url',
    });
    console.log(`  Status: ${result4.statusCode}`);
    if (!result4.data.success) {
      console.log(`  Error code: ${result4.data.error.code}`);
      console.log('  ✓ PASSED\n');
    } else {
      console.log('  ✗ FAILED\n');
    }

    console.log('[Test 6] 404 endpoint handling...');
    const result5 = await makeRequest('/api/nonexistent');
    console.log(`  Status: ${result5.statusCode}`);
    if (result5.statusCode === 404) {
      console.log('  ✓ PASSED\n');
    } else {
      console.log('  ✗ FAILED\n');
    }

  } catch (error) {
    console.error(`\n✗ Test suite failed: ${error.message}`);
    console.log('Make sure the server is running: npm start');
  }

  console.log('========================================');
  console.log('  Test Suite Completed');
  console.log('========================================');
}

runTests();
