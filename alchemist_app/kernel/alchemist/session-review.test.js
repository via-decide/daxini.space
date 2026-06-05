'use strict';

const assert = require('assert');
const { createSessionEngine } = require('./session-engine.js');
const { createSessionReview } = require('./session-review.js');

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
  let t = 1800000000000;
  const sessionEngine = createSessionEngine({ storage, now: () => (t += 10), storageKey: 'review_test' });
  sessionEngine.startSession('Review Flow');
  sessionEngine.addBlock({ id: 'b1', content: 'alpha' });
  sessionEngine.addBlock({ id: 'b2', content: 'beta' });
  sessionEngine.addBlock({ id: 'b3', content: 'gamma' });

  const calls = [];
  const review = createSessionReview({ sessionEngine }, { now: () => (t += 1), adapters: { onDecision: (d) => calls.push(d) } });

  const entered = review.enterReviewMode();
  assert.equal(entered.decisions.length, 3);
  assert.equal(sessionEngine.getSession().state, sessionEngine.SESSION_STATES.REVIEWING);

  review.trackGesture('b1', 'right');
  review.trackGesture('b2', 'left');
  review.trackGesture('b3', 'up');

  assert.equal(review.getDecision('b1').state, review.DECISIONS.KEPT);
  assert.equal(review.getDecision('b2').state, review.DECISIONS.DISCARDED);
  assert.equal(review.getDecision('b3').state, review.DECISIONS.PUBLISH_READY);
  assert.equal(calls.length, 3);

  const finalCard = review.getFinalCard();
  assert.equal(finalCard.summary.total, 3);
  assert.equal(finalCard.summary.kept, 2);
  assert.equal(finalCard.summary.discarded, 1);
  assert.equal(finalCard.summary.publishReady, 1);
  assert.equal(finalCard.publishEnabled, true);

  const result = review.finalizeReview();
  assert.equal(result.summary.total, 3);
  assert.equal(sessionEngine.getSession().state, sessionEngine.SESSION_STATES.FINALIZED);

  assert.throws(() => review.trackGesture('b1', 'down'), /SESSION_REVIEW_GESTURE_INVALID/);

  const newReview = createSessionReview({ sessionEngine });
  assert.throws(() => newReview.enterReviewMode(), /SESSION_NOT_ACTIVE/);

  console.log('session-review tests passed');
})();
