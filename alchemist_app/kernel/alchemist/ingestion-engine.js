/**
 * MODULE_CONTRACT
 * Inputs: parser input ({ type, payload }), dependencies ({ blockSystem, sessionEngine })
 * Outputs: ingestion result ({ blockId, block, session })
 * Functions: createIngestionEngine(), parseInput(), ingest()
 * Constraints: no raw storage, no HTML injection, all content must pass through block system and session engine
 */
(function (global) {
  'use strict';

  function fail(code, message) {
    var error = new Error(message || code);
    error.code = code;
    throw error;
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeString(value, fieldCode) {
    if (typeof value !== 'string') fail(fieldCode, 'Expected string input.');
    var trimmed = value.trim();
    if (trimmed === '') fail(fieldCode, 'Input cannot be empty.');
    return escapeHtml(trimmed);
  }

  var SUPPORTED_TYPES = ['application/pdf', 'text/plain', 'text/markdown', 'application/epub+zip'];

  function normalizeFilePayload(payload) {
    var name = sanitizeString(payload.name, 'INGEST_FILE_NAME_REQUIRED');
    var rawType = typeof payload.type === 'string' ? payload.type.trim().toLowerCase() : '';
    var fallbackType = name.toLowerCase().endsWith('.epub') ? 'application/epub+zip' : name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : name.toLowerCase().endsWith('.md') ? 'text/markdown' : name.toLowerCase().endsWith('.txt') ? 'text/plain' : '';
    var normalizedType = rawType || fallbackType;
    if (!SUPPORTED_TYPES.includes(normalizedType)) fail('INGEST_FILE_TYPE_UNSUPPORTED', 'Unsupported file type: ' + (normalizedType || 'unknown'));
    return { name: name, type: normalizedType, normalizedType: normalizedType };
  }

  function parseInput(input) {
    if (!input || typeof input !== 'object') fail('INGEST_INPUT_REQUIRED', 'Input object required.');
    if (typeof input.type !== 'string') fail('INGEST_TYPE_REQUIRED', 'Input type is required.');

    var type = input.type;
    var payload = input.payload || {};

    if (type === 'text' || type === 'note') {
      return { type: type, content: { value: sanitizeString(payload.value, 'INGEST_VALUE_REQUIRED') } };
    }

    if (type === 'link') {
      return {
        type: 'link',
        content: {
          href: sanitizeString(payload.href, 'INGEST_HREF_REQUIRED'),
          label: typeof payload.label === 'string' ? escapeHtml(payload.label.trim()) : ''
        }
      };
    }

    if (type === 'file') {
      return { type: 'file', content: normalizeFilePayload(payload) };
    }

    if (type === '3d') {
      return {
        type: '3d',
        content: {
          format: 'stl',
          source: sanitizeString(payload.source, 'INGEST_3D_SOURCE_REQUIRED'),
          units: typeof payload.units === 'string' && payload.units.trim() ? payload.units.trim() : 'mm'
        }
      };
    }

    fail('INGEST_TYPE_UNSUPPORTED', 'Unsupported input type: ' + type);
  }

  function createIngestionEngine(deps) {
    var config = deps || {};
    var blockSystem = config.blockSystem || global.AlchemistBlockSystem;
    var sessionEngine = config.sessionEngine;
    var now = typeof config.now === 'function' ? config.now : Date.now;

    if (!blockSystem || typeof blockSystem.createBlock !== 'function') {
      fail('INGEST_BLOCK_SYSTEM_REQUIRED', 'Block system dependency missing.');
    }
    if (!sessionEngine || typeof sessionEngine.addBlock !== 'function' || typeof sessionEngine.getSession !== 'function') {
      fail('INGEST_SESSION_ENGINE_REQUIRED', 'Session engine dependency missing.');
    }

    function ingest(input) {
      var parsed = parseInput(input);
      var block = blockSystem.createBlock(parsed.type, parsed.content);
      var blockId = 'blk_' + now();
      var sessionBlock = { id: blockId, type: block.type, content: block.content };
      var session = sessionEngine.addBlock(sessionBlock);
      return { blockId: blockId, block: sessionBlock, session: session };
    }

    return {
      parseInput: parseInput,
      ingest: ingest
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createIngestionEngine: createIngestionEngine, parseInput: parseInput };
  }

  global.AlchemistIngestionEngine = {
    create: createIngestionEngine,
    parseInput: parseInput
  };
})(typeof window !== 'undefined' ? window : globalThis);
