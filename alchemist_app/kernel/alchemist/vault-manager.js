/**
 * MODULE_CONTRACT
 * Inputs: dependencies ({ sessionEngine, creditSystem, publishAdapter, now })
 * Outputs: vault state transitions with publish/recover/discard enforcement and rewards
 * Functions: moveToVault(), recoverSession(), discardSession(), publishSession(), getVaultRecord(), reset()
 * Constraints: no publish without finalize, no double refund, no recovery after discard, lock after publish
 */
(function (global) {
  'use strict';

  var STATES = { ACTIVE: 'active', VAULT: 'vault', PUBLISHED: 'published', DISCARDED: 'discarded' };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function createVaultManager(deps) {
    var sessionEngine = deps && deps.sessionEngine;
    var creditSystem = deps && deps.creditSystem;
    var publishAdapter = deps && deps.publishAdapter;
    var now = deps && typeof deps.now === 'function' ? deps.now : Date.now;

    if (!sessionEngine || typeof sessionEngine.getSession !== 'function') throw new Error('VAULT_SESSION_ENGINE_REQUIRED');
    if (!creditSystem || typeof creditSystem.settlePublishReward !== 'function') throw new Error('VAULT_CREDIT_SYSTEM_REQUIRED');

    var vault = {};

    function requireSession(sessionId) {
      var session = sessionEngine.getSession();
      if (!session || session.id !== sessionId) throw new Error('VAULT_SESSION_NOT_FOUND');
      return session;
    }

    function moveToVault(sessionId) {
      var session = requireSession(sessionId);
      if (session.state !== 'finalized') throw new Error('VAULT_FINALIZE_REQUIRED');
      if (vault[sessionId] && vault[sessionId].state !== STATES.VAULT) throw new Error('VAULT_SESSION_LOCKED');
      vault[sessionId] = { session: session, state: STATES.VAULT, movedAt: now(), decidedAt: null, rewardApplied: false };
      return clone(vault[sessionId]);
    }

    function recoverSession(sessionId) {
      var item = vault[sessionId];
      if (!item) throw new Error('VAULT_SESSION_NOT_FOUND');
      if (item.state === STATES.DISCARDED) throw new Error('VAULT_RECOVERY_DISALLOWED');
      if (item.state === STATES.PUBLISHED) throw new Error('VAULT_RECOVERY_DISALLOWED');
      item.state = STATES.ACTIVE;
      item.decidedAt = now();
      return clone(item.session);
    }

    function discardSession(sessionId) {
      var item = vault[sessionId];
      if (!item) throw new Error('VAULT_SESSION_NOT_FOUND');
      if (item.state === STATES.PUBLISHED) throw new Error('VAULT_ALREADY_PUBLISHED');
      item.state = STATES.DISCARDED;
      item.decidedAt = now();
      return { sessionId: sessionId, state: item.state };
    }

    function publishSession(sessionId) {
      var item = vault[sessionId];
      if (!item) throw new Error('VAULT_SESSION_NOT_FOUND');
      if (item.state === STATES.PUBLISHED) throw new Error('VAULT_DUPLICATE_PUBLISH');
      if (item.state === STATES.DISCARDED) throw new Error('VAULT_DISCARDED');

      if (publishAdapter && typeof publishAdapter.publish === 'function') {
        publishAdapter.publish(item.session);
      }

      var reward = creditSystem.settlePublishReward(sessionId, true);
      item.rewardApplied = true;
      item.state = STATES.PUBLISHED;
      item.decidedAt = now();
      return { sessionId: sessionId, state: item.state, reward: reward };
    }

    function getVaultRecord(sessionId) {
      return vault[sessionId] ? clone(vault[sessionId]) : null;
    }

    function reset() { vault = {}; }

    return {
      STATES: clone(STATES),
      moveToVault: moveToVault,
      recoverSession: recoverSession,
      discardSession: discardSession,
      publishSession: publishSession,
      getVaultRecord: getVaultRecord,
      reset: reset
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createVaultManager: createVaultManager };
  }

  global.AlchemistVaultManager = { create: createVaultManager };
})(typeof window !== 'undefined' ? window : globalThis);
