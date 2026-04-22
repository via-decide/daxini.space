/**
 * daxini-ui.js — Marketplace UI Engine
 * 
 * Handles room rendering, app launching, and fractal transitions.
 */

const DaxiniUI = {
  state: {
    focusSlug: null,
    roomApps: {},
    communityLoaded: false
  },

  async init() {
    this.attachListeners();
    await this.loadCommunityApps();
    this.route();
  },

  attachListeners() {
    window.addEventListener('os:pattern_locked', (e) => this.handlePattern(e.detail));
    window.addEventListener('popstate', () => this.route());
  },

  async loadCommunityApps() {
    if (this.state.communityLoaded) return;
    this.state.communityLoaded = true;
    try {
      const response = await fetch('https://logichub.app/api/public-feed', { cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json();
        const apps = Array.isArray(payload) ? payload : (payload.apps || []);
        apps.forEach(app => DaxiniRegistry.upsertApp(app));
      }
    } catch (e) {
      console.warn('Community feed offline', e);
    }
  },

  route() {
    const url = new URL(window.location.href);
    const slug = url.searchParams.get('app');
    if (slug) {
      this.launchAppBySlug(slug, { syncRoute: false });
    } else {
      this.closeActiveApp();
    }
  },

  renderRoom() {
    const centerApp = DaxiniRegistry.getAppBySlug(this.state.focusSlug);
    document.getElementById('room-title').textContent = centerApp ? centerApp.name.toUpperCase() : 'DAXINI.SPACE';
    
    DaxiniRegistry.ROOM_POSITIONS.forEach(pos => {
      const nodeEl = document.getElementById(`node-${pos}`);
      const appData = this.state.roomApps[pos];
      if (!nodeEl) return;

      if (appData) {
        nodeEl.style.display = 'flex';
        nodeEl.innerHTML = `
          <div class="app-icon">${appData.icon}</div>
          <div class="app-name">${appData.name}</div>
        `;
        nodeEl.onclick = () => this.launchAppBySlug(appData.slug);
      } else {
        nodeEl.style.display = 'none';
      }
    });
  },

  launchAppBySlug(slug, options = {}) {
    const app = DaxiniRegistry.getAppBySlug(slug);
    if (!app) return;

    this.state.focusSlug = slug;
    this.state.roomApps = this.pickRelatedApps(app);
    this.renderRoom();

    if (options.syncRoute !== false) {
      const url = new URL(window.location.href);
      url.searchParams.set('app', slug);
      window.history.pushState({ slug }, '', url.toString());
    }

    // Launch Iframe
    const wm = document.getElementById('window-manager');
    wm.innerHTML = '';
    
    const win = document.createElement('div');
    win.className = 'glass-window';
    win.innerHTML = `
      <div class="window-header">
        <span class="window-title">${app.name}</span>
        <span class="window-close" onclick="DaxiniUI.closeActiveApp()">✕</span>
      </div>
      <iframe class="window-content" src="${app.url}" style="flex:1; border:none; background:#fff;"></iframe>
    `;
    wm.appendChild(win);
    window.dispatchEvent(new CustomEvent('os:window_opened'));
  },

  closeActiveApp() {
    const wm = document.getElementById('window-manager');
    wm.innerHTML = '';
    this.state.focusSlug = null;
    this.applyHomeRoom();
    this.renderRoom();
    
    const url = new URL(window.location.href);
    url.searchParams.delete('app');
    window.history.pushState({}, '', url.toString());
    
    window.dispatchEvent(new CustomEvent('os:window_closed'));
  },

  applyHomeRoom() {
    const apps = {};
    DaxiniRegistry.DEFAULT_ROOM_SLUGS.forEach((slug, i) => {
      apps[DaxiniRegistry.ROOM_POSITIONS[i]] = DaxiniRegistry.getAppBySlug(slug);
    });
    this.state.roomApps = apps;
  },

  pickRelatedApps(focusApp) {
    // Simplified related logic for brevity
    const related = DaxiniRegistry.APP_LIBRARY.filter(a => a.slug !== focusApp.slug).slice(0, 8);
    const roomApps = {};
    DaxiniRegistry.ROOM_POSITIONS.forEach((pos, i) => {
      roomApps[pos] = related[i] || null;
    });
    return roomApps;
  },

  handlePattern(detail) {
    const { seed, path } = detail;
    
    // Tap Center: Home
    if (path.length === 1 && path[0] === 4) {
      this.closeActiveApp();
      return;
    }

    // Swipe: center -> target
    if (path.length === 2 && path[0] === 4) {
      const target = path[1];
      if (this.state.roomApps[target]) {
        this.launchAppBySlug(this.state.roomApps[target].slug);
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => DaxiniUI.init());
