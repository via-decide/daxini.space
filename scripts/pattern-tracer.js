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
 * scripts/pattern-tracer.js — VIA Master Pattern Tracer
 * 
 * Tracks 3x3 Stargate sigil input and dispatches 'os:pattern_locked' events.
 * Supports overlapping sigils and node revisiting.
 */

class PatternTracer {
  constructor() {
    this.minimap = document.getElementById('os-minimap');
    this.dots = [];
    this.patternSequence = [];
    this.isTracing = false;
    this.svg = null;
    this.pathLine = null;

    this.initGrid();
    this.initSVG();
    this.attachListeners();
  }

  initGrid() {
    if (!this.minimap) return;
    this.minimap.innerHTML = '';
    
    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++) {
        const dot = document.createElement('div');
        dot.className = 'hud-dot';
        dot.dataset.x = x;
        dot.dataset.y = y;
        this.minimap.appendChild(dot);
        this.dots.push(dot);
      }
    }
  }

  initSVG() {
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.style.position = 'absolute';
    this.svg.style.top = '0';
    this.svg.style.left = '0';
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';
    this.svg.style.pointerEvents = 'none';
    this.svg.style.zIndex = '5';
    this.minimap.appendChild(this.svg);

    this.pathLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    this.pathLine.style.fill = 'none';
    this.pathLine.style.stroke = 'var(--sigil-color, #00ff96)';
    this.pathLine.style.strokeWidth = '2';
    this.pathLine.style.strokeLinejoin = 'round';
    this.pathLine.style.strokeLinecap = 'round';
    this.pathLine.style.transition = 'stroke 0.3s ease, filter 0.3s ease';
    this.svg.appendChild(this.pathLine);
  }

  attachListeners() {
    this.minimap.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
    this.minimap.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
    this.minimap.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });

    // Global hooks to allow drawing anywhere
    window.addEventListener('mousedown', (e) => this.handleStart(e));
    window.addEventListener('mousemove', (e) => this.handleMove(e));
    window.addEventListener('mouseup', (e) => this.handleEnd(e));
    
    window.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });
  }

  handleStart(e) {
    this.isTracing = true;
    this.patternSequence = [];
    this.clearDots();
    this.resetStyles();
    this.updatePath();
    this.handleMove(e);
  }

  handleMove(e) {
    if (!this.isTracing) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const elementOnTouch = document.elementFromPoint(clientX, clientY);
    const dot = elementOnTouch ? elementOnTouch.closest('.hud-dot') : null;

    if (dot) {
      const x = dot.dataset.x;
      const y = dot.dataset.y;
      const coord = `${x},${y}`;

      if (this.patternSequence[this.patternSequence.length - 1] !== coord) {
        this.patternSequence.push(coord);
        dot.classList.add('active');
        this.updatePath();
        
        // Haptic Feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(12);
        }
      }
    }
  }

  handleEnd(e) {
    if (!this.isTracing) return;
    this.isTracing = false;

    if (this.patternSequence.length > 0) {
      const seed = this.patternSequence.join('|');
      window.dispatchEvent(new CustomEvent('os:pattern_locked', { detail: { seed } }));
    }

    // Delay clearing so user can see what they traced
    setTimeout(() => {
      if (!this.isTracing) {
        this.clearDots();
        this.patternSequence = [];
        this.updatePath();
        this.resetStyles();
      }
    }, 1500); // 1.5s sustain
  }

  async triggerSigilFlash() {
    this.pathLine.style.stroke = '#ff671f'; // Saffron
    this.pathLine.style.filter = 'drop-shadow(0 0 10px #ff671f)';
    this.minimap.classList.add('sigil-recognition');
    
    await new Promise(r => setTimeout(r, 450));
    
    this.minimap.classList.remove('sigil-recognition');
  }

  resetStyles() {
    this.pathLine.style.stroke = 'var(--sigil-color, #00ff96)';
    this.pathLine.style.filter = 'none';
  }

  clearDots() {
    this.dots.forEach(d => d.classList.remove('active'));
  }

  updatePath() {
    const points = this.patternSequence.map(coord => {
      const [x, y] = coord.split(',').map(Number);
      const dot = this.dots.find(d => d.dataset.x == x && d.dataset.y == y);
      if (!dot) return "";
      const rect = dot.getBoundingClientRect();
      const parentRect = this.minimap.getBoundingClientRect();
      const cx = (rect.left + rect.width / 2) - parentRect.left;
      const cy = (rect.top + rect.height / 2) - parentRect.top;
      return `${cx},${cy}`;
    }).join(' ');

    this.pathLine.setAttribute('points', points);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.patternTracer = new PatternTracer();
});
