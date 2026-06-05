/**
 * MODULE_CONTRACT
 * Inputs: dependencies ({ sessionEngine, now }), config ({ initialCredits, sessionCost, costMode, blockUnitSize, publishRefundRate })
 * Outputs: deterministic credit ledger snapshots and lifecycle charge/refund actions
 * Functions: getBalance(), deduct(), refund(), chargeForSessionStart(), settlePublishReward(), getLedger(), reset()
 * Constraints: no negative credits, no global leaks, deterministic calculations, tamper-resistant via closure state only
 */
(function (global) {
  'use strict';

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function createCreditSystem(deps, config) {
    var options = config || {};
    var sessionEngine = deps && deps.sessionEngine;
    var now = deps && typeof deps.now === 'function' ? deps.now : Date.now;

    var state = {
      balance: Number.isFinite(options.initialCredits) ? Math.floor(options.initialCredits) : 0,
      ledger: [],
      chargedSessions: {},
      refundedSessions: {}
    };

    var rules = {
      sessionCost: Number.isFinite(options.sessionCost) ? Math.max(0, Math.floor(options.sessionCost)) : 10,
      costMode: options.costMode === 'blocks' ? 'blocks' : 'time',
      blockUnitSize: Number.isFinite(options.blockUnitSize) ? Math.max(1, Math.floor(options.blockUnitSize)) : 1,
      publishRefundRate: Number.isFinite(options.publishRefundRate) ? options.publishRefundRate : 0.5
    };

    function addLedger(type, amount, meta) {
      state.ledger.push({ type: type, amount: amount, balance: state.balance, at: now(), meta: meta || null });
    }

    function getBalance() { return state.balance; }

    function deduct(amount, meta) {
      var safeAmount = Math.floor(amount);
      if (!Number.isFinite(safeAmount) || safeAmount <= 0) throw new Error('CREDIT_DEDUCT_INVALID');
      if (state.balance < safeAmount) throw new Error('CREDIT_INSUFFICIENT');
      state.balance -= safeAmount;
      addLedger('deduct', safeAmount, meta);
      return state.balance;
    }

    function refund(amount, meta) {
      var safeAmount = Math.floor(amount);
      if (!Number.isFinite(safeAmount) || safeAmount <= 0) throw new Error('CREDIT_REFUND_INVALID');
      state.balance += safeAmount;
      addLedger('refund', safeAmount, meta);
      return state.balance;
    }

    function calculateSessionCost(session) {
      if (rules.costMode === 'blocks') {
        var blocks = session && Array.isArray(session.blocks) ? session.blocks.length : 0;
        return Math.max(1, Math.ceil(blocks / rules.blockUnitSize)) * rules.sessionCost;
      }
      return rules.sessionCost;
    }

    function chargeForSessionStart(session) {
      if (!session || !session.id) throw new Error('CREDIT_SESSION_REQUIRED');
      if (state.chargedSessions[session.id]) throw new Error('CREDIT_SESSION_ALREADY_CHARGED');
      var cost = calculateSessionCost(session);
      deduct(cost, { sessionId: session.id, reason: 'session-start' });
      state.chargedSessions[session.id] = cost;
      return { sessionId: session.id, cost: cost, balance: state.balance };
    }

    function settlePublishReward(sessionId, isValidSession) {
      if (!sessionId) throw new Error('CREDIT_SESSION_ID_REQUIRED');
      if (!isValidSession) throw new Error('CREDIT_INVALID_SESSION_FOR_PUBLISH');
      if (state.refundedSessions[sessionId]) throw new Error('CREDIT_REFUND_ALREADY_APPLIED');
      var charged = state.chargedSessions[sessionId];
      if (!charged) throw new Error('CREDIT_NO_CHARGE_FOR_SESSION');
      var refundAmount = Math.floor(charged * rules.publishRefundRate);
      if (refundAmount > 0) {
        refund(refundAmount, { sessionId: sessionId, reason: 'publish-refund' });
      }
      state.refundedSessions[sessionId] = refundAmount;
      return { sessionId: sessionId, refunded: refundAmount, balance: state.balance };
    }

    function getLedger() { return clone(state.ledger); }

    function reset(nextBalance) {
      state.balance = Number.isFinite(nextBalance) ? Math.floor(nextBalance) : 0;
      state.ledger = [];
      state.chargedSessions = {};
      state.refundedSessions = {};
      return state.balance;
    }

    return {
      getBalance: getBalance,
      deduct: deduct,
      refund: refund,
      chargeForSessionStart: chargeForSessionStart,
      settlePublishReward: settlePublishReward,
      getLedger: getLedger,
      reset: reset,
      getRules: function () { return clone(rules); },
      getSession: function () { return sessionEngine && typeof sessionEngine.getSession === 'function' ? sessionEngine.getSession() : null; }
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createCreditSystem: createCreditSystem };
  }

  global.AlchemistCreditSystem = { create: createCreditSystem };
})(typeof window !== 'undefined' ? window : globalThis);
