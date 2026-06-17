/**
 * pdf-pipeline.js — Daxini Artifact Generation Pipeline
 * 
 * Automatically generates PDFs at every stage of the build process
 * and binds them to the Spatial Room's lineage metadata.
 */

(function(global) {
  'use strict';

  class DaxiniPDFPipeline {
    constructor() {
      this.STORAGE_KEY = 'daxini_pdf_artifacts';
      this.artifacts = {};
      this.loadState();
    }

    loadState() {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) this.artifacts = JSON.parse(stored);
      } catch (err) {
        console.error('[PDF Pipeline] Failed to load artifacts', err);
      }
    }

    saveState() {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.artifacts));
      } catch (err) {
        // Handle LocalStorage QuotaExceeded (since PDFs are base64)
        console.error('[PDF Pipeline] Storage Quota Exceeded. Keeping in memory only.', err);
      }
    }

    /**
     * Snapshots a specific DOM element into a PDF and attaches it to the Room.
     * @param {HTMLElement} element - The DOM node to snapshot (e.g. PRD view, Workspace).
     * @param {string} roomPatternId - The PatternID of the current spatial room.
     * @param {string} stage - Build stage ('PRD', 'Architecture', 'Implementation', 'Artifact').
     */
    async snapshotStage(element, roomPatternId, stage) {
      if (!window.html2pdf) {
        console.warn('[PDF Pipeline] html2pdf library not loaded.');
        return null;
      }

      console.log(`[PDF Pipeline] Generating ${stage} Artifact for Room ${roomPatternId}`);

      const opt = {
        margin:       10,
        filename:     `${roomPatternId}_${stage}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      try {
        // Output as Data URI string (base64)
        const pdfBase64 = await window.html2pdf().set(opt).from(element).outputPdf('datauristring');
        
        const artifactId = `ARTF_${Date.now()}`;
        const artifactRef = {
          id: artifactId,
          stage: stage,
          timestamp: new Date().toISOString(),
          filename: opt.filename,
          size: pdfBase64.length,
          dataUri: pdfBase64
        };

        this.artifacts[artifactId] = artifactRef;
        this.saveState();

        // Bind to Spatial Engine Room Lineage
        if (window.DaxiniSpatialEngine) {
          window.DaxiniSpatialEngine.addArtifact(roomPatternId, {
            id: artifactId,
            stage,
            timestamp: artifactRef.timestamp
          });
        }

        return artifactRef;
      } catch (err) {
        console.error('[PDF Pipeline] Snapshot failed', err);
        return null;
      }
    }

    getArtifactsForRoom(roomPatternId) {
      if (!window.DaxiniSpatialEngine) return [];
      const node = window.DaxiniSpatialEngine.registry[roomPatternId];
      if (!node || !node.artifacts) return [];
      
      return node.artifacts.map(ref => this.artifacts[ref.id]).filter(Boolean);
    }
  }

  global.DaxiniPDFPipeline = new DaxiniPDFPipeline();

})(window);
