/**
 * MODULE_CONTRACT
 * Inputs: ViaLogic concept graphs, session evaluations, Knowledge Book models, or DOM containers
 * Outputs: lightweight SVG strings, DOM-rendered diagrams, and HTML fallbacks
 * Constraints: browser-safe IIFE, no canvas/binary generation, CommonJS test compatibility
 */
(function (global) {
  'use strict';

  var VERSION = '0.1.0-browser';

  function text(value, fallback) {
    var out = value === null || typeof value === 'undefined' ? '' : String(value);
    out = out.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return out || fallback || '';
  }

  function escapeHtml(value) {
    return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalizeGraph(graph) {
    var input = graph && typeof graph === 'object' ? graph : {};
    return {
      nodes: Array.isArray(input.nodes) ? input.nodes : [],
      edges: Array.isArray(input.edges) ? input.edges : []
    };
  }

  function layoutGraph(graph) {
    var safe = normalizeGraph(graph);
    var width = 720;
    var height = Math.max(220, 120 + safe.nodes.length * 34);
    var domainNodes = safe.nodes.filter(function (node) { return node.type === 'domain'; });
    var otherNodes = safe.nodes.filter(function (node) { return node.type !== 'domain'; });
    var positions = {};
    var leftX = 130;
    var rightX = 500;
    var gapLeft = height / (domainNodes.length + 1 || 2);
    var gapRight = height / (otherNodes.length + 1 || 2);
    domainNodes.forEach(function (node, index) { positions[node.id] = { x: leftX, y: Math.round(gapLeft * (index + 1)) }; });
    otherNodes.forEach(function (node, index) { positions[node.id] = { x: rightX, y: Math.round(gapRight * (index + 1)) }; });
    safe.nodes.forEach(function (node, index) {
      if (!positions[node.id]) positions[node.id] = { x: 180 + ((index % 4) * 120), y: 80 + (Math.floor(index / 4) * 70) };
    });
    return { width: width, height: height, positions: positions, graph: safe };
  }

  function graphToSvg(graph, title) {
    var layout = layoutGraph(graph);
    var safeTitle = escapeHtml(title || 'Reasoning Map');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + safeTitle + '" viewBox="0 0 ' + layout.width + ' ' + layout.height + '" width="100%" height="' + layout.height + '">';
    svg += '<rect width="100%" height="100%" rx="14" fill="#050505" stroke="#262626"/>';
    svg += '<text x="24" y="34" fill="#ffd600" font-family="monospace" font-size="16" font-weight="700">' + safeTitle + '</text>';
    layout.graph.edges.forEach(function (edge) {
      var from = layout.positions[edge.from];
      var to = layout.positions[edge.to];
      if (!from || !to) return;
      var stroke = edge.relation === 'session_next' ? '#555' : '#2ecc71';
      svg += '<line x1="' + from.x + '" y1="' + from.y + '" x2="' + to.x + '" y2="' + to.y + '" stroke="' + stroke + '" stroke-width="1.5" opacity="0.65"/>';
    });
    layout.graph.nodes.forEach(function (node) {
      var pos = layout.positions[node.id];
      var isDomain = node.type === 'domain';
      var fill = node.weak ? '#2b0909' : isDomain ? '#161100' : '#080808';
      var stroke = node.weak ? '#ff4444' : isDomain ? '#ffd600' : '#444';
      var radius = isDomain ? 34 : 28;
      svg += '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + radius + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2"/>';
      svg += '<text x="' + pos.x + '" y="' + (pos.y + radius + 18) + '" text-anchor="middle" fill="#ddd" font-family="monospace" font-size="11">' + escapeHtml(text(node.label, node.id)).slice(0, 34) + '</text>';
      if (node.weight) svg += '<text x="' + pos.x + '" y="' + (pos.y + 4) + '" text-anchor="middle" fill="#aaa" font-family="monospace" font-size="12">' + escapeHtml(node.weight) + '</text>';
    });
    if (!layout.graph.nodes.length) svg += '<text x="24" y="80" fill="#888" font-family="monospace" font-size="13">No graph nodes available.</text>';
    svg += '</svg>';
    return svg;
  }

  function fallbackHtml(message) {
    return '<div class="zayvora-visual-fallback" role="status" style="border:1px solid #333;background:#050505;color:#aaa;border-radius:10px;padding:12px;font:12px monospace;">' + escapeHtml(message || 'Visual engine unavailable.') + '</div>';
  }

  function renderInto(container, html) {
    if (container && typeof container.innerHTML !== 'undefined') {
      container.innerHTML = html;
      return { target: 'dom', content: html, ok: true };
    }
    return { target: 'html', content: html, ok: true };
  }

  function renderSessionGraph(container, conceptGraph, options) {
    var graph = normalizeGraph(conceptGraph);
    var html = graph.nodes.length ? graphToSvg(graph, options && options.title || 'Reasoning Map') : fallbackHtml('Visual graph unavailable. Reasoning summary is still available.');
    return renderInto(container, html);
  }

  function renderConceptMap(container, conceptGraph, options) {
    return renderSessionGraph(container, conceptGraph, Object.assign({ title: 'Concept Map' }, options || {}));
  }

  function renderLearningPath(container, sessionEvaluation) {
    var actions = sessionEvaluation && Array.isArray(sessionEvaluation.nextActions) ? sessionEvaluation.nextActions : [];
    var html = '<div class="zayvora-learning-path" style="border:1px solid #333;background:#050505;color:#ccc;border-radius:10px;padding:12px;font:12px monospace;"><strong style="color:#ffd600;">Learning Path</strong><ol>' + actions.map(function (action) { return '<li>' + escapeHtml(action.label) + ' — ' + escapeHtml(action.reason) + '</li>'; }).join('') + '</ol></div>';
    return renderInto(container, actions.length ? html : fallbackHtml('No learning path actions available.'));
  }

  function renderKnowledgeBookDiagram(container, knowledgeBook) {
    var graph = knowledgeBook && knowledgeBook.logic && knowledgeBook.logic.conceptGraph || knowledgeBook && knowledgeBook.conceptGraph || { nodes: [], edges: [] };
    return renderSessionGraph(container, graph, { title: 'Knowledge Book Visual Map' });
  }

  function serializeDiagram(graph, options) {
    var safe = normalizeGraph(graph);
    if (!safe.nodes.length) return fallbackHtml('Visual graph unavailable. Reasoning summary is still available.');
    return graphToSvg(safe, options && options.title || 'Reasoning Map');
  }

  function getVersion() { return VERSION; }

  var api = {
    renderConceptMap: renderConceptMap,
    renderLearningPath: renderLearningPath,
    renderSessionGraph: renderSessionGraph,
    renderKnowledgeBookDiagram: renderKnowledgeBookDiagram,
    serializeDiagram: serializeDiagram,
    getVersion: getVersion,
    _normalizeGraph: normalizeGraph,
    _layoutGraph: layoutGraph
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ZayvoraVisualEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
