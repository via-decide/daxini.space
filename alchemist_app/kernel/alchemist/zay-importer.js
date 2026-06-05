/**
 * MODULE_CONTRACT
 * Inputs: .zay file content (string), options ({ strict, onWarning })
 * Outputs: parsed ZAY package with manifest, blocks, state, and assets
 * Functions: parseZayPackage(), validateManifest(), extractBlocks(), toVaultFormat()
 * Constraints: deterministic parsing, no mutation of input, validates structure before return, supports both V1 compiler and V2 session formats
 */
(function (global) {
  'use strict';

  var SUPPORTED_COMPILERS = ['ALCHEMIST_ZAY_COMPILER_V1'];
  var SUPPORTED_META_VERSIONS = ['1.0', '2.0'];

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function fail(code, message) {
    var error = new Error(message || code);
    error.code = code;
    throw error;
  }

  /**
   * Detects whether the .zay content is V1 (multi-section text format from zay-compiler)
   * or V2 (single JSON object from inline export in index.html)
   */
  function detectFormat(content) {
    var trimmed = content.trim();
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') return 'json';
    if (trimmed.indexOf('--- ') === 0) return 'sections';
    return 'unknown';
  }

  /**
   * Parses V1 section-based .zay format (produced by zay-compiler.js)
   * Format: "--- path/to/file.json\n{...json...}\n--- next/file.json\n{...}"
   */
  function parseSections(content) {
    var parts = content.split(/^--- /m).filter(function (p) { return p.trim().length > 0; });
    var entries = {};

    parts.forEach(function (part) {
      var newlineIndex = part.indexOf('\n');
      if (newlineIndex === -1) return;
      var path = part.substring(0, newlineIndex).trim();
      var body = part.substring(newlineIndex + 1).trim();
      try {
        entries[path] = JSON.parse(body);
      } catch (e) {
        entries[path] = body;
      }
    });

    return entries;
  }

  /**
   * Validates a manifest object from V1 format
   */
  function validateManifest(manifest) {
    if (!manifest || typeof manifest !== 'object') {
      fail('ZAY_MANIFEST_MISSING', 'Manifest is required.');
    }
    if (manifest.format !== '.zay') {
      fail('ZAY_MANIFEST_FORMAT_INVALID', 'Manifest format must be .zay');
    }
    if (SUPPORTED_COMPILERS.indexOf(manifest.compiler) === -1) {
      fail('ZAY_COMPILER_UNSUPPORTED', 'Unsupported compiler: ' + manifest.compiler);
    }
    return true;
  }

  /**
   * Validates a V2 JSON meta object
   */
  function validateV2Meta(meta) {
    if (!meta || typeof meta !== 'object') {
      fail('ZAY_META_MISSING', 'Meta object is required.');
    }
    if (meta.engine !== 'zayvora') {
      fail('ZAY_ENGINE_INVALID', 'Engine must be zayvora, got: ' + meta.engine);
    }
    if (SUPPORTED_META_VERSIONS.indexOf(meta.version) === -1) {
      fail('ZAY_VERSION_UNSUPPORTED', 'Unsupported version: ' + meta.version);
    }
    return true;
  }

  /**
   * Extracts content blocks from either format into a normalized array
   */
  function extractBlocks(parsed) {
    // V1 format: entries with content/session.json containing blocks
    if (parsed._format === 'v1' && parsed.content && Array.isArray(parsed.content.blocks)) {
      return clone(parsed.content.blocks);
    }

    // V2 format: content.blocks directly
    if (parsed._format === 'v2' && parsed.content && Array.isArray(parsed.content.blocks)) {
      return clone(parsed.content.blocks);
    }

    return [];
  }

  /**
   * Converts parsed .zay data into MASTER_VAULT-compatible question format
   * This enables cross-product import: Alchemist → StudyOS, PrepOS
   */
  function toVaultFormat(parsed) {
    var blocks = extractBlocks(parsed);
    var sessionId = null;

    if (parsed._format === 'v1' && parsed.manifest && parsed.manifest.session) {
      sessionId = parsed.manifest.session.id;
    } else if (parsed._format === 'v2' && parsed.meta) {
      sessionId = parsed.meta.sessionId;
    }

    return blocks.map(function (block, index) {
      // Handle question-type blocks (from session export)
      if (block.type === 'question' && block.body) {
        return {
          id: sessionId ? sessionId + '_Q' + (index + 1) : 'ZAY_Q' + (index + 1),
          set: 'IMPORTED',
          dom: block.body.domain || 'General',
          q: block.body.question || block.title || '',
          correct: block.body.answer || '',
          u: block.body.answer || '',
          l: block.body.optionL || 'Option B',
          r: block.body.optionR || 'Option C',
          logic: block.body.logic || '',
          hint: block.body.hint || '',
          trap: block.body.trap || '',
          _source: 'zay-import',
          _sourceSession: sessionId
        };
      }

      // Handle raw vault-format blocks (already have q/correct fields)
      if (block.q && block.correct) {
        var entry = clone(block);
        entry._source = 'zay-import';
        entry._sourceSession = sessionId;
        return entry;
      }

      // Handle text/note blocks (from block-system)
      return {
        id: (block.id || 'ZAY_B' + (index + 1)),
        set: 'IMPORTED',
        dom: 'General',
        q: (block.content && block.content.value) || block.title || '',
        correct: '',
        u: '',
        l: '',
        r: '',
        logic: '',
        hint: '',
        trap: '',
        _source: 'zay-import',
        _sourceSession: sessionId,
        _blockType: block.type || 'unknown'
      };
    });
  }

  /**
   * Main entry point: parses a .zay file string into a structured object
   */
  function parseZayPackage(content, options) {
    if (typeof content !== 'string' || content.trim().length === 0) {
      fail('ZAY_CONTENT_EMPTY', 'ZAY content must be a non-empty string.');
    }

    var config = options || {};
    var format = detectFormat(content);
    var result = { _format: null, manifest: null, meta: null, content: null, state: null, assets: null, raw: null };

    if (format === 'sections') {
      // V1: zay-compiler output
      var entries = parseSections(content);
      result._format = 'v1';
      result.manifest = entries['manifest.json'] || null;
      result.content = entries['content/session.json'] || null;
      result.state = entries['state/session-state.json'] || null;
      result.assets = entries['assets/index.json'] || null;

      if (config.strict !== false && result.manifest) {
        validateManifest(result.manifest);
      }

    } else if (format === 'json') {
      // V2: inline JSON export
      var parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        fail('ZAY_JSON_PARSE_ERROR', 'Failed to parse ZAY JSON: ' + e.message);
      }

      result._format = 'v2';
      result.meta = parsed.meta || null;
      result.content = parsed.content || null;
      result.state = parsed.state || null;
      result.raw = parsed;

      // Normalize V2 vault data
      if (parsed.vault) {
        result.vault = clone(parsed.vault);
      }

      if (config.strict !== false && result.meta) {
        validateV2Meta(result.meta);
      }

    } else {
      fail('ZAY_FORMAT_UNKNOWN', 'Unrecognized .zay format.');
    }

    return result;
  }

  // Public API
  var api = {
    parseZayPackage: parseZayPackage,
    validateManifest: validateManifest,
    validateV2Meta: validateV2Meta,
    extractBlocks: extractBlocks,
    toVaultFormat: toVaultFormat,
    detectFormat: detectFormat,
    SUPPORTED_COMPILERS: SUPPORTED_COMPILERS.slice(),
    SUPPORTED_META_VERSIONS: SUPPORTED_META_VERSIONS.slice()
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.AlchemistZayImporter = api;
})(typeof window !== 'undefined' ? window : globalThis);
