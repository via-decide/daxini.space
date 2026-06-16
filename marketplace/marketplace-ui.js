'use strict';

(function bootstrapMarketplace(global) {
  const VALID_SORTS = ['popularity', 'recent'];

  function readIndex(indexUrl = '/registry/app-index.json') {
    return fetch(indexUrl, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load registry (${response.status})`);
        return response.json();
      })
      .then((payload) => (Array.isArray(payload.apps) ? payload.apps : []));
  }

  function applyFilters(apps, filters) {
    return apps
      .filter((app) => {
        if (filters.category && app.category !== filters.category) return false;
        if (filters.creator && String(app.creator).toLowerCase() !== filters.creator.toLowerCase()) return false;
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
    wrapper.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px';

    const categorySelect = document.createElement('select');
    categorySelect.innerHTML = `<option value="">All categories</option>${collectCategories(apps).map((value) => `<option value="${value}">${value}</option>`).join('')}`;
    categorySelect.addEventListener('change', () => {
      state.category = categorySelect.value;
      refresh();
    });

    const creatorInput = document.createElement('input');
    creatorInput.type = 'search';
    creatorInput.placeholder = 'Filter by creator';
    creatorInput.addEventListener('input', () => {
      state.creator = creatorInput.value.trim();
      refresh();
    });

    const sortSelect = document.createElement('select');
    sortSelect.innerHTML = VALID_SORTS.map((value) => `<option value="${value}">${value}</option>`).join('');
    sortSelect.value = state.sort;
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      refresh();
    });

    wrapper.append(categorySelect, creatorInput, sortSelect);
    return wrapper;
  }

  function renderMarketplace(container, apps, options = {}) {
    const state = {
      category: '',
      creator: '',
      sort: VALID_SORTS.includes(options.defaultSort) ? options.defaultSort : 'recent'
    };

    const list = document.createElement('section');
    list.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px';

    const redraw = () => {
      list.innerHTML = '';
      const filtered = applyFilters(apps, state);
      filtered.forEach((app) => {
        const card = global.DaxiniMarketplaceCard.createAppCard(app, {
          isIndia: options.isIndia,
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
    
    // Check Eligibility / Geofence
    try {
      const eligibilityUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000/api/eligibility'
        : 'https://logichub.app/api/eligibility';
      const res = await fetch(eligibilityUrl);
      const data = await res.json();
      if ((data.models || []).includes('UPI_LIFETIME_ONLY')) {
        options.isIndia = true;
      } else {
        options.isIndia = false;
      }
    } catch(e) {
      console.warn('Geofencing check failed, defaulting to unrestricted browsing.');
      options.isIndia = false;
    }

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
