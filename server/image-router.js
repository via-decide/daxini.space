'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { applyPerformanceHeaders, gzipIfAccepted } = require('./cache-layer');

const IMAGES_REGISTRY_REL = path.join('apps', 'images_registry.json');

function loadImageRegistry(rootDir = process.cwd()) {
  const p = path.join(rootDir, IMAGES_REGISTRY_REL);
  if (!fs.existsSync(p)) return { apps: [], updatedAt: null, source: 'logichub-image-publish' };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { apps: [], updatedAt: null, source: 'logichub-image-publish' };
  }
}

function filterImageRegistry(registry, query = {}) {
  const apps = Array.isArray(registry.apps) ? registry.apps : [];
  const tag = query.tag;
  const q = query.q ? String(query.q).toLowerCase() : null;
  return apps.filter((app) => {
    if (tag && !(app.tags || []).includes(tag)) return false;
    if (q && !((app.name || '') + ' ' + (app.desc || '')).toLowerCase().includes(q)) return false;
    return true;
  });
}

function serveImageRegistry(req, res, opts = {}) {
  const reg = loadImageRegistry(opts.rootDir);
  const filtered = filterImageRegistry(reg, opts.query || {});
  const body = JSON.stringify({
    apps: filtered,
    updatedAt: reg.updatedAt,
    source: reg.source || 'logichub-image-publish'
  });

  applyPerformanceHeaders(res, '/apps/images_registry.json');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const gzip = gzipIfAccepted(req, res);
  res.writeHead(200);
  if (gzip) {
    gzip.end(body);
    gzip.pipe(res);
  } else {
    res.end(body);
  }
  return true;
}

module.exports = {
  IMAGES_REGISTRY_REL,
  loadImageRegistry,
  filterImageRegistry,
  serveImageRegistry
};
