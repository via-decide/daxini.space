/**
 * MODULE_CONTRACT
 * Inputs: block id (string), model path (string), interaction options (object, optional)
 * Outputs: normalized 3d block object and updated session snapshots
 * Functions: create3DBlock(), add3DBlockToSession()
 * Constraints: no rendering logic, STL-only metadata, deterministic data normalization
 */
(function (global) {
  'use strict';

  function fail(code, message) {
    var error = new Error(message || code);
    error.code = code;
    throw error;
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeInteraction(interaction) {
    if (interaction === undefined) {
      return { rotate: true, zoom: true };
    }

    if (!isObject(interaction)) {
      fail('BLOCK_3D_INTERACTION_OBJECT_REQUIRED', '3d interaction must be an object when provided.');
    }

    return {
      rotate: interaction.rotate !== false,
      zoom: interaction.zoom !== false
    };
  }

  function create3DBlock(id, model, interaction) {
    if (typeof id !== 'string' || id.trim() === '') {
      fail('BLOCK_3D_ID_REQUIRED', '3d block requires a non-empty id string.');
    }

    if (typeof model !== 'string' || model.trim() === '') {
      fail('BLOCK_3D_MODEL_REQUIRED', '3d block requires a non-empty model path string.');
    }

    if (!/\.stl$/i.test(model.trim())) {
      fail('BLOCK_3D_MODEL_STL_REQUIRED', '3d block model path must end with .stl.');
    }

    return {
      id: id,
      type: '3d',
      model: model.trim(),
      interaction: normalizeInteraction(interaction)
    };
  }

  function add3DBlockToSession(sessionEngine, block) {
    if (!sessionEngine || typeof sessionEngine.addBlock !== 'function') {
      fail('SESSION_ENGINE_REQUIRED', 'A session engine with addBlock(block) is required.');
    }
    if (!isObject(block) || block.type !== '3d') {
      fail('BLOCK_3D_INVALID', 'add3DBlockToSession expects a valid 3d block object.');
    }
    return sessionEngine.addBlock(block);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      create3DBlock: create3DBlock,
      add3DBlockToSession: add3DBlockToSession
    };
  }

  global.Alchemist3DBlock = {
    create: create3DBlock,
    addToSession: add3DBlockToSession
  };
})(typeof window !== 'undefined' ? window : globalThis);
