'use strict';

const assert = require('assert');
const { createManifest, createZayPackage, FORMAT_VERSION } = require('./zay-compiler.js');

(function runTests() {
  const session = {
    id: 'sess_1900000000001',
    name: 'Catalyst Review',
    state: 'finalized',
    createdAt: 1900000000001,
    updatedAt: 1900000000010,
    finalizedAt: 1900000000010,
    blocks: [
      { id: 'blk_2', type: 'note', content: { value: 'B' } },
      { id: 'blk_1', type: 'text', content: { value: 'A' } }
    ]
  };

  const manifest = createManifest(session, { generatedAt: 1900000000015, version: '1.1.0' });
  assert.equal(manifest.compiler, FORMAT_VERSION);
  assert.equal(manifest.generatedAt, 1900000000015);
  assert.deepEqual(manifest.includes, ['manifest.json', 'content/session.json', 'assets/index.json', 'state/session-state.json']);

  const pkgA = createZayPackage(session, { generatedAt: 1900000000015, version: '1.1.0' });
  const pkgB = createZayPackage(JSON.parse(JSON.stringify(session)), { generatedAt: 1900000000015, version: '1.1.0' });

  assert.equal(pkgA.fileName, 'sess_1900000000001.zay');
  assert.equal(pkgA.bytes, pkgB.bytes);
  assert.deepEqual(pkgA.entries.map((item) => item.path), [
    'assets/index.json',
    'content/session.json',
    'manifest.json',
    'state/session-state.json'
  ]);

  assert.throws(
    () => createZayPackage({ state: 'reviewing', blocks: [] }),
    (err) => err && err.code === 'ZAY_SESSION_NOT_FINALIZED'
  );

  assert.throws(
    () => createManifest({ state: 'finalized' }),
    (err) => err && err.code === 'ZAY_SESSION_BLOCKS_REQUIRED'
  );

  console.log('zay-compiler tests passed');
})();
