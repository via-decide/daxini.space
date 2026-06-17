/**
 * pattern-engine.js — Daxini Grid Pattern Navigation Engine
 * 
 * Handles normalization, resolution, graph lineage, search, share,
 * memory caching, and state management for pattern-based routing.
 */

(function (global) {
  'use strict';

  // Storage keys
  const STORAGE_KEYS = {
    REGISTRY: 'daxini_pattern_registry',
    HISTORY: 'daxini_pattern_history',
    PINNED: 'daxini_pattern_pinned'
  };

  // Default app mappings (relative to 1-based grid coordinates 1-9)
  // 1:TL, 2:TC, 3:TR, 4:CL, 5:CC, 6:CR, 7:BL, 8:BC, 9:BR
  const DEFAULT_APP_PATTERNS = {
    '51': { slug: 'logichub', name: 'LogicHub', icon: '⚡', url: 'https://logichub.app', status: 'live' },
    '52': { slug: 'daxini-hq', name: 'Daxini HQ', icon: '🏢', url: 'https://daxini.xyz', status: 'live' },
    '53': { slug: 'prompt-alchemy', name: 'Prompt Alchemy', icon: '⚗️', url: 'https://via-decide.github.io/PromptAlchemy/', status: 'live' },
    '54': { slug: 'sop-builder', name: 'SOP Builder', icon: '📄', url: 'offline', status: 'pending' },
    '56': { slug: 'daxini-lens', name: 'Daxini Lens', icon: '🎬', url: 'https://via-decide.github.io/video-to-pdf/', status: 'live' },
    '57': { slug: 'via-logic', name: 'ViaLogic', icon: '🕹️', url: '/apps/vialogic/index.html', status: 'live' },
    '58': { slug: 'studyos', name: 'StudyOS', icon: '📚', url: 'https://github.com/via-decide/decide.engine-tools/tree/159f80de375e17c26219b5a265c4c4d4ca8bb22c/StudyOS', status: 'live' },
    '59': { slug: 'alchemist', name: 'Alchemist', icon: '🧪', url: '/apps/alchemist/index.html', status: 'live' },
    '52-25': { slug: 'marketplace', name: 'Marketplace', icon: '🌌', url: '/apps/marketplace/index.html', status: 'live' },
    '14-47-76-63-34-45-52-25-58': { slug: 'daxini-hq', name: 'Master Overlord Console', icon: '👑', url: 'https://daxini.xyz', status: 'live' }
  };

  class DaxiniPatternEngine {
    constructor() {
      this.registry = {};
      this.history = [];
      this.pinned = new Set();
      this.loadState();
    }

    loadState() {
      try {
        const storedRegistry = localStorage.getItem(STORAGE_KEYS.REGISTRY);
        if (storedRegistry) {
          this.registry = JSON.parse(storedRegistry);
        } else {
          this.initializeDefaultRegistry();
        }

        const storedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
        if (storedHistory) {
          this.history = JSON.parse(storedHistory);
        }

        const storedPinned = localStorage.getItem(STORAGE_KEYS.PINNED);
        if (storedPinned) {
          this.pinned = new Set(JSON.parse(storedPinned));
        }
      } catch (err) {
        console.error('[Pattern Engine] Error loading state from LocalStorage:', err);
        this.initializeDefaultRegistry();
      }
    }

    saveState() {
      try {
        localStorage.setItem(STORAGE_KEYS.REGISTRY, JSON.stringify(this.registry));
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(this.history));
        localStorage.setItem(STORAGE_KEYS.PINNED, JSON.stringify(Array.from(this.pinned)));
      } catch (err) {
        console.error('[Pattern Engine] Error saving state:', err);
      }
    }

    initializeDefaultRegistry() {
      this.registry = {};
      Object.entries(DEFAULT_APP_PATTERNS).forEach(([chain, data]) => {
        const patternId = this.hashChain(chain);
        this.registry[patternId] = {
          patternId,
          edgeChain: chain,
          name: data.name,
          slug: data.slug,
          icon: data.icon,
          url: data.url,
          status: data.status,
          owner: 'system',
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          visitCount: 0,
          shareCount: 0,
          workspaceCount: 1,
          parentNode: null,
          security: 'public',
          marketplaceStatus: data.slug === 'marketplace' ? 'commercial' : 'none'
        };
      });
      this.saveState();
    }

    hashChain(edgeChain) {
      let hash = 5381;
      for (let i = 0; i < edgeChain.length; i++) {
        hash = ((hash << 5) + hash) + edgeChain.charCodeAt(i);
      }
      return 'P' + Math.abs(hash).toString(36).toUpperCase();
    }

    normalize(rawPath) {
      if (!Array.isArray(rawPath)) {
        if (typeof rawPath === 'string') {
          rawPath = rawPath.split(',').map(s => parseInt(s.trim()));
        } else {
          throw new Error('Invalid raw pattern format');
        }
      }

      // Convert 0-based to 1-based if drawing coordinates are 0-8
      const isZeroBased = rawPath.every(v => v >= 0 && v <= 8);
      let normalized = rawPath.map(v => isZeroBased ? v + 1 : v);

      // Remove consecutive duplicates
      normalized = normalized.filter((v, i) => i === 0 || v !== normalized[i - 1]);

      // Filter valid points in range [1, 9]
      normalized = normalized.filter(v => v >= 1 && v <= 9);

      if (normalized.length < 2) {
        throw new Error('Pattern too short. Connect at least 2 points.');
      }

      return normalized;
    }

    generateEdgeChain(path) {
      const edges = [];
      for (let i = 0; i < path.length - 1; i++) {
        edges.push(`${path[i]}${path[i + 1]}`);
      }
      return edges.join('-');
    }

    resolvePattern(rawPath, parentPatternId = null) {
      let path;
      try {
        path = this.normalize(rawPath);
      } catch (err) {
        return { error: err.message };
      }

      const chain = this.generateEdgeChain(path);
      const patternId = this.hashChain(chain);

      // Current User node check
      const currentIdentity = localStorage.getItem('sovereign_token') ? 'owner' : 'guest';

      if (!this.registry[patternId]) {
        // Create dynamic address node
        this.registry[patternId] = {
          patternId,
          edgeChain: chain,
          name: `Unmapped Node ${patternId}`,
          slug: `node-${patternId.toLowerCase()}`,
          icon: '🔮',
          url: 'offline',
          status: 'pending',
          owner: currentIdentity,
          createdBy: currentIdentity,
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          visitCount: 0,
          shareCount: 0,
          workspaceCount: 1,
          parentNode: parentPatternId,
          security: 'private',
          marketplaceStatus: 'none'
        };
      }

      const node = this.registry[patternId];
      node.visitCount++;
      node.lastAccessed = new Date().toISOString();

      // Parent-Child Linage mapping
      if (parentPatternId && parentPatternId !== patternId) {
        node.parentNode = parentPatternId;
        const parentNode = this.registry[parentPatternId];
        if (parentNode && !parentNode.childCount) {
          parentNode.childCount = 1;
        } else if (parentNode) {
          parentNode.childCount++;
        }
      }

      // Update Memory Recents
      this.history = this.history.filter(id => id !== patternId);
      this.history.unshift(patternId);
      if (this.history.length > 20) {
        this.history.pop();
      }

      this.saveState();
      return { node, success: true };
    }

    searchPatterns(query) {
      if (!query) return [];
      const normalizedQuery = query.trim().replace(/\s+/g, '');
      
      return Object.values(this.registry).filter(node => {
        return node.edgeChain.includes(normalizedQuery) ||
               node.name.toLowerCase().includes(normalizedQuery.toLowerCase()) ||
               node.patternId.toLowerCase().includes(normalizedQuery.toLowerCase());
      });
    }

    getRecommendations() {
      const recents = this.history.map(id => this.registry[id]).filter(Boolean);
      const pinned = Array.from(this.pinned).map(id => this.registry[id]).filter(Boolean);
      
      const mostVisited = Object.values(this.registry)
        .filter(node => node.visitCount > 0)
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 5);

      // Habit engine: combine frequency and recency
      const now = new Date().getTime();
      const habits = Object.values(this.registry)
        .filter(node => node.visitCount > 0 && !this.pinned.has(node.patternId))
        .map(node => {
          const lastAcc = new Date(node.lastAccessed || node.createdAt).getTime();
          const daysSince = Math.max(0, (now - lastAcc) / (1000 * 60 * 60 * 24));
          // Score = visits / (days + 1)^1.5  -- heavily prioritizes recently used frequent items
          const score = node.visitCount / Math.pow(daysSince + 1, 1.5);
          return { node, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(h => h.node);

      return { recents, pinned, mostVisited, habits };
    }

    togglePin(patternId) {
      if (this.pinned.has(patternId)) {
        this.pinned.delete(patternId);
      } else {
        this.pinned.add(patternId);
      }
      this.saveState();
      return this.pinned.has(patternId);
    }

    updateNode(patternId, updates) {
      if (this.registry[patternId]) {
        this.registry[patternId] = { ...this.registry[patternId], ...updates };
        this.saveState();
        return this.registry[patternId];
      }
      return null;
    }

    getLineage(patternId) {
      const node = this.registry[patternId];
      if (!node) return null;

      const parentNode = node.parentNode ? this.registry[node.parentNode] : null;
      const children = Object.values(this.registry).filter(n => n.parentNode === patternId);
      
      // Related nodes: share any same edge transition
      const edges = node.edgeChain.split('-');
      const related = Object.values(this.registry).filter(n => {
        if (n.patternId === patternId) return false;
        const nEdges = n.edgeChain.split('-');
        return edges.some(e => nEdges.includes(e));
      }).slice(0, 3);

      return {
        current: node,
        parent: parentNode,
        children,
        related
      };
    }

    getShareToken(patternId) {
      return `daxini://p/${patternId}`;
    }

    resolveShareToken(token) {
      if (!token) return null;
      const match = token.trim().match(/daxini:\/\/p\/([a-zA-Z0-9]+)/i);
      if (match) {
        const patternId = match[1].toUpperCase();
        return this.registry[patternId] || null;
      }
      // Try resolving raw PatternID direct
      const directId = token.trim().toUpperCase();
      return this.registry[directId] || null;
    }
  }

  // Export globally
  global.DaxiniPatternEngine = new DaxiniPatternEngine();

})(window);
