(() => {
  'use strict';

  function init() {
    document.documentElement.dataset.authReady = 'true';
  }

  window.AppAuth = { init };
})();
