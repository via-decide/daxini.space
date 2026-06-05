'use strict';

const assert = require('assert');
const { createSessionEngine } = require('./session-engine.js');
const { createCreditSystem } = require('./credit-system.js');
const { createVaultManager } = require('./vault-manager.js');

function createMemoryStorage() {
  const db = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(db, k) ? db[k] : null),
    setItem: (k, v) => { db[k] = v; },
    removeItem: (k) => { delete db[k]; }
  };
}

(function runTests() {
  const storage = createMemoryStorage();
  let t = 1710000000000;
  const now = () => (t += 1);

  const sessionEngine = createSessionEngine({ storage, now, storageKey: 'credit_vault_test' });
  const creditSystem = createCreditSystem({ sessionEngine, now }, { initialCredits: 100, sessionCost: 20, publishRefundRate: 0.5 });
  const published = [];
  const vault = createVaultManager({ sessionEngine, creditSystem, now, publishAdapter: { publish: (session) => published.push(session.id) } });

  const session = sessionEngine.startSession('Economy Run');
  const charged = creditSystem.chargeForSessionStart(session);
  assert.equal(charged.cost, 20);
  assert.equal(creditSystem.getBalance(), 80);

  sessionEngine.addBlock({ id: 'b1', text: 'hello' });
  sessionEngine.finalizeSession();
  const moved = vault.moveToVault(session.id);
  assert.equal(moved.state, 'vault');

  const recovered = vault.recoverSession(session.id);
  assert.equal(recovered.id, session.id);
  assert.equal(creditSystem.getBalance(), 80);

  const publishedResult = vault.publishSession(session.id);
  assert.equal(publishedResult.state, 'published');
  assert.equal(creditSystem.getBalance(), 90);
  assert.equal(published.length, 1);

  assert.throws(() => vault.publishSession(session.id), /VAULT_DUPLICATE_PUBLISH/);
  assert.throws(() => creditSystem.settlePublishReward(session.id, true), /CREDIT_REFUND_ALREADY_APPLIED/);

  const session2 = sessionEngine.startSession('Discarded Run');
  creditSystem.chargeForSessionStart(session2);
  sessionEngine.finalizeSession();
  vault.moveToVault(session2.id);
  vault.discardSession(session2.id);
  assert.throws(() => vault.recoverSession(session2.id), /VAULT_RECOVERY_DISALLOWED/);
  assert.equal(creditSystem.getBalance(), 70);

  assert.throws(() => creditSystem.deduct(1000), /CREDIT_INSUFFICIENT/);

  console.log('credit-system tests passed');
})();
