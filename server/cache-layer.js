'use strict';

const zlib = require('node:zlib');

const STATIC_RE = /\.(?:css|js|mjs|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|map)$/i;

function cacheHeaders(pathname = '') {
  const immutable = STATIC_RE.test(pathname);
  return { 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300, stale-while-revalidate=60', 'CDN-Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=600' };
}

function applyPerformanceHeaders(res, pathname = '') {
  res.setHeader('Vary', 'Accept-Encoding');
  Object.entries(cacheHeaders(pathname)).forEach(([k, v]) => res.setHeader(k, v));
}

function gzipIfAccepted(req, res) {
  if (!/\bgzip\b/i.test(req.headers?.['accept-encoding'] || '')) return null;
  res.setHeader('Content-Encoding', 'gzip');
  return zlib.createGzip({ level: 6 });
}

module.exports = { applyPerformanceHeaders, gzipIfAccepted, cacheHeaders };
