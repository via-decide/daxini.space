/**
 * scripts/os-shell.js — VIA Sovereign OS Shell
 * 
 * Manages the high-level OS experience: Status Bar, Wallpaper, 
 * and App Switcher logic.
 */

class OSShell {
  constructor() {
    this.initStatusBar();
    this.initHomeState();
    this.attachEvents();
  }

  initStatusBar() {
    const bar = document.createElement('div');
    bar.id = 'os-status-bar';
    bar.innerHTML = `
      <div class="status-left">
        <span id="os-clock">00:00</span>
      </div>
      <div class="status-center">
        <span class="status-pill">ZAYVORA ACTIVE</span>
      </div>
      <div class="status-right">
        <span id="os-pwa-status">●</span>
      </div>
    `;
    document.body.appendChild(bar);

    // Style the status bar
    const style = document.createElement('style');
    style.textContent = `
      #os-status-bar {
        position: fixed;
        top: 0; left: 0; width: 100%;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        box-sizing: border-box;
        font-size: 13px;
        font-weight: 600;
        z-index: 10000;
        pointer-events: none;
        color: rgba(255,255,255,0.9);
      }
      .status-pill {
        background: rgba(0, 255, 150, 0.1);
        border: 1px solid rgba(0, 255, 150, 0.3);
        padding: 2px 10px;
        border-radius: 100px;
        font-size: 10px;
        letter-spacing: 0.5px;
        color: var(--matrix-green);
      }
      #os-clock { font-variant-numeric: tabular-nums; }
    `;
    document.head.appendChild(style);

    this.updateClock();
    setInterval(() => this.updateClock(), 60000);

    // Control Center Trigger
    document.getElementById('os-clock').parentElement.style.pointerEvents = 'auto';
    document.getElementById('os-clock').parentElement.onclick = () => this.toggleControlCenter();
  }

  toggleControlCenter() {
    let cc = document.getElementById('os-control-center');
    if (cc) {
      cc.classList.toggle('active');
      return;
    }

    cc = document.createElement('div');
    cc.id = 'os-control-center';
    cc.innerHTML = `
      <div class="cc-header">SYSTEM OVERLAY</div>
      <div class="cc-section">
        <h3>PATTERN GUIDE</h3>
        <div class="pattern-item"><span>―</span>Decision Core</div>
        <div class="pattern-item"><span>|</span>Code Nexus</div>
        <div class="pattern-item"><span>/</span>Orchard Engine</div>
        <div class="pattern-item"><span>\</span>Logic Academy</div>
      </div>
      <div class="cc-footer">VIA OS v4.0.1 (Sovereign)</div>
    `;
    document.body.appendChild(cc);

    const style = document.createElement('style');
    style.textContent = `
      #os-control-center {
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(2, 2, 5, 0.9);
        backdrop-filter: blur(40px);
        -webkit-backdrop-filter: blur(40px);
        z-index: 20000;
        display: flex;
        flex-direction: column;
        padding: 60px 40px;
        box-sizing: border-box;
        transform: translateY(-100%);
        transition: transform 0.5s var(--spring-easing);
      }
      #os-control-center.active { transform: translateY(0); }
      .cc-header { font-size: 10px; letter-spacing: 4px; color: var(--matrix-green); margin-bottom: 40px; }
      .cc-section h3 { font-size: 20px; margin-bottom: 20px; }
      .pattern-item { display: flex; align-items: center; gap: 20px; margin-bottom: 15px; font-weight: 600; color: #a0a8b8; }
      .pattern-item span { width: 30px; color: var(--brand-saffron); font-size: 24px; }
    `;
    document.head.appendChild(style);
    
    requestAnimationFrame(() => cc.classList.add('active'));
  }

  updateClock() {
    const clock = document.getElementById('os-clock');
    if (clock) {
      const now = new Date();
      clock.textContent = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    }
  }

  initHomeState() {
    // When no windows are open, center the pattern grid
    this.checkHomeState();
  }

  attachEvents() {
    window.addEventListener('os:window_opened', () => this.checkHomeState());
    window.addEventListener('os:window_closed', () => this.checkHomeState());
  }

  checkHomeState() {
    const stack = document.getElementById('window-manager');
    const minimap = document.getElementById('os-minimap');
    if (!stack || !minimap) return;

    const hasWindows = stack.children.length > 0;
    
    if (!hasWindows) {
      minimap.style.bottom = '50%';
      minimap.style.transform = 'translate(-50%, 50%) scale(1.2)';
      minimap.style.background = 'rgba(255,255,255,0.05)';
    } else {
      minimap.style.bottom = 'calc(env(safe-area-inset-bottom, 20px) + 40px)';
      minimap.style.transform = 'translateX(-50%) scale(1)';
      minimap.style.background = 'rgba(255,255,255,0.03)';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.Shell = new OSShell();
});
