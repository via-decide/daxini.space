/**
 * MODULE_CONTRACT
 * Inputs: dependencies ({ sessionEngine }), options ({ now, adapters })
 * Outputs: review controller with decision state snapshots and summary card data
 * Functions: enterReviewMode(), trackDecision(), getDecision(), getSnapshot(), getFinalCard(), finalizeReview(), reset()
 * Constraints: deterministic transitions, gesture-first mapping, no global leaks, non-invasive reuse of existing cards
 */
(function (global) {
  'use strict';

  var ACTIONS = {
    KEEP: 'keep',
    DISCARD: 'discard',
    PUBLISH: 'publish'
  };

  var DECISIONS = {
    UNDECIDED: 'undecided',
    KEPT: 'kept',
    DISCARDED: 'discarded',
    PUBLISH_READY: 'publish-ready'
  };

  var GESTURE_MAP = {
    right: ACTIONS.KEEP,
    left: ACTIONS.DISCARD,
    up: ACTIONS.PUBLISH
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function createSessionReview(deps, options) {
    var config = deps || {};
    var sessionEngine = config.sessionEngine;
    if (!sessionEngine || typeof sessionEngine.getSession !== 'function') {
      throw new Error('SESSION_REVIEW_SESSION_ENGINE_REQUIRED');
    }

    var opts = options || {};
    var adapters = opts.adapters || {};
    var now = typeof opts.now === 'function' ? opts.now : Date.now;
    var state = null;

    function normalizeBlocks(session) {
      return (session.blocks || []).map(function (block) {
        return { id: block.id, state: DECISIONS.UNDECIDED, updatedAt: now() };
      });
    }

    function buildSummary(decisions) {
      var summary = { kept: 0, discarded: 0, publishReady: 0, undecided: 0, total: decisions.length };
      decisions.forEach(function (item) {
        if (item.state === DECISIONS.KEPT) summary.kept += 1;
        else if (item.state === DECISIONS.DISCARDED) summary.discarded += 1;
        else if (item.state === DECISIONS.PUBLISH_READY) {
          summary.kept += 1;
          summary.publishReady += 1;
        } else summary.undecided += 1;
      });
      return summary;
    }

    function enterReviewMode() {
      var session = sessionEngine.getSession();
      if (!session) throw new Error('SESSION_REVIEW_SESSION_NOT_FOUND');
      if (typeof sessionEngine.setReviewing === 'function' && session.state !== 'reviewing') {
        session = sessionEngine.setReviewing();
      }
      state = {
        sessionId: session.id,
        startedAt: now(),
        finalizedAt: null,
        decisions: normalizeBlocks(session)
      };
      return getSnapshot();
    }

    function assertReviewState() {
      if (!state) throw new Error('SESSION_REVIEW_NOT_STARTED');
    }

    function resolveDecision(action) {
      if (action === ACTIONS.KEEP) return DECISIONS.KEPT;
      if (action === ACTIONS.DISCARD) return DECISIONS.DISCARDED;
      if (action === ACTIONS.PUBLISH) return DECISIONS.PUBLISH_READY;
      throw new Error('SESSION_REVIEW_ACTION_INVALID');
    }

    function trackDecision(blockId, action) {
      assertReviewState();
      if (!blockId) throw new Error('SESSION_REVIEW_BLOCK_ID_REQUIRED');
      var item = state.decisions.find(function (decision) { return decision.id === blockId; });
      if (!item) throw new Error('SESSION_REVIEW_BLOCK_NOT_FOUND');

      item.state = resolveDecision(action);
      item.updatedAt = now();

      if (adapters && typeof adapters.onDecision === 'function') {
        adapters.onDecision({ id: item.id, state: item.state, action: action });
      }

      return clone(item);
    }

    function trackGesture(blockId, gesture) {
      var action = GESTURE_MAP[gesture];
      if (!action) throw new Error('SESSION_REVIEW_GESTURE_INVALID');
      return trackDecision(blockId, action);
    }

    function getDecision(blockId) {
      assertReviewState();
      var item = state.decisions.find(function (decision) { return decision.id === blockId; });
      return item ? clone(item) : null;
    }

    function getFinalCard() {
      assertReviewState();
      var summary = buildSummary(state.decisions);
      return {
        type: 'review-final-card',
        sessionId: state.sessionId,
        summary: summary,
        publishEnabled: summary.publishReady > 0,
        keepEnabled: summary.kept > 0
      };
    }

    function finalizeReview() {
      assertReviewState();
      var summary = buildSummary(state.decisions);
      state.finalizedAt = now();
      if (typeof sessionEngine.finalizeSession === 'function') {
        sessionEngine.finalizeSession();
      }
      return {
        sessionId: state.sessionId,
        summary: summary,
        decisions: clone(state.decisions),
        finalizedAt: state.finalizedAt
      };
    }

    function getSnapshot() {
      if (!state) return null;
      return {
        sessionId: state.sessionId,
        startedAt: state.startedAt,
        finalizedAt: state.finalizedAt,
        decisions: clone(state.decisions),
        summary: buildSummary(state.decisions)
      };
    }

    function reset() { state = null; }

    return {
      ACTIONS: clone(ACTIONS),
      DECISIONS: clone(DECISIONS),
      GESTURE_MAP: clone(GESTURE_MAP),
      enterReviewMode: enterReviewMode,
      trackDecision: trackDecision,
      trackGesture: trackGesture,
      getDecision: getDecision,
      getFinalCard: getFinalCard,
      getSnapshot: getSnapshot,
      finalizeReview: finalizeReview,
      reset: reset
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createSessionReview: createSessionReview };
  }

  global.AlchemistSessionReview = { create: createSessionReview };
})(typeof window !== 'undefined' ? window : globalThis);
