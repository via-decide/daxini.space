'use strict';

const assert = require('assert');
const { createSessionEngine } = require('./session-engine.js');
const { createBlock } = require('./block-system.js');
const { createIngestionEngine } = require('./ingestion-engine.js');
const { create3DBlock, add3DBlockToSession } = require('./3d-block.js');
const { createUIIntegrationLayer } = require('./ui-integration.js');

function createMemoryStorage() {
  const db = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(db, k) ? db[k] : null),
    setItem: (k, v) => { db[k] = v; },
    removeItem: (k) => { delete db[k]; }
  };
}

function createEmitter() {
  const handlers = {};
  return {
    addEventListener(name, fn) { handlers[name] = handlers[name] || []; handlers[name].push(fn); },
    removeEventListener(name, fn) { handlers[name] = (handlers[name] || []).filter((item) => item !== fn); },
    emit(name, detail) { (handlers[name] || []).forEach((fn) => fn({ detail })); }
  };
}

(function runTests() {
  const storage = createMemoryStorage();
  let t = 1800000000000;
  const sessionEngine = createSessionEngine({ storage, now: () => ++t, storageKey: 'ui_integration_test' });
  const ingestionEngine = createIngestionEngine({
    blockSystem: { createBlock },
    sessionEngine,
    now: () => ++t
  });

  const layer = createUIIntegrationLayer({
    sessionEngine,
    ingestionEngine,
    threeDBlock: { create: create3DBlock, addToSession: add3DBlockToSession }
  });

  const first = layer.routeSelection({ contentType: 'note', payload: { value: 'Catalyst memo' } });
  assert.equal(first.ok, true);
  assert.equal(first.block.type, 'note');
  assert.equal(sessionEngine.getSession().blocks.length, 1);

  const with3D = layer.routeSelection({
    contentType: 'text',
    payload: { value: 'attach model' },
    attach3D: true,
    modelPath: 'models/lab.stl',
    interaction: { rotate: false, zoom: true }
  });
  assert.equal(with3D.ok, true);
  assert.equal(with3D.optional3D.type, '3d');
  assert.equal(sessionEngine.getSession().blocks.length, 3);

  const emitter = createEmitter();
  layer.connectSelection(emitter);
  emitter.emit('alchemist:selection', { contentType: 'note', payload: { value: 'from-event' } });
  assert.equal(sessionEngine.getSession().blocks.length, 4);

  layer.connectSessionEnd(emitter);
  emitter.emit('alchemist:session:end', {});
  assert.equal(sessionEngine.getSession().state, sessionEngine.SESSION_STATES.FINALIZED);

  const passiveLayer = createUIIntegrationLayer({ sessionEngine, ingestionEngine });
  const failed = passiveLayer.routeSelection(null);
  assert.equal(failed.ok, false);

  layer.disconnect();

  console.log('ui-integration tests passed');
})();
