const http = require('http');

console.log("🔍 Checking CryptoGuard services...");

const options = {
  hostname: 'localhost',
  port: 8000,
  path: '/health',
  method: 'GET'
};

const req = http.request(options, res => {
  let data = '';

  res.on('data', chunk => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const parsed = JSON.parse(data);
        console.log("✅ Backend is UP and running!");
        console.log(`🤖 Simulation Mode: ${parsed.simulation_mode ? 'ENABLED' : 'DISABLED'}`);
        console.log(`📈 Transactions Processed: ${parsed.transactions_processed}`);
        process.exit(0);
      } catch (e) {
        console.error("❌ Invalid JSON response from health endpoint");
        process.exit(1);
      }
    } else {
      console.error(`❌ Backend returned status: ${res.statusCode}`);
      process.exit(1);
    }
  });
});

req.on('error', error => {
  console.error("❌ ERROR: Backend is unreachable. Make sure the server is running on port 8000.");
  console.error(error.message);
  process.exit(1);
});

req.end();
