/**
 * MODULE_CONTRACT
 * Inputs: Alchemist sessions, ViaLogic outputs, and Zayvora diagram metadata
 * Outputs: backward-compatible .ZAY v2 JSON packages
 * Constraints: browser-safe IIFE, no backend dependency, CommonJS test compatibility
 */
(function (global) {
  'use strict';

  var VERSION = '2.0';

  function text(value, fallback) {
    var out = value === null || typeof value === 'undefined' ? '' : String(value);
    out = out.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return out || fallback || '';
  }

  function normalizeQuestion(question, index) {
    var q = question && typeof question === 'object' ? question : {};
    return {
      id: text(q.id || q.questionId, 'question_' + ((index || 0) + 1)),
      domain: text(q.domain || q.dom, 'Uncategorized'),
      concept: text(q.concept || q.topic || q.hint || q.trap, 'General Concept'),
      question: text(q.question || q.q || q.title, 'Question unavailable'),
      answer: text(q.answer || q.correct || q.u, 'Answer unavailable'),
      logic: text(q.logic || q.explanation || q.ctx, 'Logic unavailable')
    };
  }

  function normalizeSession(session) {
    var input = session && typeof session === 'object' ? session : {};
    var questions = Array.isArray(input.questions || input.data || input.blocks) ? (input.questions || input.data || input.blocks) : [];
    return {
      sessionId: text(input.sessionId || input.id, 'SESSION_UNKNOWN'),
      createdAt: input.createdAt || new Date().toISOString(),
      questions: questions.map(normalizeQuestion),
      logic: input.logic || null,
      visuals: input.visuals || null
    };
  }

  function defaultLogic(session) {
    return {
      engine: 'ViaLogic',
      version: global.ViaLogic && typeof global.ViaLogic.getVersion === 'function' ? global.ViaLogic.getVersion() : 'unavailable',
      rulesApplied: [],
      weakDomains: [],
      weakConcepts: [],
      nextActions: [],
      conceptGraph: { nodes: [], edges: [] }
    };
  }

  function defaultVisuals() {
    return {
      engine: 'ZayvoraVisualEngine',
      version: global.ZayvoraVisualEngine && typeof global.ZayvoraVisualEngine.getVersion === 'function' ? global.ZayvoraVisualEngine.getVersion() : 'unavailable',
      diagrams: [],
      graphLayout: {},
      renderedAt: new Date().toISOString()
    };
  }

  function buildV2Package(session, options) {
    var normalized = normalizeSession(session || {});
    var logicInput = normalized.logic || options && options.logic || defaultLogic(normalized);
    var visualsInput = normalized.visuals || options && options.visuals || defaultVisuals();
    var logic = {
      engine: 'ViaLogic',
      version: text(logicInput.version, defaultLogic().version),
      rulesApplied: Array.isArray(logicInput.rulesApplied) ? logicInput.rulesApplied : [],
      weakDomains: Array.isArray(logicInput.weakDomains) ? logicInput.weakDomains : [],
      weakConcepts: Array.isArray(logicInput.weakConcepts) ? logicInput.weakConcepts : [],
      nextActions: Array.isArray(logicInput.nextActions) ? logicInput.nextActions : [],
      conceptGraph: logicInput.conceptGraph || { nodes: [], edges: [] }
    };
    var visuals = {
      engine: 'ZayvoraVisualEngine',
      version: text(visualsInput.version, defaultVisuals().version),
      diagrams: Array.isArray(visualsInput.diagrams) ? visualsInput.diagrams : [],
      graphLayout: visualsInput.graphLayout || {},
      renderedAt: visualsInput.renderedAt || new Date().toISOString()
    };
    var pkg = {
      format: 'zay',
      version: VERSION,
      source: 'alchemist',
      session: { sessionId: normalized.sessionId, createdAt: normalized.createdAt, questionCount: normalized.questions.length },
      questions: normalized.questions,
      logic: logic,
      visuals: visuals,
      exports: { knowledgeBookReady: true },
      meta: { version: VERSION, engine: 'zayvora', type: 'study-session', created: Date.now(), sessionId: normalized.sessionId, questionCount: normalized.questions.length },
      content: { blocks: normalized.questions.map(function (q, index) { return { type: 'question', title: 'Question ' + (index + 1), body: { question: q.question, answer: q.answer, logic: q.logic } }; }) },
      vault: { entities: normalized.questions.map(function (q) { return { id: q.id, topic: q.concept, domain: q.domain }; }) },
      state: { sessionId: normalized.sessionId, exportedAt: new Date().toISOString() }
    };
    return pkg;
  }

  function detectVersion(pkg) {
    if (pkg && pkg.format === 'zay' && pkg.version === VERSION) return VERSION;
    if (pkg && pkg.meta && pkg.meta.version) return String(pkg.meta.version);
    return '1.0';
  }

  var api = { VERSION: VERSION, buildV2Package: buildV2Package, normalizeSession: normalizeSession, normalizeQuestion: normalizeQuestion, detectVersion: detectVersion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlchemistZayFormat = api;
})(typeof window !== 'undefined' ? window : globalThis);
