/**
 * MODULE_CONTRACT
 * Inputs: block type (string), block content (object), block candidate for validation
 * Outputs: structured block objects and validation results
 * Functions: createBlock(), validateBlock()
 * Constraints: deterministic output, no raw/untyped content, supports text/link/note/3d(STL)
 */
(function (global) {
  'use strict';

  var SUPPORTED_TYPES = ['text', 'link', 'note', '3d', 'file'];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function fail(code, message) {
    var error = new Error(message || code);
    error.code = code;
    throw error;
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function sanitizeContent(type, content) {
    if (!isObject(content)) {
      fail('BLOCK_CONTENT_OBJECT_REQUIRED', 'Block content must be an object.');
    }

    if (type === 'text' || type === 'note') {
      if (typeof content.value !== 'string' || content.value.trim() === '') {
        fail('BLOCK_CONTENT_VALUE_REQUIRED', 'Text and note blocks require a non-empty content.value string.');
      }
      return { value: content.value };
    }

    if (type === 'link') {
      if (typeof content.href !== 'string' || content.href.trim() === '') {
        fail('BLOCK_LINK_HREF_REQUIRED', 'Link blocks require a non-empty content.href string.');
      }
      return {
        href: content.href,
        label: typeof content.label === 'string' ? content.label : ''
      };
    }

    if (type === 'file') {
      if (typeof content.name !== 'string' || content.name.trim() === '') fail('BLOCK_FILE_NAME_REQUIRED', 'File blocks require a non-empty content.name string.');
      if (typeof content.normalizedType !== 'string' || content.normalizedType.trim() === '') fail('BLOCK_FILE_TYPE_REQUIRED', 'File blocks require content.normalizedType.');
      return { name: content.name, type: content.normalizedType, normalizedType: content.normalizedType };
    }

    if (type === '3d') {
      if (content.format !== 'stl') {
        fail('BLOCK_3D_FORMAT_UNSUPPORTED', '3d blocks require content.format to be "stl".');
      }
      if (typeof content.source !== 'string' || content.source.trim() === '') {
        fail('BLOCK_3D_SOURCE_REQUIRED', '3d blocks require a non-empty content.source string.');
      }
      return {
        format: 'stl',
        source: content.source,
        units: typeof content.units === 'string' ? content.units : 'mm'
      };
    }

    fail('BLOCK_TYPE_UNSUPPORTED', 'Unsupported block type: ' + type);
  }

  function createBlock(type, content) {
    if (SUPPORTED_TYPES.indexOf(type) === -1) {
      fail('BLOCK_TYPE_UNSUPPORTED', 'Unsupported block type: ' + type);
    }

    return {
      type: type,
      content: sanitizeContent(type, content)
    };
  }

  function validateBlock(block) {
    if (!isObject(block)) return false;
    if (typeof block.type !== 'string') return false;
    if (SUPPORTED_TYPES.indexOf(block.type) === -1) return false;

    try {
      var normalized = createBlock(block.type, block.content);
      return JSON.stringify(normalized) === JSON.stringify(clone(block));
    } catch (error) {
      return false;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createBlock: createBlock,
      validateBlock: validateBlock,
      SUPPORTED_TYPES: SUPPORTED_TYPES.slice()
    };
  }

  global.AlchemistBlockSystem = {
    createBlock: createBlock,
    validateBlock: validateBlock,
    SUPPORTED_TYPES: SUPPORTED_TYPES.slice()
  };
})(typeof window !== 'undefined' ? window : globalThis);
