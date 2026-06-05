/**
 * MODULE_CONTRACT
 * Inputs: storage adapter (optional), sessionName (optional), block objects for addBlock
 * Outputs: session snapshots and lifecycle transitions
 * Functions: startSession(), addBlock(), removeBlock(), getSession(), setReviewing(), finalizeSession(), reset()
 * Constraints: deterministic transitions, single active session, immutable external state, localStorage persistence
 */
(function (global) {
  'use strict';

  var DEFAULT_STORAGE_KEY = 'alchemist_session_engine_v1';
  var SESSION_STATES = {
    ACTIVE: 'active',
    REVIEWING: 'reviewing',
    FINALIZED: 'finalized'
  };

  function createStorageBridge(storage) {
    if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
      return storage;
    }

    if (typeof global !== 'undefined' && global.localStorage) {
      return global.localStorage;
    }

    return {
      _value: null,
      getItem: function () { return this._value; },
      setItem: function (_, value) { this._value = value; },
      removeItem: function () { this._value = null; }
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createSessionEngine(options) {
    var config = options || {};
    var storageKey = config.storageKey || DEFAULT_STORAGE_KEY;
    var storage = createStorageBridge(config.storage);

    function now() {
      return typeof config.now === 'function' ? config.now() : Date.now();
    }

    function createEmptyState() {
      return { activeSession: null };
    }

    function loadState() {
      var raw = storage.getItem(storageKey);
      if (!raw) return createEmptyState();
      try {
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : createEmptyState();
      } catch (error) {
        return createEmptyState();
      }
    }

    function saveState(state) {
      storage.setItem(storageKey, JSON.stringify(state));
    }

    function sanitizeBlock(block) {
      if (!block || typeof block !== 'object') {
        throw new Error('SESSION_INVALID_BLOCK');
      }
      if (!block.id || typeof block.id !== 'string') {
        throw new Error('SESSION_BLOCK_ID_REQUIRED');
      }
      return clone(block);
    }

    function assertActive(session) {
      if (!session) throw new Error('SESSION_NOT_FOUND');
      if (session.state !== SESSION_STATES.ACTIVE) {
        throw new Error('SESSION_NOT_ACTIVE');
      }
    }

    function getSession() {
      return clone(loadState().activeSession);
    }

    function startSession(sessionName) {
      var state = loadState();
      if (state.activeSession && state.activeSession.state !== SESSION_STATES.FINALIZED) {
        throw new Error('SESSION_ALREADY_ACTIVE');
      }

      var stamp = now();
      state.activeSession = {
        id: 'sess_' + stamp,
        name: sessionName || 'Untitled Session',
        state: SESSION_STATES.ACTIVE,
        blocks: [],
        createdAt: stamp,
        updatedAt: stamp,
        finalizedAt: null
      };

      saveState(state);
      return clone(state.activeSession);
    }

    function addBlock(block) {
      var state = loadState();
      assertActive(state.activeSession);
      var safeBlock = sanitizeBlock(block);
      var exists = state.activeSession.blocks.some(function (item) { return item.id === safeBlock.id; });
      if (exists) {
        throw new Error('SESSION_BLOCK_DUPLICATE_ID');
      }
      state.activeSession.blocks.push(safeBlock);
      state.activeSession.updatedAt = now();
      saveState(state);
      return clone(state.activeSession);
    }

    function removeBlock(id) {
      var state = loadState();
      assertActive(state.activeSession);
      var before = state.activeSession.blocks.length;
      state.activeSession.blocks = state.activeSession.blocks.filter(function (item) { return item.id !== id; });
      if (state.activeSession.blocks.length === before) {
        throw new Error('SESSION_BLOCK_NOT_FOUND');
      }
      state.activeSession.updatedAt = now();
      saveState(state);
      return clone(state.activeSession);
    }

    function setReviewing() {
      var state = loadState();
      assertActive(state.activeSession);
      state.activeSession.state = SESSION_STATES.REVIEWING;
      state.activeSession.updatedAt = now();
      saveState(state);
      return clone(state.activeSession);
    }

    function finalizeSession() {
      var state = loadState();
      if (!state.activeSession) throw new Error('SESSION_NOT_FOUND');
      if (state.activeSession.state === SESSION_STATES.FINALIZED) {
        throw new Error('SESSION_ALREADY_FINALIZED');
      }
      state.activeSession.state = SESSION_STATES.FINALIZED;
      state.activeSession.finalizedAt = now();
      state.activeSession.updatedAt = state.activeSession.finalizedAt;
      saveState(state);
      return clone(state.activeSession);
    }

    function reset() {
      storage.removeItem(storageKey);
      return createEmptyState();
    }

    return {
      SESSION_STATES: clone(SESSION_STATES),
      startSession: startSession,
      addBlock: addBlock,
      removeBlock: removeBlock,
      getSession: getSession,
      setReviewing: setReviewing,
      finalizeSession: finalizeSession,
      reset: reset
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createSessionEngine: createSessionEngine };
  }

  global.AlchemistSessionEngine = {
    create: createSessionEngine
  };
})(typeof window !== 'undefined' ? window : globalThis);
