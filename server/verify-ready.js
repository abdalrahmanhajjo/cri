const http = require('http');

/**
 * Script to verify the /ready endpoint performs a real database check.
 * Run this while the server is running.
 */
async function verifyReady() {
  const options = {
    hostname: 'localhost',
    port: 3095,
    path: '/ready',
    method: 'GET'
  };

  console.log('--- Verifying Readiness Check ---');
  console.log('Target: http://localhost:3095/ready');

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      try {
        const json = JSON.parse(data);
        console.log('Response:', JSON.stringify(json, null, 2));
        if (res.statusCode === 200 && json.database === 'connected') {
          console.log('\n✅ SUCCESS: Readiness check is working and DB is connected.');
        } else if (res.statusCode === 503) {
          console.log('\n❌ FAILED: Readiness check reported DB disconnected (Expected if DB is down).');
        } else {
          console.log('\n❓ UNEXPECTED: Readiness check returned unknown state.');
        }
      } catch (e) {
        console.log('Raw Data:', data);
        console.log('Error parsing JSON:', e.message);
      }
    });
  });

  req.on('error', (err) => {
    console.error('\n❌ ERROR: Could not connect to server. Is it running on port 3095?');
    console.error(err.message);
  });

  req.end();
}

verifyReady();
