(() => {
  'use strict';

  function init() {
    const fallback = document.getElementById('ui-fallback');
    if (fallback) {
      fallback.hidden = true;
    }

    document.documentElement.dataset.uiReady = 'true';
  }

  window.AppUI = { init };
})();
