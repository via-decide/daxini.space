(() => {
  'use strict';

  const DEFAULT_TOKENS = {
    cyan: '#00e5ff',
    saffron: '#ff671f',
    blur: '16px',
    radius: '18px'
  };

  const DEFAULT_METADATA = {
    id: 'unknown',
    name: 'Unknown Persona',
    title: 'Daxini OS Entity',
    summary: 'Metadata unavailable. Running with Daxini fallback profile.',
    design_tokens: DEFAULT_TOKENS
  };

  const CSS_ID = 'daxini-renderer-styles';

  function ensureStyles() {
    if (document.getElementById(CSS_ID)) return;

    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Syne:wght@500;700;800&display=swap');

      .daxini-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
        align-items: stretch;
        padding: 16px;
      }

      .daxini-card {
        position: relative;
        min-height: 270px;
        border: 1px solid var(--dx-cyan);
        border-radius: var(--dx-radius);
        background: linear-gradient(135deg, rgba(5, 20, 35, 0.75), rgba(10, 10, 18, 0.62));
        box-shadow:
          0 0 0 1px rgba(0, 229, 255, 0.2) inset,
          0 8px 32px rgba(0, 0, 0, 0.35),
          0 0 32px rgba(255, 103, 31, 0.15);
        backdrop-filter: blur(var(--dx-blur));
        -webkit-backdrop-filter: blur(var(--dx-blur));
        overflow: hidden;
        transition: transform 180ms ease, box-shadow 220ms ease;
      }

      .daxini-card:hover {
        transform: translateY(-3px);
        animation: daxini-quantum-pulse 1.2s ease-in-out;
      }

      @keyframes daxini-quantum-pulse {
        0% { box-shadow: 0 0 0 1px rgba(0, 229, 255, 0.18) inset, 0 0 16px rgba(255, 103, 31, 0.2); }
        50% { box-shadow: 0 0 0 1px rgba(0, 229, 255, 0.5) inset, 0 0 42px rgba(255, 103, 31, 0.42); }
        100% { box-shadow: 0 0 0 1px rgba(0, 229, 255, 0.2) inset, 0 0 16px rgba(255, 103, 31, 0.2); }
      }

      .daxini-card__body { padding: 16px; display: grid; gap: 10px; }
      .daxini-card__name { font-family: 'Syne', sans-serif; font-size: 1.3rem; font-weight: 700; color: #e8feff; }
      .daxini-card__title { color: #98dce7; font-size: 0.92rem; }
      .daxini-card__bio {
        color: #d4e5ea;
        line-height: 1.4;
        font-size: 0.95rem;
        max-height: 88px;
        overflow: auto;
      }
      .daxini-card__controls { display: flex; gap: 8px; align-items: center; }
      .daxini-btn {
        border: 1px solid var(--dx-cyan);
        color: #defbff;
        background: rgba(0, 229, 255, 0.12);
        padding: 8px 10px;
        border-radius: 10px;
        cursor: pointer;
      }
      .daxini-output {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.82rem;
        color: #ffc8ae;
        background: rgba(255, 103, 31, 0.08);
        border: 1px solid rgba(255, 103, 31, 0.25);
        border-radius: 10px;
        padding: 10px;
        min-height: 72px;
        white-space: pre-wrap;
      }
    `;
    document.head.appendChild(style);
  }

  function sanitizeMetadata(data) {
    const merged = Object.assign({}, DEFAULT_METADATA, data || {});
    merged.design_tokens = Object.assign({}, DEFAULT_TOKENS, (data && data.design_tokens) || {});
    return merged;
  }

  function createCardElement(metadata, bio) {
    const card = document.createElement('article');
    card.className = 'daxini-card';
    card.style.setProperty('--dx-cyan', metadata.design_tokens.cyan || DEFAULT_TOKENS.cyan);
    card.style.setProperty('--dx-saffron', metadata.design_tokens.saffron || DEFAULT_TOKENS.saffron);
    card.style.setProperty('--dx-blur', metadata.design_tokens.blur || DEFAULT_TOKENS.blur);
    card.style.setProperty('--dx-radius', metadata.design_tokens.radius || DEFAULT_TOKENS.radius);

    const bioText = (bio || metadata.summary || DEFAULT_METADATA.summary).trim();

    card.innerHTML = `
      <div class="daxini-card__body">
        <h3 class="daxini-card__name">${escapeHtml(metadata.name)}</h3>
        <p class="daxini-card__title">${escapeHtml(metadata.title)}</p>
        <p class="daxini-card__bio">${escapeHtml(bioText)}</p>
        <div class="daxini-card__controls">
          <button type="button" class="daxini-btn" data-run-logic>⚙️ RUN LOGIC</button>
        </div>
        <pre class="daxini-output" data-logic-output>Logic sandbox is idle.</pre>
      </div>
    `;

    return card;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderCard(data, bio) {
    ensureStyles();
    const metadata = sanitizeMetadata(data);
    return createCardElement(metadata, bio);
  }

  window.DaxiniRenderer = {
    renderCard,
    defaults: {
      metadata: DEFAULT_METADATA,
      tokens: DEFAULT_TOKENS
    }
  };
})();
