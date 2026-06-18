(() => {
  'use strict';

  const ROUTES = {
    '/': { title: 'Daxini Space', view: 'home' },
    '/zayvora': { title: 'Zayvora UI', view: 'zayvora' },
    '/pricing': { title: 'Pricing', view: 'pricing' },
    '/login': { title: 'Login', view: 'login' }
  };

  function normalizePath(pathname) {
    if (!pathname || pathname === '') return '/';
    return pathname.endsWith('/') && pathname.length > 1
      ? pathname.slice(0, -1)
      : pathname;
  }

  function getRoute(pathname = window.location.pathname) {
    const canonicalRoute = normalizePath(pathname);
    return ROUTES[canonicalRoute] ? canonicalRoute : '/';
  }

  function getViewRoot() {
    return document.getElementById('route-view-root');
  }

  function routeMarkup(route) {
    if (route === '/zayvora') {
      return `
        <section class="route-view__card" data-route-screen="zayvora">
          <h1>Zayvora UI</h1>
          <p>Welcome to the Zayvora interface preview.</p>
          <a href="/" data-route>Back to Home</a>
        </section>
      `;
    }

    if (route === '/pricing') {
      return `
        <section class="route-view__card" data-route-screen="pricing">
          <h1>Pricing</h1>
          <p>Choose the plan that matches your workflow.</p>
          <a href="/login" data-route>Go to Login</a>
        </section>
      `;
    }

    if (route === '/login') {
      return `
        <section class="route-view__card" data-route-screen="login">
          <h1>Login</h1>
          <p>Sign in to continue to your Daxini workspace.</p>
          <a href="/pricing" data-route>View Pricing</a>
        </section>
      `;
    }

    return '';
  }

  function render(route) {
    const resolved = getRoute(route);
    const viewRoot = getViewRoot();
    const env = document.getElementById('room-environment');
    const wm = document.getElementById('window-manager');

    if (viewRoot) {
      viewRoot.innerHTML = routeMarkup(resolved);
      viewRoot.hidden = resolved === '/';
    }

    if (env) env.hidden = resolved !== '/';
    if (wm) wm.hidden = resolved !== '/';

    const routeMeta = ROUTES[resolved] || ROUTES['/'];
    if (routeMeta?.title) {
      document.title = `${routeMeta.title} | Daxini.space`;
    }
  }

  function navigate(path, replace = false) {
    const resolved = getRoute(path);
    const current = getRoute(window.location.pathname);

    if (resolved !== current) {
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method]({}, '', resolved);
    } else if (replace) {
      window.history.replaceState({}, '', resolved);
    }

    render(resolved);
  }

  function bindLinks() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[data-route]');
      if (!link) return;

      const href = link.getAttribute('href') || '/';
      if (!href.startsWith('/')) return;

      event.preventDefault();
      navigate(href);
    });
  }

  function init() {
    bindLinks();
    window.addEventListener('popstate', () => render(window.location.pathname));
    render(window.location.pathname);
  }

  window.AppRouter = {
    init,
    navigate,
    render,
    getRoute
  };
})();
