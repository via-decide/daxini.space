'use strict';

(function bootstrapMarketplace(global) {
  const VALID_SORTS = ['popularity', 'recent'];

  function readIndex(indexUrl = '/registry/app-index.json') {
    const cached = window.DaxiniCache ? window.DaxiniCache.get(indexUrl) : null;
    if (cached) {
      console.log(`[DaxiniCache] Hit for listings index: ${indexUrl}`);
      if (window.logTelemetryMetric) {
        window.logTelemetryMetric('cache_hit', { source: 'marketplace_index', url: indexUrl });
      }
      return Promise.resolve(cached);
    }
    
    if (window.logTelemetryMetric) {
      window.logTelemetryMetric('cache_miss', { source: 'marketplace_index', url: indexUrl });
    }

    return fetch(indexUrl, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load registry (${response.status})`);
        return response.json();
      })
      .then((payload) => {
        const apps = Array.isArray(payload.apps) ? payload.apps : [];
        if (window.DaxiniCache && apps.length > 0) {
          window.DaxiniCache.set(indexUrl, apps, 15); // Cache index listings for 15 mins
        }
        return apps;
      });
  }

  function applyFilters(apps, filters) {
    return apps
      .filter((app) => {
        if (filters.category && app.category !== filters.category) return false;
        if (filters.creator && String(app.creator).toLowerCase() !== filters.creator.toLowerCase()) return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const nameMatch = (app.name || '').toLowerCase().includes(q);
          const descMatch = (app.description || app.desc || '').toLowerCase().includes(q);
          const tagsMatch = Array.isArray(app.tags) && app.tags.some(t => String(t).toLowerCase().includes(q));
          if (!nameMatch && !descMatch && !tagsMatch) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (filters.sort === 'popularity') return Number(b.popularity || 0) - Number(a.popularity || 0);
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
  }

  function collectCategories(apps) {
    return Array.from(new Set(apps.map((app) => app.category).filter(Boolean))).sort();
  }

  function createFilterBar(state, apps, refresh) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;width:100%';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search products...';
    searchInput.style.cssText = 'padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:#fff;font-size:0.85rem;flex:1;min-width:180px;outline:none';
    searchInput.addEventListener('input', () => {
      state.search = searchInput.value.trim();
      refresh();
    });

    const categorySelect = document.createElement('select');
    categorySelect.style.cssText = 'padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:#fff;font-size:0.85rem;outline:none;cursor:pointer';
    categorySelect.innerHTML = `<option value="">All categories</option>${collectCategories(apps).map((value) => `<option value="${value}">${value}</option>`).join('')}`;
    categorySelect.addEventListener('change', () => {
      state.category = categorySelect.value;
      refresh();
    });

    const creatorInput = document.createElement('input');
    creatorInput.type = 'search';
    creatorInput.placeholder = 'Filter by creator';
    creatorInput.style.cssText = 'padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:#fff;font-size:0.85rem;outline:none';
    creatorInput.addEventListener('input', () => {
      state.creator = creatorInput.value.trim();
      refresh();
    });

    const sortSelect = document.createElement('select');
    sortSelect.style.cssText = 'padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:#fff;font-size:0.85rem;outline:none;cursor:pointer';
    sortSelect.innerHTML = VALID_SORTS.map((value) => `<option value="${value}">${value}</option>`).join('');
    sortSelect.value = state.sort;
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      refresh();
    });

    wrapper.append(searchInput, categorySelect, creatorInput, sortSelect);
    return wrapper;
  }

  function renderMarketplace(container, apps, options = {}) {
    const state = {
      category: '',
      creator: '',
      search: '',
      sort: VALID_SORTS.includes(options.defaultSort) ? options.defaultSort : 'recent'
    };

    const list = document.createElement('section');
    list.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px';

    const redraw = () => {
      list.innerHTML = '';
      const filtered = applyFilters(apps, state);
      filtered.forEach((app) => {
        const card = global.DaxiniMarketplaceCard.createAppCard(app, {
          onLaunch: (entry) => global.DaxiniAppLauncher.launchApp(entry, options),
          onDuplicate: options.onDuplicate || (() => {}),
          onInstall: (entry) => global.DaxiniAppLauncher.installToWorkspace(entry, options)
        });
        list.appendChild(card);
      });
    };

    container.innerHTML = '';
    container.append(createFilterBar(state, apps, redraw), list);
    redraw();
  }

  async function mountMarketplace(target, options = {}) {
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) throw new Error('Marketplace target not found');
    const apps = await readIndex(options.indexUrl);
    renderMarketplace(container, apps, options);
    return { apps_loaded: apps.length };
  }

  global.DaxiniMarketplaceUI = {
    mountMarketplace,
    renderMarketplace,
    readIndex,
    applyFilters
  };
})(window);
