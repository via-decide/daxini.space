(function (global) {
  'use strict';

  const SPARKS_KEY = 'via_logic_sparks';
  const LV_PREFIX = 'via_logic_lv_';

  async function loadJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return response.json();
  }

  function calculateUpgradeCost(baseCost, level) {
    return Math.round(baseCost * (1.5 ** level));
  }

  function generateScenery(container) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 90; i += 1) {
      const star = document.createElement('span');
      star.className = 'scene-star';
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.animationDelay = `${Math.random() * 6}s`;
      fragment.appendChild(star);
    }
    container.appendChild(fragment);
  }

  function getLevel(entityId) {
    return Number(localStorage.getItem(`${LV_PREFIX}${entityId}`) || 0);
  }

  function setLevel(entityId, level) {
    localStorage.setItem(`${LV_PREFIX}${entityId}`, String(level));
  }

  function getSparks() {
    const existing = Number(localStorage.getItem(SPARKS_KEY));
    if (Number.isFinite(existing) && existing > 0) return existing;
    localStorage.setItem(SPARKS_KEY, '5000');
    return 5000;
  }

  function setSparks(value) {
    localStorage.setItem(SPARKS_KEY, String(value));
  }

  function renderPaths(paths, entitiesById, svg) {
    const ns = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '';
    paths.forEach((path) => {
      const from = entitiesById.get(path.from);
      const to = entitiesById.get(path.to);
      if (!from || !to) return;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      line.setAttribute('class', 'knowledge-path');
      svg.appendChild(line);
    });
  }

  async function initMapEngine() {
    const [entities, paths] = await Promise.all([
      loadJson('./data/entities.json'),
      loadJson('./data/paths.json')
    ]);

    const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
    const viewport = document.getElementById('map-viewport');
    const mapLayer = document.getElementById('map-layer');
    const entitiesLayer = document.getElementById('entities-layer');
    const pathsLayer = document.getElementById('paths-layer');
    const sparksValue = document.getElementById('sparks-value');
    const sceneryLayer = document.getElementById('scenery-layer');

    renderPaths(paths, entitiesById, pathsLayer);
    generateScenery(sceneryLayer);

    const navigation = global.ViaLogicNavigation.createNavigation(viewport, mapLayer, (id) => entitiesById.get(id));

    const renderer = global.ViaLogicEntityRenderer.createEntityRenderer({
      entities,
      entitiesLayer,
      getLevel,
      onSelect: (entityId) => {
        navigation.centerOn(entityId);
        modal.openModal(entityId);
      }
    });

    const modal = global.ViaLogicModalSystem.createModalSystem({
      entitiesById,
      getLevel,
      getSparks,
      calculateUpgradeCost,
      scaleBuff: renderer.scaleBuff,
      onUpgrade: (entityId) => {
        const entity = entitiesById.get(entityId);
        const level = getLevel(entityId);
        const cost = calculateUpgradeCost(entity.cost, level);
        const sparks = getSparks();
        if (sparks < cost) return;
        setSparks(sparks - cost);
        setLevel(entityId, level + 1);
        renderer.updateEntityLevel(entityId);
        sparksValue.textContent = getSparks();
        modal.updateUpgradeButton(entityId);
      },
      onClose: () => {}
    });

    renderer.renderEntities();
    sparksValue.textContent = getSparks();

    global.ViaLogicMap = {
      zoomMap: navigation.zoomMap,
      centerOn: navigation.centerOn,
      updateMapTransform: navigation.updateMapTransform,
      openModal: modal.openModal,
      closeModal: modal.closeModal,
      updateUpgradeButton: modal.updateUpgradeButton,
      renderEntities: renderer.renderEntities,
      createEntityNode: renderer.createEntityNode,
      updateEntityLevel: renderer.updateEntityLevel,
      generateScenery
    };
  }

  global.addEventListener('DOMContentLoaded', () => {
    initMapEngine().catch((error) => {
      const el = document.getElementById('map-error');
      if (el) el.textContent = error.message;
    });
  });
})(window);
