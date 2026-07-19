/**
 * daxini-registry.js — Sovereign App Registry
 * 
 * Manages the Daxini Galaxy, app library, and related-app discovery.
 */

(function (global) {
  'use strict';

  const ROOM_POSITIONS = [0, 1, 2, 3, 5, 6, 7, 8];
const DEFAULT_ROOM_SLUGS = [
  'logichub',
  'daxini-hq',
  'prompt-alchemy',
  'orchade',
  'daxini-lens',
  'via-logic',
  'studyos',
  'alchemist'
];

const CORE_APPS = [
  {
    slug: 'logichub',
    name: 'LogicHub',
    icon: '⚡',
    url: '/apps/logichub/index.html',
    status: 'live',
    desc: 'AI app builder for non-technical users who want prompt apps, workflow tools, and APK-ready prototypes',
    ownerType: 'mine',
    tier: 'core',
    tags: ['builder', 'app', 'workflow', 'logic', 'apk']
  },
  {
    slug: 'daxini-hq',
    name: 'Daxini HQ',
    icon: '🏢',
    url: '/apps/daxini-hq/index.html',
    status: 'live',
    desc: 'Holding company and ecosystem index',
    ownerType: 'mine',
    tier: 'core',
    tags: ['company', 'hub', 'ecosystem']
  },
  {
    slug: 'prompt-alchemy',
    name: 'Prompt Alchemy',
    icon: '⚗️',
    url: '/apps/prompt-alchemy/index.html',
    status: 'live',
    desc: 'Prompt generation and prompt improvement studio',
    ownerType: 'mine',
    tier: 'core',
    tags: ['prompt', 'writing', 'llm', 'text', 'creator']
  },
  {
    slug: 'orchade',
    name: 'Orchade',
    icon: '🌳',
    url: '/apps/orchade/index.html',
    status: 'live',
    desc: 'AI orchestration simulation game',
    ownerType: 'mine',
    tier: 'core',
    tags: ['game', 'simulation', 'ai', 'orchestration']
  },
  {
    slug: 'daxini-lens',
    name: 'Daxini Lens',
    icon: '🎬',
    url: '/apps/daxini-lens/index.html',
    status: 'live',
    desc: 'Turn screen recordings into PDF guides',
    ownerType: 'mine',
    tier: 'core',
    tags: ['video', 'documentation', 'guide', 'export']
  },
  {
    slug: 'via-logic',
    name: 'ViaLogic',
    icon: '🕹️',
    url: '/apps/vialogic/index.html',
    status: 'live',
    desc: 'Cosmic Knowledge Atlas and Global Map Engine for exploring interconnected logical nodes.',
    ownerType: 'mine',
    tier: 'core',
    tags: ['game', 'logic', 'mapping', 'atlas']
  },
  {
    slug: 'alchemist',
    name: 'Alchemist',
    icon: '🧪',
    url: '/apps/alchemist/index.html',
    status: 'live',
    desc: 'Physics-based Kinetic UI for exploring chemical reasoning and technical SOPs.',
    ownerType: 'mine',
    tier: 'core',
    tags: ['chemistry', 'education', 'logic', 'kinetic']
  },
  {
    slug: 'studyos',
    name: 'StudyOS',
    icon: '📚',
    url: '/apps/studyos/index.html',
    status: 'live',
    desc: 'Modular study engine for exams',
    ownerType: 'mine',
    tier: 'core',
    tags: ['study', 'learning', 'exam', 'education']
  },
  {
    slug: 'zayvora-chat',
    name: 'Zayvora Chat',
    icon: '💬',
    url: '/apps/zayvora-chat/index.html',
    status: 'live',
    desc: 'Database-less chat experiment using the LLM conversation thread itself as a temporary message bus.',
    ownerType: 'mine',
    tier: 'experimental',
    tags: ['chat', 'llm', 'experiment', 'bus']
  }
];

let APP_LIBRARY = [...CORE_APPS];

function upsertApp(app) {
  const existingIndex = APP_LIBRARY.findIndex(item => item.slug === app.slug);
  if (existingIndex >= 0) APP_LIBRARY[existingIndex] = { ...APP_LIBRARY[existingIndex], ...app };
  else APP_LIBRARY.push(app);
}

function getAppBySlug(slug) {
  return APP_LIBRARY.find(app => app.slug === slug) || null;
}

const NAMESPACE_MAP = {
  '0,3,6': 'infrastructure',
  '1,4,7': 'intelligence',
  '2,5,8': 'creativity',
  '0,1,2': 'productivity',
  '6,7,8': 'social',
  '0,4,8': 'experimental'
};

async function fetchShard(seed) {
  const category = NAMESPACE_MAP[seed];
  if (!category) return null;

  console.log(`[SHARDER] Resolving namespace: ${category}...`);
  
  // ANTIGRAVITY CIRCUIT BREAKER: 5s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`./registry/shards/${category}.json`, { 
      signal: controller.signal,
      cache: 'no-store' 
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const shardData = await response.json();
      if (shardData.apps) {
        shardData.apps.forEach(app => upsertApp(app));
        return shardData.apps;
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.error(`[SHARDER] Shard ${category} timeout (Offline or Heavy Load)`);
    } else {
      console.warn(`[SHARDER] Shard ${category} unavailable:`, e);
    }
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

  global.DaxiniRegistry = {
    APP_LIBRARY,
    CORE_APPS,
    ROOM_POSITIONS,
    DEFAULT_ROOM_SLUGS,
    NAMESPACE_MAP,
    upsertApp,
    getAppBySlug,
    fetchShard
  };
})(window);
