/**
 * MODULE_CONTRACT
 * Inputs: optional adapters ({ history, location, onChange }) and view transition calls
 * Outputs: global AlchemistNavigation API for recoverable browser-safe navigation
 * Functions: pushView(), goBack(), goHome(), goLibrary(), getCurrentView(), canGoBack()
 * Constraints: IIFE, no ES modules, no framework dependencies, browser/history fallback safe
 */
(function (global) {
  'use strict';

  var VALID_VIEWS = {
    home: true,
    quiz: true,
    library: true,
    'question-detail': true,
    'session-review': true,
    'export-preview': true,
    'export-complete': true
  };

  var MAJOR_HISTORY_VIEWS = {
    library: true,
    'question-detail': true,
    'session-review': true,
    'export-preview': true,
    'export-complete': true
  };

  function clonePayload(payload) {
    if (!payload || typeof payload !== 'object') return payload || null;
    if (Array.isArray(payload)) return payload.slice();
    var copy = {};
    Object.keys(payload).forEach(function (key) { copy[key] = payload[key]; });
    return copy;
  }

  function normalizeView(viewName) {
    var view = String(viewName || 'home');
    return VALID_VIEWS[view] ? view : 'home';
  }

  function createNavigationState(adapters) {
    var opts = adapters || {};
    var browserHistory = opts.history || (global && global.history) || null;
    var browserLocation = opts.location || (global && global.location) || null;
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    var current = { view: 'home', payload: null };
    var backStack = [];
    var suppressPop = false;
    var bootstrappedHistory = false;

    function getState() {
      return { view: current.view, payload: clonePayload(current.payload) };
    }

    function notify(reason) {
      onChange(getState(), reason || 'change');
    }

    function canUseHistory() {
      return browserHistory && typeof browserHistory.pushState === 'function' && typeof browserHistory.replaceState === 'function';
    }

    function ensureHistoryRoot() {
      if (!canUseHistory() || bootstrappedHistory) return;
      try {
        browserHistory.replaceState({ alchemist: true, view: current.view }, '', browserLocation && browserLocation.href ? browserLocation.href : undefined);
        bootstrappedHistory = true;
      } catch (error) {
        bootstrappedHistory = true;
      }
    }

    function pushBrowserHistory(view, payload) {
      if (!canUseHistory() || !MAJOR_HISTORY_VIEWS[view]) return;
      ensureHistoryRoot();
      try {
        browserHistory.pushState({ alchemist: true, view: view, payload: clonePayload(payload) }, '', browserLocation && browserLocation.href ? browserLocation.href : undefined);
      } catch (error) {
        return;
      }
    }

    function pushView(viewName, payload, options) {
      var view = normalizeView(viewName);
      var optsLocal = options || {};
      if (current.view !== view || optsLocal.allowDuplicate) {
        backStack.push(getState());
      }
      current = { view: view, payload: clonePayload(payload) };
      if (optsLocal.history !== false) pushBrowserHistory(view, payload);
      notify('push');
      return getState();
    }

    function goBack(options) {
      var optsLocal = options || {};
      var previous = backStack.length ? backStack.pop() : { view: 'home', payload: null };
      current = { view: normalizeView(previous.view), payload: clonePayload(previous.payload) };
      if (!optsLocal.fromPop && canUseHistory() && MAJOR_HISTORY_VIEWS[previous.view]) {
        try { suppressPop = true; browserHistory.back(); } catch (error) { suppressPop = false; }
      }
      notify('back');
      return getState();
    }

    function goHome(options) {
      var optsLocal = options || {};
      backStack = [];
      current = { view: 'home', payload: null };
      if (optsLocal.history !== false && canUseHistory()) {
        try { browserHistory.replaceState({ alchemist: true, view: 'home' }, '', browserLocation && browserLocation.href ? browserLocation.href : undefined); } catch (error) {}
      }
      notify('home');
      return getState();
    }

    function goLibrary(payload) {
      return pushView('library', payload || null);
    }

    function getCurrentView() {
      return current.view;
    }

    function canGoBack() {
      return backStack.length > 0;
    }

    function configure(nextAdapters) {
      nextAdapters = nextAdapters || {};
      if (typeof nextAdapters.onChange === 'function') onChange = nextAdapters.onChange;
      if (nextAdapters.history) browserHistory = nextAdapters.history;
      if (nextAdapters.location) browserLocation = nextAdapters.location;
      return api;
    }

    function handlePopState() {
      if (suppressPop) { suppressPop = false; return; }
      goBack({ fromPop: true });
    }

    if (global && typeof global.addEventListener === 'function') {
      global.addEventListener('popstate', handlePopState);
    }

    var api = {
      pushView: pushView,
      goBack: goBack,
      goHome: goHome,
      goLibrary: goLibrary,
      getCurrentView: getCurrentView,
      canGoBack: canGoBack,
      configure: configure,
      _getSnapshot: function () { return { current: getState(), backStack: backStack.map(function (item) { return { view: item.view, payload: clonePayload(item.payload) }; }) }; }
    };

    ensureHistoryRoot();
    return api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createNavigationState: createNavigationState };
  }

  global.AlchemistNavigation = createNavigationState();
})(typeof window !== 'undefined' ? window : globalThis);
