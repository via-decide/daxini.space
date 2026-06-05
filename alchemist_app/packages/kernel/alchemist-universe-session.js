/**
 * MODULE_CONTRACT
 * Inputs: Alchemist session arrays/logs plus optional ViaLogic and Zayvora engines
 * Outputs: enhanced session metadata with reasoning and visual package data
 * Constraints: browser-safe IIFE, no backend dependency, CommonJS test compatibility
 */
(function (global) {
  'use strict';

  var VERSION = '0.1.0-browser';

  function nowIso() { return new Date().toISOString(); }

  function text(value, fallback) {
    var out = value === null || typeof value === 'undefined' ? '' : String(value);
    out = out.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return out || fallback || '';
  }

  function normalizeQuestion(question, index) {
    var q = question && typeof question === 'object' ? question : {};
    if (global.AlchemistSessionNormalizer && typeof global.AlchemistSessionNormalizer.normalizeQuestion === 'function') return global.AlchemistSessionNormalizer.normalizeQuestion(q, index || 0);
    return {
      id: text(q.id || q.questionId, 'question_' + ((index || 0) + 1)),
      domain: text(q.domain || q.dom, 'Uncategorized'),
      topic: text(q.topic || q.hint || q.trap, 'General Concept'),
      question: text(q.question || q.q || q.title, 'Question unavailable'),
      answer: text(q.answer || q.correct || q.u, 'Answer unavailable'),
      logic: text(q.logic || q.explanation || q.ctx, 'Logic unavailable'),
      raw: q
    };
  }

  function buildSessionEnvelope(sessionId, questions, results, metadata) {
    var normalizedQuestions = (Array.isArray(questions) ? questions : []).map(normalizeQuestion);
    return Object.assign({
      sessionId: text(sessionId, 'SESSION_UNKNOWN'),
      createdAt: metadata && metadata.createdAt || nowIso(),
      questions: normalizedQuestions,
      results: Array.isArray(results) ? results.slice() : [],
      metadata: Object.assign({}, metadata || {})
    }, metadata && metadata.extra || {});
  }

  function unavailableLogic(session, reason) {
    return {
      version: 'unavailable',
      evaluatedAt: nowIso(),
      unavailable: true,
      message: reason || 'Reasoning engine unavailable.',
      rulesApplied: [],
      weakDomains: [],
      weakConcepts: [],
      nextActions: [],
      conceptGraph: { nodes: [], edges: [] }
    };
  }

  function evaluateSession(session, logicEngine) {
    var engine = logicEngine || global.ViaLogic;
    if (!engine || typeof engine.evaluateSession !== 'function') return unavailableLogic(session, 'Reasoning engine unavailable.');
    var evaluation = engine.evaluateSession(session);
    return {
      version: typeof engine.getVersion === 'function' ? engine.getVersion() : text(evaluation.version, 'unknown'),
      evaluatedAt: nowIso(),
      rulesApplied: Array.isArray(evaluation.rulesApplied) ? evaluation.rulesApplied : [],
      weakDomains: Array.isArray(evaluation.weakDomains) ? evaluation.weakDomains : [],
      weakConcepts: Array.isArray(evaluation.weakConcepts) ? evaluation.weakConcepts : [],
      nextActions: Array.isArray(evaluation.nextActions) ? evaluation.nextActions : [],
      conceptGraph: evaluation.conceptGraph || { nodes: [], edges: [] },
      totalQuestions: evaluation.totalQuestions || 0,
      correctCount: evaluation.correctCount || 0,
      wrongCount: evaluation.wrongCount || 0,
      questionEvaluations: evaluation.questionEvaluations || []
    };
  }

  function buildVisualMetadata(logic, visualEngine) {
    var engine = visualEngine || global.ZayvoraVisualEngine;
    var renderedAt = nowIso();
    if (!engine || typeof engine.serializeDiagram !== 'function') {
      return { engine: 'ZayvoraVisualEngine', version: 'unavailable', unavailable: true, message: 'Visual engine unavailable.', diagrams: [], graphLayout: {}, renderedAt: renderedAt };
    }
    var graph = logic && logic.conceptGraph || { nodes: [], edges: [] };
    var diagram = engine.serializeDiagram(graph, { title: 'Reasoning Map' });
    return { engine: 'ZayvoraVisualEngine', version: typeof engine.getVersion === 'function' ? engine.getVersion() : 'unknown', diagrams: [{ type: diagram && diagram.indexOf('<svg') === 0 ? 'svg' : 'html', title: 'Reasoning Map', content: diagram }], graphLayout: { nodeCount: graph.nodes ? graph.nodes.length : 0, edgeCount: graph.edges ? graph.edges.length : 0 }, renderedAt: renderedAt };
  }

  function attachLogicToSession(session, logicEngine, visualEngine) {
    var target = session && typeof session === 'object' ? session : buildSessionEnvelope('SESSION_UNKNOWN', [], []);
    target.logic = evaluateSession(target, logicEngine);
    target.visuals = buildVisualMetadata(target.logic, visualEngine);
    return target;
  }

  function buildReasoningSummary(logic) {
    if (!logic || logic.unavailable) return 'Reasoning engine unavailable.';
    var weakDomains = (logic.weakDomains || []).map(function (item) { return item.name || item; }).slice(0, 3).join(', ') || 'None';
    var weakConcepts = (logic.weakConcepts || []).map(function (item) { return item.name || item; }).slice(0, 3).join(', ') || 'None';
    var action = logic.nextActions && logic.nextActions[0] ? logic.nextActions[0].label : 'Export Knowledge Book';
    return 'Weak domains: ' + weakDomains + '\nWeak concepts: ' + weakConcepts + '\nNext: ' + action;
  }

  function getVersion() { return VERSION; }

  var api = { buildSessionEnvelope: buildSessionEnvelope, attachLogicToSession: attachLogicToSession, evaluateSession: evaluateSession, buildVisualMetadata: buildVisualMetadata, buildReasoningSummary: buildReasoningSummary, getVersion: getVersion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlchemistUniverse = api;
})(typeof window !== 'undefined' ? window : globalThis);
