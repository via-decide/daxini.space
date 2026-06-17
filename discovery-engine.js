/**
 * discovery-engine.js — Daxini Time-Based Discovery & SEO Ranking
 * 
 * Ranks artifacts and rooms based on engagement, lineage, traversal, 
 * and ownership rather than payment or sponsorship.
 */

(function(global) {
  'use strict';

  class DaxiniDiscoveryEngine {
    constructor() {
      // Base weights for ranking algorithm
      this.WEIGHTS = {
        READ_TIME: 1.5,      // Dwell time per visit (seconds)
        TRAVERSAL: 2.0,      // Pattern traffic frequency
        SAVE_RATE: 3.0,      // Ratio of pins/saves to visits
        REVISIT_RATE: 2.5,   // Ratio of returning users vs unique
        LINEAGE_DEPTH: 1.0,  // Number of verified artifact stages (PRD -> Arch -> Impl -> Artf)
        OWNERSHIP: 0.5       // Age of ownership record
      };
    }

    /**
     * Calculates the true Time-Based Rank Score for a Room/Node.
     * @param {Object} node - A spatial node object from SpatialEngine.registry
     */
    calculateRankScore(node) {
      if (!node) return 0;

      // 1. Traversal: Pattern Traffic
      const traversalScore = Math.log10(node.visitCount + 1) * this.WEIGHTS.TRAVERSAL;

      // 2. Lineage Depth: Verified artifacts attached
      const artifactCount = (node.artifacts && node.artifacts.length) || 0;
      const lineageScore = artifactCount * this.WEIGHTS.LINEAGE_DEPTH;

      // 3. Ownership / Age (Older, sustained nodes get a slight trust bump)
      const daysSinceCreation = (Date.now() - new Date(node.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const ownershipScore = Math.min(daysSinceCreation / 30, 5) * this.WEIGHTS.OWNERSHIP;

      // Mocked telemetry for Engagement (In a production system, this would come from analytics-service.js)
      // Dwell time, Save Rate, Revisit Rate
      const mockDwellTime = (Math.random() * 300); // 0 to 5 minutes
      const timeScore = (mockDwellTime / 60) * this.WEIGHTS.READ_TIME;

      const mockSaveRate = (Math.random() * 0.2); // 0% to 20%
      const saveScore = mockSaveRate * 100 * this.WEIGHTS.SAVE_RATE;

      const mockRevisitRate = (Math.random() * 0.4); // 0% to 40%
      const revisitScore = mockRevisitRate * 100 * this.WEIGHTS.REVISIT_RATE;

      const totalRank = traversalScore + lineageScore + ownershipScore + timeScore + saveScore + revisitScore;
      
      return parseFloat(totalRank.toFixed(2));
    }

    /**
     * Ranks a list of nodes based on the time-based discovery model.
     * @param {Array} nodes - Array of spatial nodes to rank
     * @returns {Array} - Sorted array with rank scores attached
     */
    rankNodes(nodes) {
      const ranked = nodes.map(node => {
        return {
          ...node,
          rankScore: this.calculateRankScore(node)
        };
      });

      // Sort descending by rankScore
      return ranked.sort((a, b) => b.rankScore - a.rankScore);
    }

    /**
     * Fetches the top trending rooms in the entire Spatial Matrix
     */
    getTrendingRooms(limit = 10) {
      if (!window.DaxiniSpatialEngine) return [];
      
      const allNodes = Object.values(window.DaxiniSpatialEngine.registry).filter(n => n.patternId !== 'ROOT');
      const ranked = this.rankNodes(allNodes);
      
      return ranked.slice(0, limit);
    }
  }

  global.DaxiniDiscoveryEngine = new DaxiniDiscoveryEngine();

})(window);
