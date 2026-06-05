'use strict';

const assert = require('assert');
const { createBlock, validateBlock, SUPPORTED_TYPES } = require('./block-system.js');

(function runTests() {
  assert.deepEqual(SUPPORTED_TYPES, ['text', 'link', 'note', '3d', 'file']);

  const file = createBlock('file', { name: 'Book.EPUB', normalizedType: 'application/epub+zip' });
  assert.deepEqual(file.content, { name: 'Book.EPUB', type: 'application/epub+zip', normalizedType: 'application/epub+zip' });

  const text = createBlock('text', { value: 'hello' });
  assert.deepEqual(text, { type: 'text', content: { value: 'hello' } });

  const note = createBlock('note', { value: 'remember this' });
  assert.equal(validateBlock(note), true);

  const link = createBlock('link', { href: 'https://example.com', label: 'Example' });
  assert.equal(validateBlock(link), true);

  const model = createBlock('3d', { format: 'stl', source: 'models/cube.stl' });
  assert.deepEqual(model.content, { format: 'stl', source: 'models/cube.stl', units: 'mm' });

  assert.throws(() => createBlock('text', 'raw string'), (err) => err && err.code === 'BLOCK_CONTENT_OBJECT_REQUIRED');
  assert.throws(() => createBlock('3d', { format: 'obj', source: 'a.obj' }), (err) => err && err.code === 'BLOCK_3D_FORMAT_UNSUPPORTED');
  assert.throws(() => createBlock('unknown', { value: 'x' }), (err) => err && err.code === 'BLOCK_TYPE_UNSUPPORTED');

  assert.equal(validateBlock({ type: 'text', content: { value: '' } }), false);
  assert.equal(validateBlock({ type: 'link', content: { label: 'Missing href' } }), false);
  assert.equal(validateBlock({ type: '3d', content: { format: 'stl', source: '' } }), false);

  const untyped = { content: { value: 'missing type' } };
  assert.equal(validateBlock(untyped), false);

  console.log('block-system tests passed');
})();
