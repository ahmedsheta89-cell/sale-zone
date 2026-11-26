// Pure Node.js static HTTP server for local testing & Playwright E2E suites.
// Handles UTF-8 encoded Arabic paths (e.g., /متجر_2.HTML, /ادمن_2.HTML).

const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.HTML': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function parsePort() {
  const args = process.argv.slice(2);
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    return parseInt(args[portIdx + 1], 10);
  }
  return parseInt(process.env.TEST_SERVER_PORT || '8180', 10);
}

function createServer(rootDir = process.cwd()) {
  return http.createServer((req, res) => {
    try {
      const urlPath = req.url.split('?')[0];
      let decodedPath;
      try {
        decodedPath = decodeURIComponent(urlPath);
      } catch (err) {
        decodedPath = urlPath;
      }

      let filePath = path.join(rootDir, decodedPath === '/' ? 'index.html' : decodedPath);

      // Security check: prevent directory traversal
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        const indexCandidate = path.join(filePath, 'index.html');
        if (fs.existsSync(indexCandidate)) {
          filePath = indexCandidate;
        }
      }

      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found: ' + decodedPath);
        return;
      }

      const ext = path.extname(filePath);
      const mime = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error: ' + err.message);
    }
  });
}

if (require.main === module) {
  const port = parsePort();
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`Local test server running on http://127.0.0.1:${port}`);
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}

module.exports = { createServer };
