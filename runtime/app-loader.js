'use strict';

async function loadBundle(bundlePath) {
  const response = await fetch(bundlePath, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Bundle load failed: ${response.status}`);
  return response.json();
}

async function loadRuntimeApp(options = {}) {
  const appId = options.appId || '';
  if (!appId) throw new Error('appId is required');

  const registryPath = options.registryPath || '/registry/apps-index.json';
  const registryResponse = await fetch(registryPath, { cache: 'no-store' });
  const registryPayload = registryResponse.ok ? await registryResponse.json() : {};
  const appRecord = registryPayload[appId];
  if (!appRecord) throw new Error(`App ${appId} is not in registry`);

  const bundle = await loadBundle(appRecord.bundle_path);
  const target = options.target || document.querySelector('[data-runtime-root]') || document.body;

  if (typeof window.DaxiniRuntimeState === 'undefined' || typeof window.DaxiniComponentRenderer === 'undefined') {
    throw new Error('Runtime dependencies missing');
  }

  const engine = window.DaxiniRuntimeState.createStateEngine(bundle.state || {});
  window.DaxiniComponentRenderer.renderBundle(target, bundle, engine.getState());
  engine.subscribe((state) => window.DaxiniComponentRenderer.renderBundle(target, bundle, state));

  return {
    appId,
    version: appRecord.version,
    state: engine.getState()
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadBundle, loadRuntimeApp };
}

if (typeof window !== 'undefined') {
  window.DaxiniAppLoader = { loadBundle, loadRuntimeApp };
}
