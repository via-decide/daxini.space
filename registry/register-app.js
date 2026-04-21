'use strict';

const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { AppRegistry, normalizeSlug } = require('./app-registry');
const VersionTracker = require('../logichub/src/versioning/version-tracker');

const ALLOWED_CATEGORIES = new Set([
  'research',
  'creator tools',
  'game dev',
  'analysis',
  'utilities',
  'simulations'
]);

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += String(chunk || '');
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function createRegisterAppHandler(options = {}) {
  const registry = new AppRegistry(options);
  const rootDir = options.rootDir || process.cwd();

  async function persistDeploymentBundle(slug, version, bundle, metadata = {}) {
    const versionTag = String(version || '1.0.0').trim() || '1.0.0';
    const appRoot = path.join(rootDir, 'apps', slug);
    const versionDir = path.join(appRoot, `v${versionTag}`);
    const latestDir = path.join(appRoot, 'latest');
    await fsPromises.mkdir(versionDir, { recursive: true });
    await fsPromises.mkdir(latestDir, { recursive: true });
    await fsPromises.writeFile(path.join(versionDir, 'bundle.json'), `${JSON.stringify(bundle || {}, null, 2)}\n`, 'utf8');
    await fsPromises.writeFile(path.join(versionDir, 'metadata.json'), `${JSON.stringify(metadata || {}, null, 2)}\n`, 'utf8');
    await fsPromises.copyFile(path.join(versionDir, 'bundle.json'), path.join(latestDir, 'bundle.json'));
    await fsPromises.copyFile(path.join(versionDir, 'metadata.json'), path.join(latestDir, 'metadata.json'));
    return {
      bundle_path: `/apps/${slug}/latest/bundle.json`,
      metadata_path: `/apps/${slug}/latest/metadata.json`
    };
  }

  return async function registerAppHandler(req, res) {
    const method = (req.method || 'GET').toUpperCase();
    const urlPath = (req.url || '').split('?')[0];

    const isRegisterRoute = urlPath === '/api/register-app';
    const isDeployRoute = urlPath === '/api/deploy';
    if (method !== 'POST' || (!isRegisterRoute && !isDeployRoute)) {
      return false;
    }

    try {
      const payload = await parseJsonBody(req);
      const appName = payload.app_name || payload.name;
      const slug = normalizeSlug(payload.slug || appName);
      const category = String(payload.category || 'utilities').trim().toLowerCase();

      if (!appName || !payload.creator) {
        sendJson(res, 400, { error: 'app_name/name and creator are required' });
        return true;
      }

      if (!slug) {
        sendJson(res, 400, { error: 'slug is required' });
        return true;
      }

      if (!ALLOWED_CATEGORIES.has(category)) {
        sendJson(res, 400, {
          error: 'invalid category',
          allowed_categories: Array.from(ALLOWED_CATEGORIES)
        });
        return true;
      }

      const version = payload.version || '1.0.0';
      const bundlePointer = await persistDeploymentBundle(slug, version, payload.bundle || payload.code || {}, payload.metadata || {});
      const updatedIndex = await registry.register({
        id: slug,
        slug,
        name: appName,
        creator: payload.creator,
        description: payload.description || (payload.metadata && payload.metadata.description) || '',
        category,
        runtime: 'edge-runtime',
        deployment_url: `/apps/${slug}`,
        bundle_path: bundlePointer.bundle_path,
        metadata_path: bundlePointer.metadata_path,
        subdomain: payload.subdomain || null,
        version
      });

      const tracker = new VersionTracker(slug);
      await tracker.captureVersion({
        code: payload.code || '',
        config: payload.config || {},
        assets: payload.assets || [],
        dependencies: payload.dependencies || {}
      }, {
        creator: payload.creator,
        changes: payload.changes || ['feature: Published app update'],
        changelog: payload.changelog || `Published ${appName}` ,
        version
      });
      await tracker.publishVersion(version);

      sendJson(res, 201, {
        success: true,
        app: updatedIndex.apps.find((entry) => entry.slug === slug),
        total_apps: updatedIndex.apps.length
      });

      return true;
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'register app failed' });
      return true;
    }
  };
}

module.exports = {
  ALLOWED_CATEGORIES,
  createRegisterAppHandler
};
