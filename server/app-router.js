'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveAppRoute(urlPathname) {
  if (typeof urlPathname !== 'string') return null;

  const normalizedPath = urlPathname.split('?')[0].replace(/\/+$/, '') || '/';
  const routeMatch = normalizedPath.match(/^\/apps\/([^/]+)(?:\/(.*))?$/);

  if (!routeMatch) return null;

  const appName = decodeURIComponent(routeMatch[1] || '').trim();
  const appSubpath = routeMatch[2] ? decodeURIComponent(routeMatch[2]) : '';

  if (!appName || appName.includes('..') || appName.includes('/')) return null;
  if (appSubpath.includes('..')) return null;

  return {
    appName,
    appSubpath,
    canonicalPath: `/apps/${appName}`,
    requestedPath: normalizedPath
  };
}

function validateAppExists(appName, options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const appDir = path.join(rootDir, 'apps', appName);
  const indexPath = path.join(appDir, 'index.html');

  return fs.existsSync(appDir) && fs.existsSync(indexPath);
}

function serveStaticApp(req, res, options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const route = resolveAppRoute(req.url || '');

  if (!route) {
    return false;
  }

  if (!validateAppExists(route.appName, { rootDir })) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('App not found');
    return true;
  }

  const safeSubpath = route.appSubpath || 'index.html';
  const appDir = path.join(rootDir, 'apps', route.appName);
  const filePath = path.join(appDir, safeSubpath);
  const normalizedAppDir = path.resolve(appDir);
  const normalizedFilePath = path.resolve(filePath);

  if (!normalizedFilePath.startsWith(normalizedAppDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return true;
  }

  if (!fs.existsSync(normalizedFilePath) || fs.statSync(normalizedFilePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('File not found');
    return true;
  }

  const extension = path.extname(normalizedFilePath);
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
  }[extension] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=300'
  });

  fs.createReadStream(normalizedFilePath).pipe(res);
  return true;
}

module.exports = {
  resolveAppRoute,
  serveStaticApp,
  validateAppExists
};
