const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const { spawn } = require('child_process');

// Generate self-signed certificate if it doesn't exist
if (!fs.existsSync('server.key') || !fs.existsSync('server.cert')) {
  console.log('Generating SSL certificate...');
  try {
    execSync('openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.cert -days 365 -nodes -subj "/CN=localhost"', { stdio: 'inherit' });
  } catch (error) {
    console.log('OpenSSL not found. Please install OpenSSL or use ngrok instead.');
    process.exit(1);
  }
}

// Start HTTPS server with proxy to React dev server
const httpsServer = https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
}, (req, res) => {
  // Proxy to React dev server
  const proxy = spawn('npm', ['start'], { 
    stdio: 'pipe',
    shell: true 
  });
  
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Redirecting to HTTPS...</title>
      <meta http-equiv="refresh" content="2;url=https://localhost:3001">
    </head>
    <body>
      <h1>Setting up HTTPS...</h1>
      <p>Redirecting to <a href="https://localhost:3001">https://localhost:3001</a></p>
    </body>
    </html>
  `);
});

httpsServer.listen(3001, () => {
  console.log('HTTPS Server running on https://localhost:3001');
  console.log('Accept the security certificate in your browser');
  console.log('Then access from mobile using your computer\'s IP: https://192.168.1.41:3001');
});

// Also start regular HTTP server for development
const devServer = spawn('npm', ['start'], { 
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});
