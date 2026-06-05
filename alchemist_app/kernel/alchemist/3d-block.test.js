'use strict';

const assert = require('assert');
const { createSessionEngine } = require('./session-engine.js');
const { create3DBlock, add3DBlockToSession } = require('./3d-block.js');

(function runTests() {
  const block = create3DBlock('block_3d_1', 'models/methane.stl', { rotate: true, zoom: false });
  assert.deepEqual(block, {
    id: 'block_3d_1',
    type: '3d',
    model: 'models/methane.stl',
    interaction: { rotate: true, zoom: false }
  });

  const defaults = create3DBlock('block_3d_2', 'models/benzene.stl');
  assert.deepEqual(defaults.interaction, { rotate: true, zoom: true });

  assert.throws(() => create3DBlock('', 'models/x.stl'), (err) => err && err.code === 'BLOCK_3D_ID_REQUIRED');
  assert.throws(() => create3DBlock('x', 'models/x.obj'), (err) => err && err.code === 'BLOCK_3D_MODEL_STL_REQUIRED');
  assert.throws(() => create3DBlock('x', 'models/x.stl', 'rotate'), (err) => err && err.code === 'BLOCK_3D_INTERACTION_OBJECT_REQUIRED');

  const storage = {
    value: null,
    getItem() { return this.value; },
    setItem(_, payload) { this.value = payload; },
    removeItem() { this.value = null; }
  };

  const engine = createSessionEngine({ storage, now: () => 1700000000000 });
  engine.startSession('3D Lab');
  const updatedSession = add3DBlockToSession(engine, block);

  assert.equal(updatedSession.blocks.length, 1);
  assert.deepEqual(updatedSession.blocks[0], block);

  assert.throws(() => add3DBlockToSession({}, block), (err) => err && err.code === 'SESSION_ENGINE_REQUIRED');
  assert.throws(() => add3DBlockToSession(engine, { id: 'bad', type: 'text' }), (err) => err && err.code === 'BLOCK_3D_INVALID');

  console.log('3d-block tests passed');
})();
