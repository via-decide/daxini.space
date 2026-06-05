/**
 * MODULE_CONTRACT
 * Inputs: normalized Alchemist questions/sessions and answer results
 * Outputs: deterministic ViaLogic reasoning evaluations, next actions, and concept graphs
 * Constraints: browser-safe IIFE, no framework/backend dependency, CommonJS test compatibility
 */
(function (global) {
  'use strict';

  var VERSION = '0.1.0-browser';
  var DOMAIN_RULES = [
    { domain: 'Physical Chemistry', keywords: ['physical', 'thermodynamics', 'kinetics', 'rate', 'equilibrium', 'electrochemistry', 'solution', 'colligative', 'adsorption', 'solid state', 'entropy', 'enthalpy'] },
    { domain: 'Organic Chemistry', keywords: ['organic', 'alkane', 'alkene', 'aromatic', 'carbonyl', 'aldehyde', 'ketone', 'amide', 'amine', 'mechanism', 'sn1', 'sn2', 'hoffmann'] },
    { domain: 'Inorganic Chemistry', keywords: ['inorganic', 'periodic', 'p-block', 's-block', 'd-block', 'halogen', 'noble gas', 'metallurgy', 'xenon', 'fluoride'] },
    { domain: 'Coordination Chemistry', keywords: ['coordination', 'ligand', 'complex', 'crystal field', 'octahedral', 'tetrahedral', 'cobalt', 'enantiomer'] },
    { domain: 'General Chemistry', keywords: [] }
  ];

  function text(value, fallback) {
    var out = value === null || typeof value === 'undefined' ? '' : String(value);
    out = out.replace(/<[^>]*>/g, '').replace(/&Delta;/g, 'Δ').replace(/\s+/g, ' ').trim();
    return out || fallback || '';
  }

  function slug(value, fallback) {
    return text(value, fallback || 'node').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || fallback || 'node';
  }

  function unique(values) {
    var seen = {};
    return (Array.isArray(values) ? values : []).filter(function (value) {
      var key = text(value).toLowerCase();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function getQuestionId(question, index) {
    return text(question && (question.id || question.questionId), 'question_' + ((index || 0) + 1));
  }

  function questionHaystack(question) {
    var q = question && typeof question === 'object' ? question : {};
    return [q.dom, q.domain, q.topic, q.category, q.q, q.question, q.title, q.correct, q.answer, q.u, q.logic, q.explanation, q.hint, q.trap, q.tags].join(' ').toLowerCase();
  }

  function classifyDomain(question) {
    var q = question && typeof question === 'object' ? question : {};
    var explicit = text(q.domain || q.dom || q.category, '');
    if (explicit) return explicit;
    var haystack = questionHaystack(q);
    for (var i = 0; i < DOMAIN_RULES.length; i += 1) {
      var rule = DOMAIN_RULES[i];
      for (var j = 0; j < rule.keywords.length; j += 1) {
        if (haystack.indexOf(rule.keywords[j]) !== -1) return rule.domain;
      }
    }
    return 'General Chemistry';
  }

  function conceptFromTags(question) {
    var tags = text(question && question.tags, '');
    var match = tags.match(/CONCEPT:([^;]+)/i);
    return match ? match[1].replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, function (letter) { return letter.toUpperCase(); }) : '';
  }

  function classifyConcept(question) {
    var q = question && typeof question === 'object' ? question : {};
    return text(q.concept || q.topic || conceptFromTags(q) || q.hint || q.trap || q.domain || q.dom, 'General Concept');
  }

  function resultIsCorrect(result, question) {
    if (typeof result === 'boolean') return result;
    var r = result && typeof result === 'object' ? result : {};
    if (typeof r.isCorrect === 'boolean') return r.isCorrect;
    if (typeof r.correct === 'boolean') return r.correct;
    if (typeof r.res === 'string') return r.res.toUpperCase() === 'WIN' || r.res.toUpperCase() === 'CORRECT';
    if (typeof r.result === 'string') return r.result.toUpperCase() === 'WIN' || r.result.toUpperCase() === 'CORRECT';
    if (r.answer || r.picked || r.selected) {
      var selected = text(r.answer || r.picked || r.selected).toLowerCase();
      var correct = text(question && (question.answer || question.correct || question.u)).toLowerCase();
      if (selected && correct) return selected === correct;
    }
    return true;
  }

  function evaluateQuestion(question, result, index) {
    var q = question && typeof question === 'object' ? question : {};
    var domain = classifyDomain(q);
    var concept = classifyConcept(q);
    var correct = resultIsCorrect(result, q);
    var weaknessSignal = correct ? '' : 'Needs reinforcement in ' + domain + ' / ' + concept;
    var explanationSignal = text(q.logic || q.explanation || q.ctx || q.hint, correct ? 'Concept understood.' : 'Review the explanation and retry related examples.');
    return {
      questionId: getQuestionId(q, index),
      domain: domain,
      concept: concept,
      isCorrect: correct,
      weaknessSignal: weaknessSignal,
      explanationSignal: explanationSignal,
      nextAction: correct ? 'Keep practicing mixed review.' : 'Review ' + concept + ' and practice another ' + domain + ' question.'
    };
  }

  function normalizeResults(session) {
    var input = session && typeof session === 'object' ? session : {};
    var results = Array.isArray(input.results || input.sessionLog || input.log) ? (input.results || input.sessionLog || input.log) : [];
    var byId = {};
    results.forEach(function (result) {
      if (result && typeof result === 'object' && result.id) byId[String(result.id)] = result;
    });
    return { list: results, byId: byId };
  }

  function buildConceptGraph(session) {
    var input = session && typeof session === 'object' ? session : {};
    var questions = Array.isArray(input.questions || input.data || input.blocks) ? (input.questions || input.data || input.blocks) : [];
    var results = normalizeResults(input);
    var nodeMap = {};
    var edges = [];
    var previousConceptId = '';

    questions.forEach(function (question, index) {
      var result = results.byId[getQuestionId(question, index)] || results.list[index] || null;
      var evaluation = evaluateQuestion(question, result, index);
      var domainId = 'domain_' + slug(evaluation.domain, 'domain');
      var conceptId = 'concept_' + slug(evaluation.concept, 'concept');
      if (!nodeMap[domainId]) nodeMap[domainId] = { id: domainId, label: evaluation.domain, type: 'domain', weight: 0 };
      if (!nodeMap[conceptId]) nodeMap[conceptId] = { id: conceptId, label: evaluation.concept, type: 'concept', domain: evaluation.domain, weight: 0, weak: false };
      nodeMap[domainId].weight += 1;
      nodeMap[conceptId].weight += 1;
      nodeMap[conceptId].weak = nodeMap[conceptId].weak || !evaluation.isCorrect;
      edges.push({ from: domainId, to: conceptId, relation: 'contains', weight: 1 });
      if (previousConceptId && previousConceptId !== conceptId) edges.push({ from: previousConceptId, to: conceptId, relation: 'session_next', weight: 1 });
      previousConceptId = conceptId;
    });

    return { nodes: Object.keys(nodeMap).map(function (key) { return nodeMap[key]; }), edges: edges };
  }

  function countWeakness(evaluations, field) {
    var counts = {};
    evaluations.forEach(function (evaluation) {
      if (evaluation.isCorrect) return;
      var key = evaluation[field] || 'Uncategorized';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts).map(function (key) { return { name: key, count: counts[key] }; }).sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name); });
  }

  function suggestNextAction(sessionEvaluation) {
    var evaluation = sessionEvaluation && typeof sessionEvaluation === 'object' ? sessionEvaluation : {};
    var actions = [];
    var weakDomain = evaluation.weakDomains && evaluation.weakDomains[0];
    var weakConcept = evaluation.weakConcepts && evaluation.weakConcepts[0];
    if (weakConcept) actions.push({ type: 'review', label: 'Review ' + weakConcept.name, reason: weakConcept.count + ' missed signal(s) in this concept.', priority: 100 });
    if (weakDomain) actions.push({ type: 'practice', label: 'Practice ' + weakDomain.name, reason: weakDomain.count + ' missed question(s) in this domain.', priority: 90 });
    if ((evaluation.wrongCount || 0) === 0 && (evaluation.totalQuestions || 0) > 0) actions.push({ type: 'export', label: 'Export Knowledge Book', reason: 'Session is complete with no weak signals.', priority: 80 });
    actions.push({ type: 'read', label: 'Read explanations for repeated concepts', reason: 'Consolidate the session into portable memory.', priority: 40 });
    return actions.sort(function (a, b) { return b.priority - a.priority; });
  }

  function evaluateSession(session) {
    var input = session && typeof session === 'object' ? session : {};
    var questions = Array.isArray(input.questions || input.data || input.blocks) ? (input.questions || input.data || input.blocks) : [];
    var results = normalizeResults(input);
    var evaluations = questions.map(function (question, index) {
      return evaluateQuestion(question, results.byId[getQuestionId(question, index)] || results.list[index] || null, index);
    });
    var correctCount = evaluations.filter(function (evaluation) { return evaluation.isCorrect; }).length;
    var weakDomains = countWeakness(evaluations, 'domain');
    var weakConcepts = countWeakness(evaluations, 'concept');
    var output = {
      sessionId: text(input.sessionId || input.id, 'SESSION_UNKNOWN'),
      totalQuestions: questions.length,
      correctCount: correctCount,
      wrongCount: questions.length - correctCount,
      weakDomains: weakDomains,
      weakConcepts: weakConcepts,
      rulesApplied: ['domain-classification', 'concept-classification', 'weakness-detection', 'next-action-ranking', 'concept-graph-build'],
      nextActions: [],
      conceptGraph: buildConceptGraph(input),
      questionEvaluations: evaluations
    };
    output.nextActions = suggestNextAction(output);
    return output;
  }

  function getVersion() { return VERSION; }

  var api = {
    evaluateQuestion: evaluateQuestion,
    evaluateSession: evaluateSession,
    buildConceptGraph: buildConceptGraph,
    suggestNextAction: suggestNextAction,
    classifyDomain: classifyDomain,
    classifyConcept: classifyConcept,
    getVersion: getVersion
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ViaLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
