/**
 * Copyright 2026 ViaDecide
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * scripts/window-manager.js
 * Manages the glass-morphic split-screen panel ecosystem.
 */

class WindowManager {
  constructor() {
    this.stack = document.getElementById('window-manager');
    this.maxWindows = 2;
    this.attachListeners();
  }

  attachListeners() {
    this.stack.addEventListener('click', (e) => {
      // 1. Handle Window Close
      if (e.target.classList.contains('header-close-btn')) {
        const win = e.target.closest('.glass-window');
        if (win) this.closeWindow(win);
        return;
      }

      // 2. Handle Ecosystem Tool Launch
      const toolBtn = e.target.closest('.tool-node');
      if (toolBtn) {
        const zoneId = toolBtn.dataset.zone;
        const toolId = toolBtn.dataset.tool;
        const toolName = toolBtn.textContent.replace(/[\[\]]/g, '').trim();
        
        const toolUrl = `../decide.engine-tools/tools/${zoneId}/${toolId}/index.html`;
        const toolWin = this.spawnWindow({ title: toolName, z: 0 }, `tool:${toolId}`);
        const body = toolWin.querySelector('.window-body');
        body.innerHTML = `<iframe src="${toolUrl}" style="width:100%; height:100%; border:none; background:transparent;"></iframe>`;
        return;
      }

      // 3. Handle Macro Navigation
      const macroBtn = e.target.closest('.macro-node');
      if (macroBtn) {
        const zid = macroBtn.dataset.zoneId;
        window.dispatchEvent(new CustomEvent('os:macro_nav', { detail: { zoneId: zid } }));
      }
    });
  }

  spawnWindow(room, seed, isTemporary = false) {
    if (!isTemporary && this.stack.children.length >= this.maxWindows) {
      const oldest = this.stack.firstElementChild;
      this.closeWindow(oldest);
    }

    // ── Zayvora: Trace Orchestration ──
    if (window.DaxiniPassport && window.DaxiniPassport.traceOrchestration) {
      window.DaxiniPassport.traceOrchestration(room.title || 'Uncharted Sector');
    }

    const win = document.createElement('div');
    win.className = 'glass-window';

    const header = document.createElement('div');
    header.className = 'window-header';
    header.innerHTML = `
      <span class="header-title">${room.title.toUpperCase()}</span>
      <span class="header-close-btn" title="Close Window">X</span>
    `;

    const body = document.createElement('div');
    body.className = 'window-body';
    
    if (isTemporary) {
      body.innerHTML = `<h2 style="color:var(--matrix-green); text-shadow:0 0 20px var(--matrix-green); border:1px solid var(--matrix-green); padding:20px; text-align:center;">[ INITIATING HANDOFF : ${room.title.toUpperCase()} ]</h2>`;
    } else {
      window.dispatchEvent(new CustomEvent('os:render_node', { detail: { node: body, seed, z: room.z } }));
    }

    win.appendChild(header);
    win.appendChild(body);
    this.stack.appendChild(win);
    
    return win;
  }

  closeWindow(win) {
    win.style.transform = 'scale(0.9)';
    win.style.opacity = '0';
    setTimeout(() => win.remove(), 300);
  }
}

window.WM = new WindowManager();
