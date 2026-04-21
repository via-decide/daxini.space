'use strict';

function renderComponent(component = {}, state = {}) {
  const tagName = component.tag || 'div';
  const element = document.createElement(tagName);
  if (component.id) element.id = component.id;
  if (component.className) element.className = component.className;
  if (component.text) element.textContent = component.text;

  const bindings = component.bindings || {};
  Object.keys(bindings).forEach((attribute) => {
    const stateKey = bindings[attribute];
    if (stateKey in state) {
      element.setAttribute(attribute, state[stateKey]);
    }
  });

  return element;
}

function renderBundle(container, bundle = {}, state = {}) {
  const components = Array.isArray(bundle.components) ? bundle.components : [];
  container.innerHTML = '';
  components.forEach((component) => container.appendChild(renderComponent(component, state)));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderComponent, renderBundle };
}

if (typeof window !== 'undefined') {
  window.DaxiniComponentRenderer = { renderComponent, renderBundle };
}
