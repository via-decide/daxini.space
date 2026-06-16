/**
 * scripts/install-manager.js
 * Native PWA Install Manager
 */

let deferredPrompt;

// 1. Listen for the native install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the default mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered on user click
  deferredPrompt = e;

  // 2. Inject the floating install banner
  if (!document.getElementById('install-toast')) {
    const toast = document.createElement('div');
    toast.id = 'install-toast';
    toast.className = 'glass-window'; // Reuse existing glass styles
    toast.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 99999;
      padding: 15px;
      text-align: center;
      color: #00ff88;
      font-weight: bold;
      cursor: pointer;
      background: rgba(10, 15, 12, 0.9);
      border-radius: 0 0 16px 16px;
      border-bottom: 1px solid #00ff88;
      box-shadow: 0 4px 20px rgba(0, 255, 136, 0.2);
    `;
    toast.textContent = 'INITIALIZE SYSTEM (INSTALL)';
    
    document.body.appendChild(toast);

    // 3. Handle the click to prompt installation
    toast.addEventListener('click', async () => {
      if (!deferredPrompt) return;

      // Analytics: app_install_click — user tapped the install banner
      if (window.DaxiniAnalytics) {
        DaxiniAnalytics.track(DaxiniAnalytics.EVENTS.APP_INSTALL_CLICK, {
          metadata: { trigger: 'pwa_install_toast', url: window.location.href },
        });
      }
      
      // Trigger the native prompt
      deferredPrompt.prompt();
      
      // Wait for the user's response
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[VIA OS] Install choice outcome: ${outcome}`);
      
      // Clear the stashed event
      deferredPrompt = null;
      
      // Remove the toast
      toast.remove();
    });
  }
});

// Clean up if app gets installed mid-session
window.addEventListener('appinstalled', () => {
  const toast = document.getElementById('install-toast');
  if (toast) toast.remove();
  deferredPrompt = null;
  console.log('[VIA OS] App installed successfully');
});

// Standalone bypass (preserve logic)
(function bypass() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const trap = document.getElementById('install-trap');
  if (isStandalone && trap) trap.style.display = 'none';
})();
