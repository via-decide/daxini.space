(function (global) {
  'use strict';

  function createModalSystem({ entitiesById, getLevel, getSparks, calculateUpgradeCost, onUpgrade, onClose, scaleBuff }) {
    const modal = document.getElementById('entity-modal');
    const content = modal.querySelector('[data-modal-content]');

    function updateUpgradeButton(entityId) {
      const entity = entitiesById.get(entityId);
      if (!entity) return;
      const level = getLevel(entityId);
      const cost = calculateUpgradeCost(entity.cost, level);
      const sparks = getSparks();
      const button = content.querySelector('[data-upgrade]');
      button.disabled = sparks < cost;
      button.textContent = `Upgrade · ${cost} sparks`;
    }

    function openModal(entityId) {
      const entity = entitiesById.get(entityId);
      if (!entity) return;
      const level = getLevel(entityId);
      const buffs = entity.buffs
        .map((buff) => `<li>${buff.name}: <strong>+${scaleBuff(buff, level)}</strong></li>`)
        .join('');

      content.innerHTML = `
        <header class="modal__header">
          <h2>${entity.icon} ${entity.name}</h2>
          <button type="button" class="modal__close" data-close>✕</button>
        </header>
        <p class="modal__title">${entity.title}</p>
        <p>Level: <strong data-level>${level}</strong></p>
        <p>Power Rating: <strong>${entity.power}</strong></p>
        <ul class="modal__buffs">${buffs}</ul>
        <div class="modal__actions">
          <button type="button" data-upgrade>Upgrade</button>
          <a class="modal__link" href="./${entity.path}">Open Thinker Page</a>
        </div>
      `;

      content.querySelector('[data-close]').addEventListener('click', closeModal);
      content.querySelector('[data-upgrade]').addEventListener('click', () => onUpgrade(entityId));
      modal.dataset.entityId = entityId;
      updateUpgradeButton(entityId);
      modal.classList.add('is-open');
    }

    function closeModal() {
      modal.classList.remove('is-open');
      onClose();
    }

    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });

    return {
      openModal,
      closeModal,
      updateUpgradeButton
    };
  }

  global.ViaLogicModalSystem = {
    createModalSystem
  };
})(window);
