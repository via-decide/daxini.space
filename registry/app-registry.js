'use strict';

const isNode = typeof window === 'undefined';
let fsPromises;
let path;

if (isNode) {
  fsPromises = require('node:fs/promises');
  path = require('node:path');
}

const DEFAULT_INDEX = {
  apps: [],
  app_map: {},
  updated_at: null,
  source: 'logichub-publish'
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeSlug(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

class AppRegistry {
  constructor(options = {}) {
    this.indexPath = options.indexPath || (isNode
      ? path.resolve(process.cwd(), 'registry', 'app-index.json')
      : '/registry/app-index.json');
    this.appsIndexPath = options.appsIndexPath || (isNode
      ? path.resolve(process.cwd(), 'registry', 'apps-index.json')
      : '/registry/apps-index.json');
    this.fetchImpl = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  }

  async load() {
    if (!isNode) {
      if (!this.fetchImpl) return { ...DEFAULT_INDEX };
      const response = await this.fetchImpl(this.indexPath, { cache: 'no-store' });
      if (!response.ok) return { ...DEFAULT_INDEX };
      return this.normalizeIndex(await response.json());
    }

    try {
      const contents = await fsPromises.readFile(this.indexPath, 'utf8');
      return this.normalizeIndex(JSON.parse(contents));
    } catch {
      return { ...DEFAULT_INDEX };
    }
  }

  normalizeIndex(indexData = {}) {
    const appsList = Array.isArray(indexData.apps) ? indexData.apps : [];
    const appMap = (indexData.app_map && typeof indexData.app_map === 'object') ? { ...indexData.app_map } : {};
    appsList.forEach((app) => {
      const appId = String(app.id || app.slug || '').trim();
      if (!appId) return;
      appMap[appId] = {
        name: app.name || appId,
        creator: app.creator || 'unknown',
        bundle_path: app.bundle_path || `/apps/${appId}/latest/bundle.json`,
        metadata_path: app.metadata_path || `/apps/${appId}/latest/metadata.json`,
        created_at: app.created_at || nowIso(),
        version: app.version || '1.0.0',
        subdomain: app.subdomain || null
      };
    });
    return {
      ...DEFAULT_INDEX,
      ...indexData,
      apps: appsList,
      app_map: appMap
    };
  }

  async save(indexData) {
    if (!isNode) return indexData;
    const merged = {
      ...DEFAULT_INDEX,
      ...indexData,
      updated_at: nowIso()
    };
    await fsPromises.writeFile(this.indexPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
    await fsPromises.writeFile(this.appsIndexPath, `${JSON.stringify(merged.app_map || {}, null, 2)}\n`, 'utf8');
    return merged;
  }

  async register(metadata = {}) {
    const slug = normalizeSlug(metadata.slug || metadata.name || metadata.id);
    if (!slug) {
      throw new Error('App slug is required');
    }

    const indexData = await this.load();
    const apps = Array.isArray(indexData.apps) ? [...indexData.apps] : [];
    const now = nowIso();

    const record = {
      id: slug,
      slug,
      name: metadata.name || slug,
      creator: metadata.creator || 'unknown',
      category: metadata.category || 'utilities',
      description: metadata.description || '',
      version: metadata.version || '1.0',
      runtime: metadata.runtime || 'edge-runtime',
      deployment_url: metadata.deployment_url || `/apps/${slug}`,
      bundle_path: metadata.bundle_path || `/apps/${slug}/latest/bundle.json`,
      metadata_path: metadata.metadata_path || `/apps/${slug}/latest/metadata.json`,
      subdomain: metadata.subdomain || null,
      popularity: Number.isFinite(Number(metadata.popularity)) ? Number(metadata.popularity) : 0,
      installs: Number.isFinite(Number(metadata.installs)) ? Number(metadata.installs) : 0,
      created_at: metadata.created_at || now,
      updated_at: now
    };

    const existingIndex = apps.findIndex((app) => app.id === slug || app.slug === slug);
    if (existingIndex >= 0) {
      apps[existingIndex] = {
        ...apps[existingIndex],
        ...record,
        created_at: apps[existingIndex].created_at || record.created_at
      };
    } else {
      apps.push(record);
    }

    const nextIndex = {
      ...indexData,
      apps,
      app_map: {
        ...(indexData.app_map || {}),
        [slug]: {
          name: record.name,
          creator: record.creator,
          bundle_path: record.bundle_path,
          metadata_path: record.metadata_path,
          created_at: record.created_at,
          version: record.version,
          subdomain: record.subdomain
        }
      }
    };

    return this.save(nextIndex);
  }

  async list(filters = {}) {
    const indexData = await this.load();
    const apps = Array.isArray(indexData.apps) ? [...indexData.apps] : [];
    const category = filters.category ? String(filters.category).toLowerCase() : '';
    const creator = filters.creator ? String(filters.creator).toLowerCase() : '';

    let filtered = apps.filter((app) => {
      if (category && String(app.category || '').toLowerCase() !== category) return false;
      if (creator && String(app.creator || '').toLowerCase() !== creator) return false;
      return true;
    });

    if (filters.sort === 'popularity') {
      filtered.sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
    } else if (filters.sort === 'recent') {
      filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    return filtered;
  }
}

module.exports = {
  AppRegistry,
  normalizeSlug
};
