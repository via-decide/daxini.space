'use strict';

const assert = require('assert');
const { createSessionEngine } = require('./session-engine.js');

function createMemoryStorage() {
  const db = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(db, k) ? db[k] : null),
    setItem: (k, v) => { db[k] = v; },
    removeItem: (k) => { delete db[k]; }
  };
}

(function runTests() {
  const storage = createMemoryStorage();
  let t = 1700000000000;
  const engine = createSessionEngine({ storage, now: () => (t += 1), storageKey: 'test_sessions' });

  const session = engine.startSession('Draft A');
  assert.equal(session.state, engine.SESSION_STATES.ACTIVE);
  assert.equal(session.name, 'Draft A');

  const mutated = { id: 'b1', content: 'first' };
  engine.addBlock(mutated);
  mutated.content = 'changed outside';
  assert.equal(engine.getSession().blocks[0].content, 'first');

  engine.addBlock({ id: 'b2', content: 'second' });
  assert.throws(() => engine.addBlock({ id: 'b2', content: 'dup' }), /SESSION_BLOCK_DUPLICATE_ID/);

  engine.removeBlock('b1');
  assert.equal(engine.getSession().blocks.length, 1);
  assert.throws(() => engine.removeBlock('missing'), /SESSION_BLOCK_NOT_FOUND/);

  engine.setReviewing();
  assert.equal(engine.getSession().state, engine.SESSION_STATES.REVIEWING);
  assert.throws(() => engine.addBlock({ id: 'b3' }), /SESSION_NOT_ACTIVE/);

  const finalized = engine.finalizeSession();
  assert.equal(finalized.state, engine.SESSION_STATES.FINALIZED);
  assert.ok(finalized.finalizedAt > 0);

  const next = engine.startSession('Draft B');
  assert.equal(next.name, 'Draft B');
  assert.equal(next.state, engine.SESSION_STATES.ACTIVE);

  const reloaded = createSessionEngine({ storage, storageKey: 'test_sessions' });
  assert.equal(reloaded.getSession().state, reloaded.SESSION_STATES.ACTIVE);
  reloaded.reset();
  assert.equal(reloaded.getSession(), null);

  console.log('session-engine tests passed');
})();
