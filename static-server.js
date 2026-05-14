#!/usr/bin/env node
// Minimal static file server for MBG Monitor index.html
import http from 'http';
import fs from 'fs';
import path from 'path';

const M = {
  'html': 'text/html;charset=utf-8', 'json': 'application/json',
  'js': 'text/javascript', 'css': 'text/css', 'svg': 'image/svg+xml',
  'png': 'image/png', 'ico': 'image/x-icon', 'jpg': 'image/jpeg',
  'webp': 'image/webp'
};

http.createServer((q, r) => {
  let p = q.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const f = path.resolve('/app', p.replace(/^\/+/, ''));
  try {
    if (!f.startsWith('/app/')) throw Error('bad path');
    const c = fs.readFileSync(f);
    const e = path.extname(f).slice(1);
    r.writeHead(200, {
      'Content-Type': M[e] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    r.end(c);
  } catch (e) {
    r.writeHead(404, { 'Content-Type': 'text/plain' });
    r.end('Not Found');
  }
}).listen(5173, () => console.log('MBG Monitor static :5173'));
