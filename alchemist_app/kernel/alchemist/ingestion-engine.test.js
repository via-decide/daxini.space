'use strict';

const assert = require('assert');
const { createBlock } = require('./block-system.js');
const { createSessionEngine } = require('./session-engine.js');
const { createIngestionEngine, parseInput } = require('./ingestion-engine.js');

function createMemoryStorage() {
  const db = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(db, k) ? db[k] : null),
    setItem: (k, v) => { db[k] = v; },
    removeItem: (k) => { delete db[k]; }
  };
}

(function runTests() {
  const parsedText = parseInput({ type: 'text', payload: { value: ' <b>Hello</b> ' } });
  assert.deepEqual(parsedText, { type: 'text', content: { value: '&lt;b&gt;Hello&lt;/b&gt;' } });

  assert.throws(() => parseInput({ type: 'text', payload: { value: '' } }), (err) => err && err.code === 'INGEST_VALUE_REQUIRED');
  assert.throws(() => parseInput({ type: 'unknown', payload: {} }), (err) => err && err.code === 'INGEST_TYPE_UNSUPPORTED');

  const storage = createMemoryStorage();
  let t = 1800000000000;
  const sessionEngine = createSessionEngine({ storage, now: () => ++t, storageKey: 'ingestion_test' });
  sessionEngine.startSession('Ingestion Session');

  const ingestion = createIngestionEngine({
    blockSystem: { createBlock },
    sessionEngine,
    now: () => ++t
  });

  const result = ingestion.ingest({ type: 'note', payload: { value: 'Reactant log' } });
  assert.equal(result.block.type, 'note');
  assert.equal(result.session.blocks.length, 1);
  assert.equal(result.session.blocks[0].id, result.blockId);

  const link = ingestion.ingest({ type: 'link', payload: { href: 'https://example.com', label: '<script>x</script>' } });
  assert.equal(link.block.content.label, '&lt;script&gt;x&lt;/script&gt;');
  assert.equal(sessionEngine.getSession().blocks.length, 2);

  const epub = ingestion.ingest({ type: 'file', payload: { name: 'Book.EPUB', type: '' } });
  assert.equal(epub.block.content.normalizedType, 'application/epub+zip');
  assert.equal(sessionEngine.getSession().blocks.length, 3);
  assert.throws(() => parseInput({ type: 'file', payload: { name: 'x.bin', type: '' } }), (err) => err && err.code === 'INGEST_FILE_TYPE_UNSUPPORTED');

  console.log('ingestion-engine tests passed');
})();
