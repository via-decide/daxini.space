'use strict';

function createStateEngine(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    getState() {
      return { ...state };
    },
    setState(next = {}) {
      state = { ...state, ...next };
      listeners.forEach((listener) => listener({ ...state }));
      return { ...state };
    },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createStateEngine };
}

if (typeof window !== 'undefined') {
  window.DaxiniRuntimeState = { createStateEngine };
}
