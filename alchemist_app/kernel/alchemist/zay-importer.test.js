'use strict';

const assert = require('assert');
const { createZayPackage } = require('./zay-compiler.js');
const { parseZayPackage, extractBlocks, toVaultFormat, detectFormat, validateManifest, validateV2Meta } = require('./zay-importer.js');

(function runTests() {

  // ====== FORMAT DETECTION ======

  assert.equal(detectFormat('--- manifest.json\n{}'), 'sections');
  assert.equal(detectFormat('{"meta":{}}'), 'json');
  assert.equal(detectFormat('[{"id":"A_001"}]'), 'json');
  assert.equal(detectFormat('random garbage'), 'unknown');

  // ====== V1 ROUNDTRIP: compile → export → import ======

  const session = {
    id: 'sess_test_001',
    name: 'Kinetics Review',
    state: 'finalized',
    createdAt: 1700000000001,
    updatedAt: 1700000000010,
    finalizedAt: 1700000000010,
    blocks: [
      { id: 'b1', type: 'text', content: { value: 'Rate law governs kinetics' } },
      { id: 'b2', type: 'note', content: { value: 'Remember: Ea is independent of T' } }
    ]
  };

  // Compile to .zay
  const pkg = createZayPackage(session, { generatedAt: 1700000000020, version: '1.0.0' });
  assert.ok(pkg.bytes.length > 0, 'Package should have bytes');
  assert.equal(pkg.fileName, 'sess_test_001.zay');

  // Import the .zay
  const imported = parseZayPackage(pkg.bytes);
  assert.equal(imported._format, 'v1');
  assert.ok(imported.manifest, 'Should have manifest');
  assert.equal(imported.manifest.compiler, 'ALCHEMIST_ZAY_COMPILER_V1');
  assert.equal(imported.manifest.session.id, 'sess_test_001');
  assert.equal(imported.manifest.session.blockCount, 2);

  // Extract blocks
  const blocks = extractBlocks(imported);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].id, 'b1');
  assert.equal(blocks[1].content.value, 'Remember: Ea is independent of T');

  // Convert to vault format
  const vault = toVaultFormat(imported);
  assert.equal(vault.length, 2);
  assert.equal(vault[0].set, 'IMPORTED');
  assert.equal(vault[0]._source, 'zay-import');
  assert.equal(vault[0]._sourceSession, 'sess_test_001');
  assert.equal(vault[0].q, 'Rate law governs kinetics');

  // ====== V2 JSON FORMAT ======

  const v2Content = JSON.stringify({
    meta: { version: '2.0', engine: 'zayvora', type: 'study-session', created: Date.now(), sessionId: 'SES_ABC12' },
    content: {
      blocks: [
        { type: 'question', title: 'Q1', body: { question: 'What is Ea?', answer: 'Activation energy', domain: 'Physical Chemistry', logic: 'Energy barrier for reaction' } },
        { type: 'question', title: 'Q2', body: { question: 'SN2 result?', answer: 'Inversion', domain: 'Organic Chemistry', logic: 'Backside attack' } }
      ]
    }
  });

  const v2Imported = parseZayPackage(v2Content);
  assert.equal(v2Imported._format, 'v2');
  assert.equal(v2Imported.meta.engine, 'zayvora');
  assert.equal(v2Imported.meta.sessionId, 'SES_ABC12');

  const v2Blocks = extractBlocks(v2Imported);
  assert.equal(v2Blocks.length, 2);

  const v2Vault = toVaultFormat(v2Imported);
  assert.equal(v2Vault.length, 2);
  assert.equal(v2Vault[0].q, 'What is Ea?');
  assert.equal(v2Vault[0].correct, 'Activation energy');
  assert.equal(v2Vault[0].dom, 'Physical Chemistry');
  assert.equal(v2Vault[0].logic, 'Energy barrier for reaction');
  assert.equal(v2Vault[0]._sourceSession, 'SES_ABC12');
  assert.equal(v2Vault[1].q, 'SN2 result?');

  // ====== VAULT-PASSTHROUGH FORMAT ======

  const passthroughContent = JSON.stringify({
    meta: { version: '2.0', engine: 'zayvora', type: 'vault-export', sessionId: 'SES_PASS' },
    content: {
      blocks: [
        { q: 'What is pH?', correct: 'Negative log of H+ concentration', dom: 'Physical Chemistry', logic: 'pH = -log[H+]', l: 'Log of OH-', r: 'Positive log of H+' }
      ]
    }
  });

  const passImported = parseZayPackage(passthroughContent);
  const passVault = toVaultFormat(passImported);
  assert.equal(passVault[0].q, 'What is pH?');
  assert.equal(passVault[0].correct, 'Negative log of H+ concentration');
  assert.equal(passVault[0].l, 'Log of OH-');
  assert.equal(passVault[0]._source, 'zay-import');

  // ====== ERROR HANDLING ======

  assert.throws(function () { parseZayPackage(''); }, function (e) { return e.code === 'ZAY_CONTENT_EMPTY'; });
  assert.throws(function () { parseZayPackage('random garbage'); }, function (e) { return e.code === 'ZAY_FORMAT_UNKNOWN'; });

  // Invalid V1 manifest
  assert.throws(function () {
    parseZayPackage('--- manifest.json\n{"format":".wrong","compiler":"UNKNOWN"}');
  }, function (e) { return e.code === 'ZAY_MANIFEST_FORMAT_INVALID'; });

  // Invalid V2 engine
  assert.throws(function () {
    parseZayPackage(JSON.stringify({ meta: { version: '2.0', engine: 'other' } }));
  }, function (e) { return e.code === 'ZAY_ENGINE_INVALID'; });

  // Strict=false skips validation
  const lax = parseZayPackage(JSON.stringify({ meta: { version: '9.9', engine: 'future' } }), { strict: false });
  assert.equal(lax._format, 'v2');

  // ====== DETERMINISM: same input → same output ======

  const pkg2 = createZayPackage(JSON.parse(JSON.stringify(session)), { generatedAt: 1700000000020, version: '1.0.0' });
  const imported2 = parseZayPackage(pkg2.bytes);
  const vault2 = toVaultFormat(imported2);
  assert.deepEqual(vault, vault2);

  console.log('zay-importer tests passed (roundtrip V1 + V2 + passthrough + errors + determinism)');
})();
