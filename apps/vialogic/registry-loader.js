(() => {
  'use strict';

  const PEOPLE_ROOT = './people';
  const GRID_ID = 'daxini-grid';
  const CHUNK_SIZE = 48;

  async function loadPeopleIndex() {
    const known = await fromRegistryJson();
    if (known.length) return known;

    const inferred = await fromDirectoryListing();
    if (inferred.length) return inferred;

    const fallback = await fromGitHubContentsAPI();
    return fallback;
  }

  async function fromRegistryJson() {
    try {
      const response = await fetch(`${PEOPLE_ROOT}/registry.json`, { cache: 'no-store' });
      if (!response.ok) return [];
      const data = await response.json();
      if (!Array.isArray(data)) return [];
      return data.filter(Boolean);
    } catch (_error) {
      return [];
    }
  }

  async function fromDirectoryListing() {
    try {
      const response = await fetch(`${PEOPLE_ROOT}/`, { cache: 'no-store' });
      if (!response.ok) return [];

      const html = await response.text();
      const links = [...html.matchAll(/href="([^\"]+)"/g)].map((m) => m[1]);
      const names = links
        .map((href) => href.replace(/\/$/, ''))
        .filter((href) => href && !href.includes('..') && !href.includes('.'))
        .map((href) => href.split('/').filter(Boolean).pop());

      return Array.from(new Set(names));
    } catch (_error) {
      return [];
    }
  }

  async function fromGitHubContentsAPI() {
    try {
      const response = await fetch('https://api.github.com/repos/via-decide/ViaLogic/contents/people', { cache: 'no-store' });
      if (!response.ok) return [];
      const data = await response.json();
      if (!Array.isArray(data)) return [];
      return data.filter((item) => item && item.type === 'dir').map((item) => item.name);
    } catch (_error) {
      return [];
    }
  }

  async function loadPersonaBundle(folder) {
    const basePath = `${PEOPLE_ROOT}/${folder}`;
    const [metadata, bio, logicPath] = await Promise.all([
      fetchJsonWithFallback(`${basePath}/metadata.json`),
      fetchTextWithFallback(`${basePath}/bio.md`),
      pathExists(`${basePath}/logic.js`).then((exists) => (exists ? `${basePath}/logic.js` : null))
    ]);

    return { folder, metadata, bio, logicPath };
  }

  async function fetchJsonWithFallback(url) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return {};
      return await response.json();
    } catch (_error) {
      return {};
    }
  }

  async function fetchTextWithFallback(url) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return '';
      return await response.text();
    } catch (_error) {
      return '';
    }
  }

  async function pathExists(url) {
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return response.ok;
    } catch (_error) {
      return false;
    }
  }

  async function safeExecuteLogic(logicPath, metadata, outputEl) {
    if (!logicPath) {
      outputEl.textContent = 'No logic.js found for this persona.';
      return;
    }

    outputEl.textContent = 'Executing sandboxed logic...';

    try {
      const module = await import(`${logicPath}?v=${Date.now()}`);
      const runner = typeof module.run === 'function'
        ? module.run
        : (typeof module.default === 'function' ? module.default : null);

      if (!runner) {
        outputEl.textContent = 'logic.js loaded, but no exported run/default function was found.';
        return;
      }

      const result = await runner({ metadata });
      outputEl.textContent = result == null ? 'Logic executed with no return value.' : String(result);
    } catch (error) {
      outputEl.textContent = `Logic sandbox blocked or failed: ${error.message}`;
    }
  }

  function ensureGridContainer() {
    let grid = document.getElementById(GRID_ID);
    if (grid) return grid;

    grid = document.createElement('section');
    grid.id = GRID_ID;
    grid.className = 'daxini-grid';
    document.body.appendChild(grid);
    return grid;
  }

  function virtualFrameRenderer(grid, bundles) {
    let pointer = 0;

    function paint() {
      let count = 0;

      while (pointer < bundles.length && count < CHUNK_SIZE) {
        const bundle = bundles[pointer];
        const metadata = Object.assign({}, bundle.metadata, {
          name: (bundle.metadata && bundle.metadata.name) || bundle.folder
        });

        const card = window.DaxiniRenderer.renderCard(metadata, bundle.bio);
        const runButton = card.querySelector('[data-run-logic]');
        const outputEl = card.querySelector('[data-logic-output]');

        runButton.addEventListener('click', () => {
          safeExecuteLogic(bundle.logicPath, metadata, outputEl);
        });

        grid.appendChild(card);
        pointer += 1;
        count += 1;
      }

      if (pointer < bundles.length) {
        requestAnimationFrame(paint);
      }
    }

    requestAnimationFrame(paint);
  }

  async function initDaxiniRegistryLoader() {
    const grid = ensureGridContainer();

    if (!window.DaxiniRenderer || typeof window.DaxiniRenderer.renderCard !== 'function') {
      grid.textContent = 'DaxiniRenderer unavailable. Load daxini-renderer.js first.';
      return;
    }

    grid.textContent = 'Loading personas...';

    const folders = await loadPeopleIndex();
    if (!folders.length) {
      grid.textContent = 'No /people persona folders discovered.';
      return;
    }

    const bundles = await Promise.all(folders.map(loadPersonaBundle));
    grid.textContent = '';
    virtualFrameRenderer(grid, bundles);
  }

  window.RegistryLoader = {
    initDaxiniRegistryLoader
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDaxiniRegistryLoader);
  } else {
    initDaxiniRegistryLoader();
  }
})();
