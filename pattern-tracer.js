/**
 * pattern-tracer.js — VIA Sovereign OS Gesture Engine
 * 
 * Implements the 3x3 thumb matrix gesture recognition with haptic feedback.
 */

class PatternTracer {
  constructor() {
    this.minimap = document.getElementById('os-minimap');
    this.svgLine = document.getElementById('trace-line');
    this.dots = document.querySelectorAll('.dot');
    this.path = [];
    this.isTracing = false;
    this.attachListeners();
  }

  attachListeners() {
    const start = (e) => this.handleStart(e);
    const move = (e) => this.handleMove(e);
    const end = (e) => this.handleEnd(e);

    this.minimap.addEventListener('touchstart', start, { passive: false });
    this.minimap.addEventListener('touchmove', move, { passive: false });
    this.minimap.addEventListener('touchend', end, { passive: false });

    this.minimap.addEventListener('mousedown', start);
    window.addEventListener('mousemove', (e) => this.isTracing && this.handleMove(e));
    window.addEventListener('mouseup', end);
  }

  getDotCenter(idx) {
    const dot = document.getElementById(`dot-${idx}`);
    const rect = dot.getBoundingClientRect();
    const mapRect = this.minimap.getBoundingClientRect();
    return {
      x: rect.left - mapRect.left + rect.width / 2,
      y: rect.top - mapRect.top + rect.height / 2
    };
  }

  handleStart(e) {
    if (e.touches) e.preventDefault();
    this.isTracing = true;
    this.path = [];
    this.dots.forEach(d => d.classList.remove('active'));
    this.handleMove(e);
  }

  handleMove(e) {
    if (!this.isTracing) return;
    const t = e.touches ? e.touches[0] : e;
    const mapRect = this.minimap.getBoundingClientRect();
    const x = t.clientX - mapRect.left;
    const y = t.clientY - mapRect.top;

    const col = Math.floor((x / mapRect.width) * 3);
    const row = Math.floor((y / mapRect.height) * 3);

    if (col >= 0 && col <= 2 && row >= 0 && row <= 2) {
      const idx = row * 3 + col;
      if (this.path.length === 0 || this.path[this.path.length - 1] !== idx) {
        this.path.push(idx);
        const dot = document.getElementById(`dot-${idx}`);
        dot.classList.add('active');
        
        // Haptic Feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(15);
        }
      }
    }
    this.updateSVG(x, y);
  }

  handleEnd(e) {
    if (!this.isTracing) return;
    this.isTracing = false;
    this.updateSVG();
    
    const seed = this.path.join(',');
    window.dispatchEvent(new CustomEvent('os:pattern_locked', { detail: { seed, path: this.path } }));

    // Reset Visuals after a delay
    setTimeout(() => {
      if (!this.isTracing) {
        this.svgLine.setAttribute('points', '');
        this.dots.forEach(d => d.classList.remove('active'));
      }
    }, 400);
  }

  updateSVG(touchX, touchY) {
    let pts = this.path.map(idx => {
      const c = this.getDotCenter(idx);
      return `${c.x},${c.y}`;
    });
    if (this.isTracing && touchX !== undefined) pts.push(`${touchX},${touchY}`);
    this.svgLine.setAttribute('points', pts.join(' '));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.Tracer = new PatternTracer();
});
