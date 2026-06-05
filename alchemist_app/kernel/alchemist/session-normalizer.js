/**
 * MODULE_CONTRACT
 * Inputs: raw vault questions, exported session objects, or session block arrays
 * Outputs: stable normalized session/question shapes and KnowledgeBook model data
 * Constraints: browser-first IIFE, no dependencies, deterministic grouping, no UI mutation
 */
(function (global) {
  'use strict';

  function text(value, fallback) {
    var out = value === null || typeof value === 'undefined' ? '' : String(value);
    out = out.replace(/<[^>]*>/g, '').replace(/&Delta;/g, 'Δ').replace(/\s+/g, ' ').trim();
    return out || fallback || '';
  }

  function isNumericTrap(value) {
    if (typeof value === 'number') return true;
    return typeof value === 'string' && /^\d+$/.test(value.trim());
  }

  function meaningfulTrap(value) {
    return !isNumericTrap(value) && text(value) ? text(value) : '';
  }

  function slug(value, fallback) {
    return text(value, fallback || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || fallback || 'item';
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

  function normalizeQuestion(input, index) {
    var raw = input && typeof input === 'object' ? input : {};
    var trap = meaningfulTrap(raw.trap);
    var domain = text(raw.dom || raw.domain, 'Uncategorized');
    var topic = text(raw.topic || trap || raw.hint || domain, domain);
    return {
      id: text(raw.id, 'question_' + ((index || 0) + 1)),
      set: text(raw.set, ''),
      domain: domain,
      topic: topic,
      question: text(raw.q || raw.question || raw.title, ''),
      answer: text(raw.correct || raw.answer || raw.u, ''),
      logic: text(raw.logic || raw.explanation || raw.ctx, 'Logic unavailable.'),
      hint: text(raw.hint, ''),
      trap: trap,
      raw: raw
    };
  }

  function normalizeSession(session) {
    var input = session && typeof session === 'object' ? session : {};
    var source = input.questions || input.data || input.blocks || [];
    var questions = Array.isArray(source) ? source.map(normalizeQuestion) : [];
    return {
      sessionId: text(input.sessionId || input.id, 'SESSION_UNKNOWN'),
      createdAt: input.createdAt || input.date || new Date().toISOString(),
      startedAt: input.startedAt || null,
      endedAt: input.endedAt || null,
      duration: input.duration || input.sessionDuration || null,
      questions: questions
    };
  }

  function groupByDomain(sessionOrQuestions) {
    var questions = Array.isArray(sessionOrQuestions) ? sessionOrQuestions.map(normalizeQuestion) : normalizeSession(sessionOrQuestions).questions;
    return questions.reduce(function (groups, question) {
      var key = question.domain || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(question);
      return groups;
    }, {});
  }

  function groupByConcept(questions) {
    return (Array.isArray(questions) ? questions : []).reduce(function (groups, question, index) {
      var normalized = question && question.question ? question : normalizeQuestion(question, index);
      var key = normalized.topic || normalized.domain || 'Uncategorized';
      if (!groups[key]) groups[key] = { id: slug(key, 'concept'), title: key, questions: [], explanationParts: [] };
      groups[key].questions.push(normalized);
      if (normalized.logic && groups[key].explanationParts.indexOf(normalized.logic) === -1) groups[key].explanationParts.push(normalized.logic);
      return groups;
    }, {});
  }

  function buildKnowledgeBook(session) {
    var normalized = normalizeSession(session);
    var domainGroups = groupByDomain(normalized.questions);
    var topics = Object.keys(domainGroups);
    var chapters = topics.map(function (domain, index) {
      var conceptGroups = groupByConcept(domainGroups[domain]);
      return {
        id: 'chapter_' + (index + 1) + '_' + slug(domain, 'domain'),
        title: domain,
        concepts: Object.keys(conceptGroups).map(function (conceptKey) {
          var concept = conceptGroups[conceptKey];
          return {
            id: concept.id,
            title: concept.title,
            questions: concept.questions.map(function (question) { return { id: question.id, question: question.question, answer: question.answer }; }),
            explanation: concept.explanationParts.join('\n\n') || 'Logic unavailable.'
          };
        })
      };
    });
    var conceptCounts = {};
    normalized.questions.forEach(function (question) {
      var key = question.topic || question.domain || 'Uncategorized';
      conceptCounts[key] = (conceptCounts[key] || 0) + 1;
    });
    var domainCounts = topics.map(function (topic) { return { topic: topic, count: domainGroups[topic].length }; }).sort(function (a, b) { return b.count - a.count; });
    var repeatedConceptCount = Object.keys(conceptCounts).reduce(function (sum, key) { return sum + (conceptCounts[key] > 1 ? conceptCounts[key] - 1 : 0); }, 0);
    return {
      metadata: {
        exportType: 'knowledge_book',
        sessionId: normalized.sessionId,
        createdAt: normalized.createdAt,
        questionCount: normalized.questions.length,
        topics: topics
      },
      chapters: chapters,
      reflection: {
        totalQuestions: normalized.questions.length,
        topicsCovered: topics,
        mostFrequentTopic: domainCounts[0] ? domainCounts[0].topic : '',
        repeatedConceptCount: repeatedConceptCount,
        sessionId: normalized.sessionId,
        exportTimestamp: new Date().toISOString()
      }
    };
  }

  var api = {
    normalizeQuestion: normalizeQuestion,
    normalizeSession: normalizeSession,
    groupByDomain: groupByDomain,
    groupByConcept: groupByConcept,
    buildKnowledgeBook: buildKnowledgeBook,
    isNumericTrap: isNumericTrap
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlchemistSessionNormalizer = api;
})(typeof window !== 'undefined' ? window : globalThis);
