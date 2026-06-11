const https = require('https');

const options = {
  hostname: 'ais-pre-idvpxbtu36sxo2axfuf3ax-241171538403.us-west2.run.app',
  port: 443,
  path: '/api/payments/verify-payment',
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://lakayy-markett.vercel.app',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type'
  }
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers, null, 2)}`);
  res.on('data', () => {});
});

req.on('error', (e) => {
  console.error(`Problem: ${e.message}`);
});

req.end();
