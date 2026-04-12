(function (global) {
  'use strict';

  function createNavigation(mapViewport, mapLayer, getEntityPosition) {
    const state = {
      scale: 1,
      minScale: 0.35,
      maxScale: 2.8,
      translateX: 0,
      translateY: 0
    };

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pinchDistance = null;

    function updateMapTransform() {
      mapLayer.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }

    function zoomMap(delta, originX, originY) {
      const oldScale = state.scale;
      state.scale = Math.min(state.maxScale, Math.max(state.minScale, state.scale * delta));
      const ratio = state.scale / oldScale;
      state.translateX = originX - (originX - state.translateX) * ratio;
      state.translateY = originY - (originY - state.translateY) * ratio;
      updateMapTransform();
    }

    function centerOn(entityId) {
      const pos = getEntityPosition(entityId);
      if (!pos) return;

      const rect = mapViewport.getBoundingClientRect();
      state.translateX = rect.width / 2 - pos.x * state.scale;
      state.translateY = rect.height / 2 - pos.y * state.scale;
      updateMapTransform();
    }

    function getDistance(touches) {
      const [a, b] = touches;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function bind() {
      mapViewport.addEventListener('wheel', (event) => {
        event.preventDefault();
        const factor = event.deltaY > 0 ? 0.92 : 1.08;
        zoomMap(factor, event.clientX, event.clientY);
      }, { passive: false });

      mapViewport.addEventListener('pointerdown', (event) => {
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
        mapViewport.setPointerCapture(event.pointerId);
      });

      mapViewport.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        state.translateX += event.clientX - lastX;
        state.translateY += event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        updateMapTransform();
      });

      mapViewport.addEventListener('pointerup', () => {
        dragging = false;
      });

      mapViewport.addEventListener('touchmove', (event) => {
        if (event.touches.length !== 2) {
          pinchDistance = null;
          return;
        }
        event.preventDefault();
        const dist = getDistance(event.touches);
        if (pinchDistance) {
          const factor = dist / pinchDistance;
          const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
          const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
          zoomMap(factor, centerX, centerY);
        }
        pinchDistance = dist;
      }, { passive: false });

      window.addEventListener('resize', updateMapTransform);
    }

    bind();
    updateMapTransform();

    return {
      state,
      zoomMap,
      centerOn,
      updateMapTransform
    };
  }

  global.ViaLogicNavigation = {
    createNavigation
  };
})(window);
