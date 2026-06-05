/**
 * MODULE_CONTRACT
 * Inputs: finalized session object, options ({ generatedAt, version })
 * Outputs: deterministic .zay package blueprint ({ fileName, entries, manifest, bytes })
 * Functions: createZayPackage(), createManifest()
 * Constraints: finalized sessions only, no partial export, includes manifest/content/assets/state paths
 */
(function (global) {
  'use strict';

  var FORMAT_VERSION = 'ALCHEMIST_ZAY_COMPILER_V1';

  function fail(code, message) {
    var error = new Error(message || code);
    error.code = code;
    throw error;
  }

  function stableClone(value) {
    if (Array.isArray(value)) return value.map(stableClone);
    if (!value || typeof value !== 'object') return value;
    var out = {};
    Object.keys(value).sort().forEach(function (key) {
      out[key] = stableClone(value[key]);
    });
    return out;
  }

  function stableStringify(value) {
    return JSON.stringify(stableClone(value), null, 2);
  }

  function assertFinalizedSession(session) {
    if (!session || typeof session !== 'object') fail('ZAY_SESSION_REQUIRED', 'Session object is required.');
    if (session.state !== 'finalized') fail('ZAY_SESSION_NOT_FINALIZED', 'Only finalized sessions can compile.');
    if (!Array.isArray(session.blocks)) fail('ZAY_SESSION_BLOCKS_REQUIRED', 'Session blocks array is required.');
  }

  function createManifest(session, options) {
    assertFinalizedSession(session);
    var config = options || {};
    var generatedAt = Number.isFinite(config.generatedAt) ? config.generatedAt : session.finalizedAt;

    return {
      format: '.zay',
      compiler: FORMAT_VERSION,
      version: config.version || '1.0.0',
      generatedAt: generatedAt,
      session: {
        id: session.id,
        name: session.name,
        state: session.state,
        createdAt: session.createdAt,
        finalizedAt: session.finalizedAt,
        blockCount: session.blocks.length
      },
      includes: ['manifest.json', 'content/session.json', 'assets/index.json', 'state/session-state.json']
    };
  }

  function createZayPackage(session, options) {
    assertFinalizedSession(session);
    var config = options || {};
    var manifest = createManifest(session, config);
    var safeSession = stableClone(session);

    var entries = [
      { path: 'assets/index.json', content: stableStringify({ assets: [], count: 0 }) },
      { path: 'content/session.json', content: stableStringify({ blocks: safeSession.blocks, sessionId: safeSession.id }) },
      { path: 'manifest.json', content: stableStringify(manifest) },
      { path: 'state/session-state.json', content: stableStringify({ state: safeSession.state, updatedAt: safeSession.updatedAt }) }
    ].sort(function (a, b) { return a.path.localeCompare(b.path); });

    var payload = entries.map(function (entry) {
      return '--- ' + entry.path + '\n' + entry.content;
    }).join('\n');

    return {
      fileName: (safeSession.id || 'session') + '.zay',
      manifest: manifest,
      entries: entries,
      bytes: payload
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createManifest: createManifest,
      createZayPackage: createZayPackage,
      FORMAT_VERSION: FORMAT_VERSION
    };
  }

  global.AlchemistZayCompiler = {
    createManifest: createManifest,
    createPackage: createZayPackage,
    FORMAT_VERSION: FORMAT_VERSION
  };
})(typeof window !== 'undefined' ? window : globalThis);
