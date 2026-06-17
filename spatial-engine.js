/**
 * spatial-engine.js — Daxini Spatial OS Engine
 * 
 * Replaces pattern-engine.js to implement a recursive 3D Floor & Room topology,
 * strict Dot 5 parent anchors, and lineage state tracking.
 */

(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    REGISTRY: 'daxini_spatial_registry',
    HISTORY: 'daxini_spatial_history',
    PINNED: 'daxini_spatial_pinned',
    STATE: 'daxini_spatial_state'
  };

  const ROOT_FLOOR_ID = 'ROOT';

  // Seed standard apps into the ROOT floor namespace
  const DEFAULT_APP_PATTERNS = {
    'ROOT:51': { slug: 'logichub', name: 'LogicHub', icon: '⚡', url: 'https://logichub.app', status: 'live' },
    'ROOT:52': { slug: 'daxini-hq', name: 'Daxini HQ', icon: '🏢', url: 'https://daxini.xyz', status: 'live' },
    'ROOT:53': { slug: 'prompt-alchemy', name: 'Prompt Alchemy', icon: '⚗️', url: 'https://via-decide.github.io/PromptAlchemy/', status: 'live' },
    'ROOT:54': { slug: 'sop-builder', name: 'SOP Builder', icon: '📄', url: 'offline', status: 'pending' },
    'ROOT:56': { slug: 'daxini-lens', name: 'Daxini Lens', icon: '🎬', url: 'https://via-decide.github.io/video-to-pdf/', status: 'live' },
    'ROOT:57': { slug: 'via-logic', name: 'ViaLogic', icon: '🕹️', url: '/apps/vialogic/index.html', status: 'live' },
    'ROOT:58': { slug: 'studyos', name: 'StudyOS', icon: '📚', url: 'https://github.com/via-decide/decide.engine-tools/tree/159f80de375e17c26219b5a265c4c4d4ca8bb22c/StudyOS', status: 'live' },
    'ROOT:59': { slug: 'alchemist', name: 'Alchemist', icon: '🧪', url: '/apps/alchemist/index.html', status: 'live' },
    'ROOT:52-25': { slug: 'marketplace', name: 'Marketplace', icon: '🌌', url: '/apps/marketplace/index.html', status: 'live' }
  };

  class DaxiniSpatialEngine {
    constructor() {
      this.registry = {};
      this.history = [];
      this.pinned = new Set();
      
      this.currentFloorId = ROOT_FLOOR_ID;
      this.currentZ = 0;
      
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
        if (storedHistory) this.history = JSON.parse(storedHistory);

        const storedPinned = localStorage.getItem(STORAGE_KEYS.PINNED);
        if (storedPinned) this.pinned = new Set(JSON.parse(storedPinned));

        const storedState = localStorage.getItem(STORAGE_KEYS.STATE);
        if (storedState) {
          const state = JSON.parse(storedState);
          this.currentFloorId = state.currentFloorId || ROOT_FLOOR_ID;
          this.currentZ = state.currentZ || 0;
        }
      } catch (err) {
        console.error('[Spatial Engine] Error loading state:', err);
        this.initializeDefaultRegistry();
      }
    }

    saveState() {
      try {
        localStorage.setItem(STORAGE_KEYS.REGISTRY, JSON.stringify(this.registry));
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(this.history));
        localStorage.setItem(STORAGE_KEYS.PINNED, JSON.stringify(Array.from(this.pinned)));
        localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify({
          currentFloorId: this.currentFloorId,
          currentZ: this.currentZ
        }));
      } catch (err) {
        console.error('[Spatial Engine] Error saving state:', err);
      }
    }

    initializeDefaultRegistry() {
      this.registry = {
        [ROOT_FLOOR_ID]: {
          patternId: ROOT_FLOOR_ID,
          edgeChain: 'ROOT',
          name: 'Workspace Base Floor',
          icon: '🌌',
          url: 'offline',
          status: 'live',
          owner: 'system',
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          visitCount: 1,
          zLayer: 0,
          parentNode: null,
          childCount: Object.keys(DEFAULT_APP_PATTERNS).length,
          artifacts: []
        }
      };

      Object.entries(DEFAULT_APP_PATTERNS).forEach(([contextChain, data]) => {
        const patternId = this.hashChain(contextChain);
        this.registry[patternId] = {
          patternId,
          edgeChain: contextChain.split(':')[1], // Just the visual edge chain
          contextChain: contextChain, // Full contextual path
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
          zLayer: 1,
          parentNode: ROOT_FLOOR_ID,
          childCount: 0,
          security: 'public',
          marketplaceStatus: data.slug === 'marketplace' ? 'commercial' : 'none',
          artifacts: []
        };
      });
      this.saveState();
    }

    hashChain(chain) {
      let hash = 5381;
      for (let i = 0; i < chain.length; i++) {
        hash = ((hash << 5) + hash) + chain.charCodeAt(i);
      }
      return 'P' + Math.abs(hash).toString(36).toUpperCase();
    }

    normalize(rawPath) {
      if (!Array.isArray(rawPath)) {
        if (typeof rawPath === 'string') rawPath = rawPath.split(',').map(s => parseInt(s.trim()));
        else throw new Error('Invalid raw pattern format');
      }

      const isZeroBased = rawPath.every(v => v >= 0 && v <= 8);
      let normalized = rawPath.map(v => isZeroBased ? v + 1 : v);
      normalized = normalized.filter((v, i) => i === 0 || v !== normalized[i - 1]);
      normalized = normalized.filter(v => v >= 1 && v <= 9);

      if (normalized.length === 0) throw new Error('Empty pattern');
      return normalized;
    }

    generateEdgeChain(path) {
      if (path.length === 1) return path[0].toString();
      const edges = [];
      for (let i = 0; i < path.length - 1; i++) {
        edges.push(`${path[i]}${path[i + 1]}`);
      }
      return edges.join('-');
    }

    returnToParent() {
      if (this.currentFloorId === ROOT_FLOOR_ID) {
        return { success: false, error: 'Already at root floor' };
      }
      
      const currentNode = this.registry[this.currentFloorId];
      if (currentNode && currentNode.parentNode) {
        this.currentFloorId = currentNode.parentNode;
        this.currentZ = Math.max(0, this.currentZ - 1);
        this.saveState();
        return { node: this.registry[this.currentFloorId], success: true, action: 'descend' };
      }
      
      this.currentFloorId = ROOT_FLOOR_ID;
      this.currentZ = 0;
      this.saveState();
      return { node: this.registry[ROOT_FLOOR_ID], success: true, action: 'descend' };
    }

    resolvePattern(rawPath) {
      let path;
      try {
        path = this.normalize(rawPath);
      } catch (err) {
        return { error: err.message };
      }

      // Dot 5 Rule: Universal Return Anchor
      if (path.length === 1 && path[0] === 5) {
        return this.returnToParent();
      }

      if (path.length < 2 && path[0] !== 5) {
        // We can allow single dot taps (e.g., tap 8 to go to marketplace)
        // Let's assume a single dot is a valid room transition on this floor.
      }

      const chain = this.generateEdgeChain(path);
      const contextChain = `${this.currentFloorId}:${chain}`;
      const patternId = this.hashChain(contextChain);

      const currentIdentity = localStorage.getItem('sovereign_token') ? 'owner' : 'guest';

      if (!this.registry[patternId]) {
        // Generate new recursive floor node
        this.registry[patternId] = {
          patternId,
          edgeChain: chain,
          contextChain: contextChain,
          name: `Sector ${patternId.slice(0, 4)}`,
          slug: `room-${patternId.toLowerCase()}`,
          icon: '🔮',
          url: 'offline',
          status: 'pending',
          owner: currentIdentity,
          createdBy: currentIdentity,
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          visitCount: 0,
          zLayer: this.currentZ + 1,
          parentNode: this.currentFloorId,
          childCount: 0,
          security: 'private',
          marketplaceStatus: 'none',
          artifacts: []
        };
        
        const parentNode = this.registry[this.currentFloorId];
        if (parentNode) parentNode.childCount++;
      }

      const node = this.registry[patternId];
      node.visitCount++;
      node.lastAccessed = new Date().toISOString();

      // Enter the new floor
      this.currentFloorId = patternId;
      this.currentZ = node.zLayer;

      // Update Memory Recents
      this.history = this.history.filter(id => id !== patternId);
      this.history.unshift(patternId);
      if (this.history.length > 30) this.history.pop();

      this.saveState();
      return { node, success: true, action: 'ascend' };
    }

    searchPatterns(query) {
      if (!query) return [];
      const q = query.trim().replace(/\s+/g, '').toLowerCase();
      return Object.values(this.registry).filter(node => 
        node.edgeChain.includes(q) || node.name.toLowerCase().includes(q) || node.patternId.toLowerCase().includes(q)
      );
    }

    togglePin(patternId) {
      if (this.pinned.has(patternId)) this.pinned.delete(patternId);
      else this.pinned.add(patternId);
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

    addArtifact(patternId, artifactRef) {
      if (this.registry[patternId]) {
        if (!this.registry[patternId].artifacts) this.registry[patternId].artifacts = [];
        this.registry[patternId].artifacts.push(artifactRef);
        this.saveState();
        return true;
      }
      return false;
    }

    getRecommendations() {
      // Habitual Traversals: Nodes with high visit counts sorted by frequency
      const habits = Object.values(this.registry)
        .filter(n => n.visitCount > 0 && n.patternId !== ROOT_FLOOR_ID)
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 5);

      // Pinned Nodes
      const pinnedNodes = Array.from(this.pinned)
        .map(id => this.registry[id])
        .filter(Boolean);

      return { habits, pinned: pinnedNodes };
    }

    getLineage(patternId) {
      const node = this.registry[patternId];
      if (!node) return null;

      const parentNode = node.parentNode ? this.registry[node.parentNode] : null;
      const children = Object.values(this.registry).filter(n => n.parentNode === patternId);

      return { current: node, parent: parentNode, children };
    }

    getShareToken(patternId) {
      return `daxini://p/${patternId}`;
    }

    resolveShareToken(token) {
      if (!token) return null;
      const match = token.trim().match(/daxini:\/\/p\/([a-zA-Z0-9]+)/i);
      const id = match ? match[1].toUpperCase() : token.trim().toUpperCase();
      
      const node = this.registry[id];
      if (node) {
        // Auto-teleport to this floor
        this.currentFloorId = node.patternId;
        this.currentZ = node.zLayer;
        this.saveState();
        return node;
      }
      return null;
    }
  }

  global.DaxiniSpatialEngine = new DaxiniSpatialEngine();
  
  // Backwards compatibility alias for components not yet migrated
  global.DaxiniPatternEngine = global.DaxiniSpatialEngine;

})(window);
