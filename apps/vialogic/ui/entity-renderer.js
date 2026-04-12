(function (global) {
  'use strict';

  function createEntityRenderer({ entities, entitiesLayer, getLevel, onSelect }) {
    const registry = new Map(entities.map((entity) => [entity.id, entity]));

    function scaleBuff(buff, level) {
      return (buff.value * (1 + level * 0.12)).toFixed(1);
    }

    function createEntityNode(entity) {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `entity entity--${entity.branch}`;
      node.dataset.entityId = entity.id;
      node.style.left = `${entity.x}px`;
      node.style.top = `${entity.y}px`;
      node.innerHTML = `
        <span class="entity__icon">${entity.icon}</span>
        <span class="entity__name">${entity.name}</span>
        <span class="entity__level">Lv ${getLevel(entity.id)}</span>
      `;
      node.addEventListener('click', () => onSelect(entity.id));
      return node;
    }

    function updateEntityLevel(entityId) {
      const entity = registry.get(entityId);
      if (!entity) return;
      const levelEl = entitiesLayer.querySelector(`[data-entity-id="${entityId}"] .entity__level`);
      if (levelEl) levelEl.textContent = `Lv ${getLevel(entityId)}`;
    }

    function renderEntities() {
      entitiesLayer.innerHTML = '';
      const fragment = document.createDocumentFragment();
      entities.forEach((entity) => {
        fragment.appendChild(createEntityNode(entity));
      });
      entitiesLayer.appendChild(fragment);
    }

    return {
      renderEntities,
      createEntityNode,
      updateEntityLevel,
      scaleBuff
    };
  }

  global.ViaLogicEntityRenderer = {
    createEntityRenderer
  };
})(window);
