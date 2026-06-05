const assert = require('node:assert');
const { createNavigationState } = require('./navigation-state.js');

const changes = [];
const nav = createNavigationState({
  history: {
    pushState() {},
    replaceState() {},
    back() {}
  },
  location: { href: 'http://localhost/' },
  onChange(state, reason) { changes.push({ state, reason }); }
});

assert.equal(nav.getCurrentView(), 'home');
assert.equal(nav.canGoBack(), false);

nav.pushView('quiz', { sessionId: 'SES_KEEP' }, { history: false });
assert.equal(nav.getCurrentView(), 'quiz');
assert.equal(nav.canGoBack(), true);

nav.pushView('export-complete', { type: 'pdf', filename: 'ALCHEMIST_SES_KEEP.pdf', sessionId: 'SES_KEEP' });
assert.equal(nav.getCurrentView(), 'export-complete');
assert.equal(nav.canGoBack(), true);
assert.equal(nav._getSnapshot().current.payload.sessionId, 'SES_KEEP');

nav.goBack();
assert.equal(nav.getCurrentView(), 'quiz');
assert.equal(nav.canGoBack(), true);

nav.goHome();
assert.equal(nav.getCurrentView(), 'home');
assert.equal(nav.canGoBack(), false);

nav.goLibrary();
assert.equal(nav.getCurrentView(), 'library');
assert.equal(nav.canGoBack(), true);

const fallbackNav = createNavigationState({ history: null, location: null });
assert.doesNotThrow(() => fallbackNav.pushView('question-detail', { index: 1 }));
assert.equal(fallbackNav.getCurrentView(), 'question-detail');
assert.doesNotThrow(() => fallbackNav.goHome());
assert.equal(fallbackNav.getCurrentView(), 'home');

assert(changes.some((entry) => entry.state.view === 'export-complete'));
console.log('navigation-state tests passed');
