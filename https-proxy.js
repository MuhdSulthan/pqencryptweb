const https = require('https');
const http = require('http');
const fs = require('fs');

console.log('🔧 Setting up HTTPS proxy...');

// Check if OpenSSL is available
const { execSync } = require('child_process');
try {
  execSync('openssl version', { stdio: 'ignore' });
  console.log('✅ OpenSSL found');
} catch (error) {
  console.log('❌ OpenSSL not found. Please install OpenSSL or use ngrok.');
  process.exit(1);
}

// Generate certificate if needed
if (!fs.existsSync('server.key') || !fs.existsSync('server.cert')) {
  console.log('📜 Generating SSL certificate...');
  try {
    execSync('openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.cert -days 365 -nodes -subj "/CN=localhost"', { stdio: 'inherit' });
    console.log('✅ Certificate generated');
  } catch (error) {
    console.log('❌ Failed to generate certificate');
    process.exit(1);
  }
}

// Create HTTPS server
const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
};

const server = https.createServer(options, (req, res) => {
  console.log(`📱 ${req.method} ${req.url}`);
  
  // Proxy to localhost:3000
  const proxy = http.request({
    hostname: 'localhost',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: 'localhost:3000' }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  req.pipe(proxy);
  
  proxy.on('error', (err) => {
    console.log('❌ Proxy error:', err.message);
    res.writeHead(502);
    res.end('Bad Gateway - Make sure React app is running on port 3000');
  });
});

server.listen(3001, () => {
  console.log('🚀 HTTPS Server running!');
  console.log('📱 Mobile URL: https://192.168.1.41:3001');
  console.log('💻 Local URL: https://localhost:3001');
  console.log('⚠️  Accept security certificate when prompted');
  console.log('🔗 Make sure React app is running on port 3000');
});
