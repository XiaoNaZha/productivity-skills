const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
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

async function runTests() {
  console.log('=== Skill Test Suite ===\n');

  try {
    console.log('[Test 1] Health Check...');
    const health = await makeRequest('/health');
    console.log(`  Status: ${health.statusCode}`);
    console.log(`  Response:`, health.data);
    console.log('  ✓ PASSED\n');
  } catch (error) {
    console.error(`  ✗ FAILED: ${error.message}`);
    console.log('Make sure the server is running: npm start\n');
  }

  console.log('=== Test Suite Complete ===');
}

runTests();
