'use strict';

function createAppCard(app, actions = {}) {
  const card = document.createElement('article');
  card.className = 'marketplace-card';
  card.style.cssText = [
    'background:#101726',
    'border:1px solid #22334f',
    'border-radius:12px',
    'padding:14px',
    'display:flex',
    'flex-direction:column',
    'gap:8px'
  ].join(';');

  const title = document.createElement('h3');
  title.textContent = app.name;
  title.style.margin = '0';

  const meta = document.createElement('p');
  const createdAt = app.provenance && app.provenance.created_at ? app.provenance.created_at : (app.created_at || app.createdAt || 'unknown');
  meta.textContent = `Creator: ${app.creator} • Created: ${createdAt} • Category: ${app.category}`;
  meta.style.cssText = 'margin:0;color:#9fb3d1;font-size:13px';

  const provenance = document.createElement('p');
  const versionCount = app.provenance && Array.isArray(app.provenance.version_history) ? app.provenance.version_history.length : 0;
  provenance.textContent = `Version history: ${versionCount || 1} release${versionCount === 1 ? '' : 's'} • Remix lineage: ${app.provenance && app.provenance.remix_parent ? `asset → derived_from → ${app.provenance.remix_parent}` : 'Original asset'}`;
  provenance.style.cssText = 'margin:0;color:#89a8d6;font-size:12px';

  const monetization = document.createElement('p');
  const model = app.monetization && app.monetization.pricing_model ? app.monetization.pricing_model : 'free';
  const fee = app.monetization && Number.isFinite(Number(app.monetization.platform_fee_pct)) ? Number(app.monetization.platform_fee_pct) : 5;
  const security = app.compliance && app.compliance.security_validated ? 'security ✓' : 'security pending';
  const performance = app.compliance && app.compliance.performance_validated ? 'performance ✓' : 'performance pending';
  monetization.textContent = `PWA-first • ${model} • fee ${fee}% • ${security} • ${performance}`;
  monetization.style.cssText = 'margin:0;color:#7ee0b5;font-size:12px';

  const description = document.createElement('p');
  description.textContent = app.description || 'No description';
  description.style.cssText = 'margin:0;color:#dce7ff;font-size:13px';

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';

  const launchButton = document.createElement('button');
  launchButton.type = 'button';
  launchButton.textContent = 'Launch';
  launchButton.addEventListener('click', () => actions.onLaunch && actions.onLaunch(app));

  const duplicateButton = document.createElement('button');
  duplicateButton.type = 'button';
  duplicateButton.textContent = 'Duplicate';
  duplicateButton.addEventListener('click', () => actions.onDuplicate && actions.onDuplicate(app));

  const installButton = document.createElement('button');
  installButton.type = 'button';
  installButton.textContent = 'Install';
  installButton.addEventListener('click', () => actions.onInstall && actions.onInstall(app));

  controls.append(launchButton, duplicateButton, installButton);
  card.append(title, meta, provenance, monetization, description, controls);

  return card;
}

window.DaxiniMarketplaceCard = {
  createAppCard
};
