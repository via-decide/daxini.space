/**
 * daxini-registry.js — Sovereign App Registry
 * 
 * Manages the Daxini Galaxy, app library, and related-app discovery.
 */

const ROOM_POSITIONS = [0, 1, 2, 3, 5, 6, 7, 8];
const DEFAULT_ROOM_SLUGS = [
  'logichub',
  'daxini-hq',
  'prompt-alchemy',
  'sop-builder',
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
    url: 'https://logichub.app',
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
    url: 'https://daxini.xyz',
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
    url: 'https://via-decide.github.io/PromptAlchemy/',
    status: 'live',
    desc: 'Prompt generation and prompt improvement studio',
    ownerType: 'mine',
    tier: 'core',
    tags: ['prompt', 'writing', 'llm', 'text', 'creator']
  },
  {
    slug: 'sop-builder',
    name: 'SOP Builder',
    icon: '📄',
    url: 'offline',
    status: 'pending',
    desc: 'Standard operating procedure builder',
    ownerType: 'mine',
    tier: 'core',
    tags: ['document', 'ops', 'workflow', 'business']
  },
  {
    slug: 'daxini-lens',
    name: 'Daxini Lens',
    icon: '🎬',
    url: 'https://via-decide.github.io/video-to-pdf/',
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
    url: 'https://github.com/via-decide/decide.engine-tools/tree/159f80de375e17c26219b5a265c4c4d4ca8bb22c/StudyOS',
    status: 'live',
    desc: 'Modular study engine for exams',
    ownerType: 'mine',
    tier: 'core',
    tags: ['study', 'learning', 'exam', 'education']
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

window.DaxiniRegistry = {
  APP_LIBRARY,
  CORE_APPS,
  ROOM_POSITIONS,
  DEFAULT_ROOM_SLUGS,
  upsertApp,
  getAppBySlug
};
