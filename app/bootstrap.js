(() => {
  'use strict';

  function initRouter() {
    if (window.AppRouter && typeof window.AppRouter.init === 'function') {
      window.AppRouter.init();
    }
  }

  function initAuth() {
    if (window.AppAuth && typeof window.AppAuth.init === 'function') {
      window.AppAuth.init();
    }
  }

  function initUI() {
    if (window.AppUI && typeof window.AppUI.init === 'function') {
      window.AppUI.init();
    }
  }

  function boot() {
    initRouter();
    initAuth();
    initUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.DaxiniBootstrap = {
    initRouter,
    initAuth,
    initUI,
    boot
  };
})();
