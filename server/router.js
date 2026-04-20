'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolveAppRoute } = require('./app-router');
const { applyPerformanceHeaders, gzipIfAccepted } = require('./cache-layer');

function detectRoute(urlPath = '') {
  const p = (urlPath.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  if (p === '/workspace' || p.startsWith('/workspace/')) return { type: 'workspace', path: p };
  if (p === '/zayvora' || p.startsWith('/zayvora/')) return { type: 'zayvora', path: p };
  if (p === '/apps' || p.startsWith('/apps/')) return { type: 'apps', path: p, app: resolveAppRoute(p) };
  return { type: 'none', path: p };
}

function routeAppRequest(req, res, { rootDir = process.cwd(), appRouterTarget = 'app-router' } = {}) {
  const r = detectRoute(req.url || ''); if (r.type !== 'apps' || !r.app) return false;
  const file = path.resolve(rootDir, 'apps', r.app.appName, r.app.appSubpath || 'index.html');
  if (!file.startsWith(path.resolve(rootDir, 'apps', r.app.appName)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('App not found'); return true; }
  res.setHeader('x-edge-router', appRouterTarget); applyPerformanceHeaders(res, file);
  const gzip = gzipIfAccepted(req, res); const stream = fs.createReadStream(file);
  if (gzip) { stream.pipe(gzip).pipe(res); } else { stream.pipe(res); }
  return true;
}

function routeWorkspace(req, res, { workspaceTarget = '/apps/workspace', zayvoraTarget = '/apps/zayvora' } = {}) {
  const r = detectRoute(req.url || '');
  if (r.type === 'workspace' || r.type === 'zayvora') { const t = r.type === 'workspace' ? workspaceTarget : zayvoraTarget; res.writeHead(307, { Location: t, 'x-edge-router': 'edge-workspace' }); res.end(); return true; }
  return false;
}

module.exports = { detectRoute, routeAppRequest, routeWorkspace };
