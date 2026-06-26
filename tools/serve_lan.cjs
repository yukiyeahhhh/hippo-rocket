const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2] || 8124);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://0.0.0.0:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  });
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Try: node tools/serve_lan.cjs ${port + 1}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(port, '0.0.0.0', () => {
  const urls = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const net of entries || []) {
      if (net.family === 'IPv4' && !net.internal) urls.push(`http://${net.address}:${port}/`);
    }
  }
  console.log(`hippo-rocket LAN server: http://127.0.0.1:${port}/`);
  for (const url of urls) console.log(`smartphone URL: ${url}`);
  console.log('Keep this terminal open. If the smartphone cannot connect, allow Node.js through Windows Firewall on Private networks.');
});
