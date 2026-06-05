/**
 * MODULE_CONTRACT
 * Inputs: structured asset content, completed session question data, or KnowledgeBook data
 * Outputs: deterministic PDF/ZAY blueprints and EPUB package bytes, metadata, and file names
 * Constraints: browser-only vanilla JS, no external ZIP dependency, shared exporter pipeline
 */
(function (global) {
  'use strict';

  var EPUB_MIME = 'application/epub+zip';
  var JSON_MIME = 'application/json';
  var zayFormat = global.AlchemistZayFormat;
  if (!zayFormat && typeof module !== 'undefined' && module.exports && typeof require === 'function') zayFormat = require('../../packages/zay-format/zay-v2.js');
  var CONTAINER_XML = '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
  var DEFAULT_TOPIC_RULES = [
    { topic: 'Physical Chemistry', keywords: ['physical chemistry', 'kinetics', 'rate law', 'electrochemistry', 'colligative', 'osmotic', 'solution', 'surface chemistry', 'adsorption', 'solid state', 'equilibrium'] },
    { topic: 'Organic Chemistry', keywords: ['organic chemistry', 'aldehyde', 'ketone', 'carbonyl', 'clemmensen', 'reaction mechanism', 'alkane', 'alkene', 'aromatic'] },
    { topic: 'Inorganic Chemistry', keywords: ['inorganic chemistry', 'periodic', 'xenon', 'fluoride', 'p-block', 's-block', 'd-block', 'metallurgy'] },
    { topic: 'Coordination Chemistry', keywords: ['coordination', 'ligand', 'complex', 'octahedral', 'crystal field', 'ethylenediamine', 'cobalt'] },
    { topic: 'Thermodynamics', keywords: ['thermodynamics', 'enthalpy', 'entropy', 'gibbs', 'delta g', 'free energy', 'exothermic'] },
    { topic: 'Future Modules', keywords: [] }
  ];

  function normalizeDate(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number' && isFinite(value)) return new Date(value).toISOString();
    if (typeof value === 'string' && value.trim()) {
      var parsed = new Date(value);
      return isNaN(parsed.getTime()) ? value : parsed.toISOString();
    }
    return new Date().toISOString();
  }

  function safeText(value, fallback) {
    var text = value === null || typeof value === 'undefined' ? '' : String(value);
    text = text.replace(/<[^>]*>/g, '').replace(/&Delta;/g, 'Δ').replace(/\s+/g, ' ').trim();
    return text || fallback || '';
  }

  function escapeXml(value) {
    return safeText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function escapeHtml(value) {
    return safeText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function safeFileName(value) {
    return safeText(value, 'notes').replace(/[\\/:*?"<>|]+/g, ' ').trim().replace(/\s+/g, '_') || 'notes';
  }

  function slug(value, fallback) {
    return safeFileName(value || fallback || 'chapter').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  }

  function unique(values) {
    var seen = {};
    return (Array.isArray(values) ? values : []).filter(function (value) {
      var key = safeText(value).toLowerCase();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function normalizeQuestion(item, index) {
    var q = item && typeof item === 'object' ? item : {};
    var metadataTopic = q.topic || q.category || q.domain || q.dom || q.set || '';
    var tags = [];
    [q.tags, q.keywords, q.concepts].forEach(function (list) { if (Array.isArray(list)) tags = tags.concat(list); });
    return {
      id: safeText(q.id, 'question_' + (index + 1)),
      question: safeText(q.q || q.question || q.title, 'Untitled question'),
      answer: safeText(q.u || q.correct || q.answer, 'Answer unavailable'),
      logic: safeText(q.logic || q.explanation || q.ctx, 'Logic unavailable'),
      hint: safeText(q.hint, ''),
      topicHint: safeText(metadataTopic, ''),
      tags: unique(tags.map(function (tag) { return safeText(tag); })),
      raw: q
    };
  }

  function normalizeChapter(chapter, index) {
    var item = chapter && typeof chapter === 'object' ? chapter : {};
    return {
      id: item.id || 'chapter_' + index + '_' + slug(item.title, index + 1),
      title: safeText(item.title, 'Chapter ' + (index + 1)),
      content: safeText(item.content, 'No content available.')
    };
  }

  function buildQuestionStructuredContent(item, notes) {
    var q = normalizeQuestion(item, 0);
    var generatedNotes = typeof notes === 'string' && notes.trim() ? notes : '# ' + q.question + '\n\n## Concept\n' + q.logic + '\n\n## Key Points\n- ' + safeText(q.hint || q.topicHint, 'Core concept') + '\n- ' + safeText(q.raw && q.raw.set, 'Set reference') + '\n\n## Summary\n' + q.question + ' → ' + q.answer;
    return {
      title: q.question,
      author: 'Alchemist Engine',
      question: q.question,
      answer: q.answer,
      logic: q.logic,
      chapters: [
        { title: 'Concept', content: q.logic },
        { title: 'Key Points', content: '- Topic: ' + safeText(q.topicHint || q.hint, 'Core concept') + '\n- Set: ' + safeText(q.raw && q.raw.set, 'Set reference') },
        { title: 'Summary', content: generatedNotes }
      ]
    };
  }

  function inferConcept(question) {
    var candidates = question.tags.concat([question.hint, question.topicHint]).filter(Boolean);
    if (candidates.length) return safeText(candidates[0], 'General Concept');
    var text = question.question;
    var beforeVerb = text.split(/\bis\b|\bdoes\b|\bfor\b|\?/i)[0];
    return safeText(beforeVerb.replace(/^(what|which|why|how)\s+/i, ''), 'General Concept');
  }

  function classifyTopic(question, rules) {
    var haystack = [question.topicHint, question.hint, question.question, question.answer, question.logic].concat(question.tags).join(' ').toLowerCase();
    var configuredRules = Array.isArray(rules) && rules.length ? rules : DEFAULT_TOPIC_RULES;
    for (var exactIndex = 0; exactIndex < configuredRules.length; exactIndex += 1) {
      var exactRule = configuredRules[exactIndex] || {};
      if (safeText(question.topicHint).toLowerCase() === safeText(exactRule.topic).toLowerCase()) return safeText(exactRule.topic, 'Future Modules');
    }
    for (var i = 0; i < configuredRules.length; i += 1) {
      var rule = configuredRules[i] || {};
      var keywords = Array.isArray(rule.keywords) ? rule.keywords : [];
      for (var j = 0; j < keywords.length; j += 1) {
        if (haystack.indexOf(safeText(keywords[j]).toLowerCase()) !== -1) return safeText(rule.topic, 'Future Modules');
      }
    }
    return safeText(configuredRules[configuredRules.length - 1] && configuredRules[configuredRules.length - 1].topic, 'Future Modules');
  }

  function normalizeStructuredContent(structure) {
    var input = structure && typeof structure === 'object' ? structure : {};
    var chapters = Array.isArray(input.chapters) ? input.chapters.map(normalizeChapter) : [];
    if (!chapters.length) chapters.push(normalizeChapter({ title: 'Summary', content: 'No content available.' }, 0));
    return {
      title: safeText(input.title, 'Untitled'),
      author: safeText(input.author, 'Alchemist Engine'),
      question: safeText(input.question || input.q, ''),
      answer: safeText(input.answer || input.correct || input.u, ''),
      logic: safeText(input.logic || input.explanation, ''),
      chapters: chapters,
      metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
    };
  }

  function renderChapterPage(title, body) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>' + escapeHtml(title) + '</title><meta charset="utf-8"/><style>body{font-family:serif;line-height:1.5;margin:2em;}h1,h2{font-family:sans-serif;}section{margin-bottom:1.25em;}pre{white-space:pre-wrap;font-family:serif;}ul{padding-left:1.4em;}.muted{color:#666;}.question{border-top:1px solid #ddd;padding-top:1em;margin-top:1em;}</style></head><body>' + body + '</body></html>';
  }

  function renderStructuredContentPage(structure, headingPrefix) {
    var safe = normalizeStructuredContent(structure);
    var body = '<h1>' + escapeHtml(headingPrefix ? headingPrefix + ': ' + safe.title : safe.title) + '</h1>';
    if (safe.question || safe.answer || safe.logic) {
      body += '<section><h2>Question</h2><p>' + escapeHtml(safe.question || safe.title) + '</p></section>';
      body += '<section><h2>Answer</h2><p>' + escapeHtml(safe.answer || 'Answer unavailable') + '</p></section>';
      body += '<section><h2>Logic</h2><p>' + escapeHtml(safe.logic || 'Logic unavailable') + '</p></section>';
    }
    safe.chapters.forEach(function (chapter) {
      body += '<section><h2>' + escapeHtml(chapter.title) + '</h2><pre>' + escapeHtml(chapter.content) + '</pre></section>';
    });
    return renderChapterPage(safe.title, body);
  }

  function renderQuestionBlock(question) {
    return '<section class="question"><h3>' + escapeHtml(question.question) + '</h3><p><strong>Answer:</strong> ' + escapeHtml(question.answer) + '</p><p><strong>Logic:</strong> ' + escapeHtml(question.logic) + '</p></section>';
  }

  function buildKnowledgeBookModel(session, options) {
    var input = session && typeof session === 'object' ? session : {};
    var questions = (Array.isArray(input.questions || input.data || input.blocks) ? (input.questions || input.data || input.blocks) : []).map(normalizeQuestion);
    var rules = options && options.topicRules;
    var sessionId = safeText(input.sessionId || input.id, 'SESSION_UNKNOWN');
    var createdAt = normalizeDate(input.createdAt || (options && options.createdAt));
    var logic = input.logic || options && options.logic || null;
    var visuals = input.visuals || options && options.visuals || null;
    var topicMap = {};
    var conceptsMap = {};

    questions.forEach(function (question) {
      question.topic = classifyTopic(question, rules);
      question.concept = inferConcept(question);
      if (!topicMap[question.topic]) topicMap[question.topic] = { title: question.topic, questions: [], conceptNames: [] };
      topicMap[question.topic].questions.push(question);
      topicMap[question.topic].conceptNames.push(question.concept);
      var conceptKey = slug(question.concept, 'concept');
      if (!conceptsMap[conceptKey]) conceptsMap[conceptKey] = { id: conceptKey, title: question.concept, topic: question.topic, relatedQuestions: [], count: 0, linkedConcepts: [], graphHooks: { dependencies: [], dependents: [] } };
      conceptsMap[conceptKey].relatedQuestions.push(question.id);
      conceptsMap[conceptKey].count += 1;
    });

    var topics = Object.keys(topicMap);
    var chapters = topics.map(function (topic, index) {
      var chapter = topicMap[topic];
      chapter.id = 'topic_' + (index + 1) + '_' + slug(topic);
      chapter.concepts = unique(chapter.conceptNames);
      chapter.overview = 'This chapter covers: ' + (chapter.concepts.length ? chapter.concepts.join(', ') : 'General concepts') + '. The following questions appeared during the session and contributed to the user\'s understanding of these concepts.';
      return chapter;
    });

    var conceptList = Object.keys(conceptsMap).map(function (key) { return conceptsMap[key]; });
    var repeatedConcepts = conceptList.filter(function (concept) { return concept.count > 1; });
    var duration = input.duration || input.sessionDuration || (input.startedAt && input.endedAt ? Number(input.endedAt) - Number(input.startedAt) : null);
    var topicCounts = chapters.map(function (chapter) { return { topic: chapter.title, count: chapter.questions.length }; });
    topicCounts.sort(function (a, b) { return b.count - a.count; });

    return {
      metadata: { exportType: 'knowledge_book', sessionId: sessionId, createdAt: createdAt, questionCount: questions.length, topics: topics },
      logic: logic,
      visuals: visuals,
      title: 'Knowledge Book',
      subtitle: 'Generated by Alchemist',
      chapters: chapters,
      concepts: conceptList,
      repeatedConcepts: repeatedConcepts,
      questions: questions,
      references: [],
      graphHooks: { nodes: conceptList.map(function (concept) { return concept.id; }), edges: [] },
      reflection: {
        totalQuestions: questions.length,
        topicsCovered: topics,
        mostFrequentTopic: topicCounts.length ? topicCounts[0].topic : '',
        conceptRepetitionCount: repeatedConcepts.reduce(function (sum, concept) { return sum + concept.count - 1; }, 0),
        sessionDuration: duration
      }
    };
  }

  function makeAssetBook(structure, options) {
    var safe = normalizeStructuredContent(structure);
    var metadata = Object.assign({ title: safe.title, creator: safe.author, createdAt: normalizeDate(options && options.createdAt) }, safe.metadata || {});
    return { title: safe.title, creator: safe.author, fileName: safeFileName(safe.title) + '.epub', metadata: metadata, chapters: [{ id: 'asset', title: safe.title, content: renderStructuredContentPage(safe) }] };
  }

  function makeSessionBook(session, options) {
    var input = session && typeof session === 'object' ? session : {};
    var questions = (Array.isArray(input.questions || input.data || input.blocks) ? (input.questions || input.data || input.blocks) : []).map(normalizeQuestion);
    var sessionId = safeText(input.sessionId || input.id, 'SESSION_UNKNOWN');
    var createdAt = normalizeDate(input.createdAt || (options && options.createdAt));
    var metadata = { sessionId: sessionId, createdAt: createdAt, questionCount: questions.length };
    var title = 'Alchemist Session ' + sessionId;
    var chapters = [{ id: 'title_page', title: 'Title Page', content: renderChapterPage('Title Page', '<h1>' + escapeHtml(title) + '</h1><section><p><strong>Session ID:</strong> ' + escapeHtml(sessionId) + '</p><p><strong>Date:</strong> ' + escapeHtml(createdAt) + '</p><p><strong>Question Count:</strong> ' + questions.length + '</p></section>') }];
    if (!questions.length) chapters.push({ id: 'empty_session', title: 'Empty Session', content: renderChapterPage('Empty Session', '<h1>Empty Session</h1><p>No questions were available for export.</p>') });
    questions.forEach(function (question, index) { chapters.push({ id: 'question_' + (index + 1), title: 'Question ' + (index + 1), content: renderStructuredContentPage(buildQuestionStructuredContent(question.raw), 'Question ' + (index + 1)) }); });
    return { title: title, creator: 'Alchemist Engine', fileName: 'ALCHEMIST_SESSION_' + safeFileName(sessionId) + '.epub', metadata: metadata, chapters: chapters };
  }

  function renderKnowledgeBookChapter(chapter, index) {
    var body = '<h1>Chapter ' + (index + 1) + ': ' + escapeHtml(chapter.title) + '</h1><section><h2>Chapter Overview</h2><p>' + escapeHtml(chapter.overview) + '</p><ul>' + chapter.concepts.map(function (concept) { return '<li>' + escapeHtml(concept) + '</li>'; }).join('') + '</ul></section>';
    var conceptGroups = {};
    chapter.questions.forEach(function (question) {
      var key = slug(question.concept, 'concept');
      if (!conceptGroups[key]) conceptGroups[key] = { title: question.concept, questions: [] };
      conceptGroups[key].questions.push(question);
    });
    Object.keys(conceptGroups).forEach(function (key) {
      var group = conceptGroups[key];
      body += '<section><h2>Concept Summary: ' + escapeHtml(group.title) + '</h2><p>' + escapeHtml(group.questions.length > 1 ? 'This concept appeared ' + group.questions.length + ' times in the session and has been merged into one concept reference.' : 'This concept appeared in the session.') + '</p><h3>Related Questions</h3>';
      group.questions.forEach(function (question) { body += renderQuestionBlock(question); });
      body += '</section>';
    });
    return renderChapterPage(chapter.title, body);
  }

  function makeKnowledgeBook(session, options) {
    var model = buildKnowledgeBookModel(session, options || {});
    var sessionId = model.metadata.sessionId;
    var chapters = [{
      id: 'title_page',
      title: 'Title Page',
      content: renderChapterPage('Knowledge Book', '<h1>Knowledge Book</h1><p><strong>Generated by Alchemist</strong></p><p><strong>Session ID:</strong> ' + escapeHtml(sessionId) + '</p><p><strong>Date:</strong> ' + escapeHtml(model.metadata.createdAt) + '</p><p><strong>Question Count:</strong> ' + model.metadata.questionCount + '</p>')
    }, {
      id: 'table_of_contents',
      title: 'Table of Contents',
      content: renderChapterPage('Table of Contents', '<h1>Table of Contents</h1><ol>' + model.chapters.map(function (chapter, index) { return '<li>Chapter ' + (index + 1) + ': ' + escapeHtml(chapter.title) + '</li>'; }).join('') + '<li>Learning Reflection</li></ol>')
    }];
    model.chapters.forEach(function (chapter, index) { chapters.push({ id: chapter.id, title: 'Chapter ' + (index + 1) + ': ' + chapter.title, content: renderKnowledgeBookChapter(chapter, index) }); });
    if (model.logic) {
      var logic = model.logic;
      var actionItems = (logic.nextActions || []).map(function (action) { return '<li>' + escapeHtml(action.label || action.type || 'Next action') + ' — ' + escapeHtml(action.reason || '') + '</li>'; }).join('');
      var logicBody = '<h1>Reasoning Layer</h1><p><strong>Rules Applied:</strong> ' + escapeHtml((logic.rulesApplied || []).join(', ') || 'None') + '</p><p><strong>Weak Domains:</strong> ' + escapeHtml((logic.weakDomains || []).map(function (item) { return item.name || item; }).join(', ') || 'None') + '</p><p><strong>Weak Concepts:</strong> ' + escapeHtml((logic.weakConcepts || []).map(function (item) { return item.name || item; }).join(', ') || 'None') + '</p><h2>Suggested Next Actions</h2><ul>' + (actionItems || '<li>Export Knowledge Book</li>') + '</ul>';
      chapters.push({ id: 'reasoning_layer', title: 'Reasoning Layer', content: renderChapterPage('Reasoning Layer', logicBody) });
    }
    if (model.visuals) {
      var diagram = model.visuals.diagrams && model.visuals.diagrams[0] && model.visuals.diagrams[0].content;
      var visualBody = '<h1>Visual Map</h1>' + (diagram ? diagram : '<p>Visual graph unavailable. Reasoning summary is still available.</p>');
      chapters.push({ id: 'visual_map', title: 'Visual Map', content: renderChapterPage('Visual Map', visualBody) });
    }
    var reflection = model.reflection;
    var reflectionBody = '<h1>Learning Reflection</h1><p><strong>Total Questions:</strong> ' + reflection.totalQuestions + '</p>';
    if (reflection.topicsCovered.length) reflectionBody += '<p><strong>Topics Covered:</strong> ' + escapeHtml(reflection.topicsCovered.join(', ')) + '</p>';
    if (reflection.mostFrequentTopic) reflectionBody += '<p><strong>Most Frequent Topic:</strong> ' + escapeHtml(reflection.mostFrequentTopic) + '</p>';
    reflectionBody += '<p><strong>Concept Repetition Count:</strong> ' + reflection.conceptRepetitionCount + '</p>';
    if (reflection.sessionDuration) reflectionBody += '<p><strong>Session Duration:</strong> ' + escapeHtml(reflection.sessionDuration) + '</p>';
    chapters.push({ id: 'learning_reflection', title: 'Learning Reflection', content: renderChapterPage('Learning Reflection', reflectionBody) });
    return { title: 'Knowledge Book', creator: 'Alchemist Engine', fileName: 'ALCHEMIST_KNOWLEDGE_BOOK_' + safeFileName(sessionId) + '.epub', metadata: model.metadata, chapters: chapters, knowledgeBook: model };
  }

  function crc32(bytes) {
    var table = crc32.table || (crc32.table = (function () {
      var out = [];
      for (var n = 0; n < 256; n += 1) {
        var c = n;
        for (var k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        out[n] = c >>> 0;
      }
      return out;
    })());
    var crc = 0 ^ -1;
    for (var i = 0; i < bytes.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
    return (crc ^ -1) >>> 0;
  }

  function utf8(value) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value);
    return Buffer.from(value, 'utf8');
  }

  function writeUint16(out, value) { out.push(value & 0xff, (value >>> 8) & 0xff); }
  function writeUint32(out, value) { out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff); }
  function dosTime() { return { time: 0, date: 33 }; }

  function createZip(entries) {
    var out = [];
    var central = [];
    var offset = 0;
    var stamp = dosTime();
    entries.forEach(function (entry) {
      var name = utf8(entry.path);
      var data = entry.bytes || utf8(entry.content || '');
      var crc = crc32(data);
      writeUint32(out, 0x04034b50); writeUint16(out, 20); writeUint16(out, 0); writeUint16(out, 0); writeUint16(out, stamp.time); writeUint16(out, stamp.date); writeUint32(out, crc); writeUint32(out, data.length); writeUint32(out, data.length); writeUint16(out, name.length); writeUint16(out, 0);
      Array.prototype.push.apply(out, Array.from(name)); Array.prototype.push.apply(out, Array.from(data));
      writeUint32(central, 0x02014b50); writeUint16(central, 20); writeUint16(central, 20); writeUint16(central, 0); writeUint16(central, 0); writeUint16(central, stamp.time); writeUint16(central, stamp.date); writeUint32(central, crc); writeUint32(central, data.length); writeUint32(central, data.length); writeUint16(central, name.length); writeUint16(central, 0); writeUint16(central, 0); writeUint16(central, 0); writeUint16(central, 0); writeUint32(central, 0); writeUint32(central, offset);
      Array.prototype.push.apply(central, Array.from(name));
      offset = out.length;
    });
    var centralOffset = out.length;
    Array.prototype.push.apply(out, central);
    writeUint32(out, 0x06054b50); writeUint16(out, 0); writeUint16(out, 0); writeUint16(out, entries.length); writeUint16(out, entries.length); writeUint32(out, central.length); writeUint32(out, centralOffset); writeUint16(out, 0);
    return new Uint8Array(out);
  }

  function navDocument(book) {
    return renderChapterPage('Contents', '<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>' + book.chapters.map(function (chapter) { return '<li><a href="' + escapeHtml(chapter.id) + '.xhtml">' + escapeHtml(chapter.title) + '</a></li>'; }).join('') + '</ol></nav>');
  }

  function packageDocument(book) {
    var metadataJson = JSON.stringify(book.metadata || {});
    var manifest = '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="export_metadata" href="metadata/export.json" media-type="application/json"/>' + book.chapters.map(function (chapter) { return '<item id="' + escapeXml(chapter.id) + '" href="' + escapeXml(chapter.id) + '.xhtml" media-type="application/xhtml+xml"/>'; }).join('');
    var spine = book.chapters.map(function (chapter) { return '<itemref idref="' + escapeXml(chapter.id) + '"/>'; }).join('');
    return '<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0" prefix="alchemist: https://example.com/alchemist/metadata#"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">' + escapeXml(book.fileName) + '</dc:identifier><dc:title>' + escapeXml(book.title) + '</dc:title><dc:creator>' + escapeXml(book.creator) + '</dc:creator><dc:language>en</dc:language><meta property="dcterms:modified">' + normalizeDate(book.metadata && book.metadata.createdAt) + '</meta><meta property="alchemist:metadata">' + escapeXml(metadataJson) + '</meta></metadata><manifest>' + manifest + '</manifest><spine>' + spine + '</spine></package>';
  }

  function buildEPUBPackage(book) {
    var entries = [{ path: 'mimetype', content: EPUB_MIME }, { path: 'META-INF/container.xml', content: CONTAINER_XML }, { path: 'EPUB/package.opf', content: packageDocument(book) }, { path: 'EPUB/nav.xhtml', content: navDocument(book) }, { path: 'EPUB/metadata/export.json', content: JSON.stringify(book.metadata || {}, null, 2) }];
    if (book.knowledgeBook) entries.push({ path: 'EPUB/metadata/knowledge-book.json', content: JSON.stringify(book.knowledgeBook, null, 2) });
    book.chapters.forEach(function (chapter) { entries.push({ path: 'EPUB/' + chapter.id + '.xhtml', content: chapter.content }); });
    return createZip(entries);
  }

  function BaseExporter(options) { this.options = options || {}; }
  BaseExporter.prototype.build = function () { throw new Error('EXPORTER_BUILD_NOT_IMPLEMENTED'); };
  BaseExporter.prototype.makeResult = function (book, mimeType) { return { fileName: book.fileName, mimeType: mimeType, metadata: book.metadata, bytes: book.bytes, book: book }; };

  function EPUBExporter(options) { BaseExporter.call(this, options); }
  EPUBExporter.prototype = Object.create(BaseExporter.prototype);
  EPUBExporter.prototype.constructor = EPUBExporter;
  EPUBExporter.prototype.packageBook = function (book) { book.bytes = buildEPUBPackage(book); return this.makeResult(book, EPUB_MIME); };
  EPUBExporter.prototype.build = function (book) { return this.packageBook(book); };

  function AssetEPUBExporter(options) { EPUBExporter.call(this, options); }
  AssetEPUBExporter.prototype = Object.create(EPUBExporter.prototype);
  AssetEPUBExporter.prototype.constructor = AssetEPUBExporter;
  AssetEPUBExporter.prototype.build = function (structure, options) { return this.packageBook(makeAssetBook(structure, Object.assign({}, this.options, options || {}))); };

  function SessionEPUBExporter(options) { EPUBExporter.call(this, options); }
  SessionEPUBExporter.prototype = Object.create(EPUBExporter.prototype);
  SessionEPUBExporter.prototype.constructor = SessionEPUBExporter;
  SessionEPUBExporter.prototype.build = function (session, options) { return this.packageBook(makeSessionBook(session, Object.assign({}, this.options, options || {}))); };

  function KnowledgeBookExporter(options) { EPUBExporter.call(this, options); }
  KnowledgeBookExporter.prototype = Object.create(EPUBExporter.prototype);
  KnowledgeBookExporter.prototype.constructor = KnowledgeBookExporter;
  KnowledgeBookExporter.prototype.buildModel = function (session, options) { return buildKnowledgeBookModel(session, Object.assign({}, this.options, options || {})); };
  KnowledgeBookExporter.prototype.build = function (session, options) { return this.packageBook(makeKnowledgeBook(session, Object.assign({}, this.options, options || {}))); };

  function PDFExporter(options) { BaseExporter.call(this, options); }
  PDFExporter.prototype = Object.create(BaseExporter.prototype);
  PDFExporter.prototype.constructor = PDFExporter;
  PDFExporter.prototype.build = function (session) {
    var input = session && typeof session === 'object' ? session : {};
    var sessionId = safeText(input.sessionId || input.id, 'SESSION_UNKNOWN');
    var questions = (Array.isArray(input.questions || input.data || input.blocks) ? (input.questions || input.data || input.blocks) : []).map(normalizeQuestion);
    return { fileName: 'ALCHEMIST_' + safeFileName(sessionId) + '.pdf', mimeType: 'application/pdf', metadata: { sessionId: sessionId, questionCount: questions.length }, questions: questions };
  };

  function ZAYExporter(options) { BaseExporter.call(this, options); }
  ZAYExporter.prototype = Object.create(BaseExporter.prototype);
  ZAYExporter.prototype.constructor = ZAYExporter;
  ZAYExporter.prototype.build = function (session) {
    var input = session && typeof session === 'object' ? session : {};
    var sessionId = safeText(input.sessionId || input.id, 'SESSION_UNKNOWN');
    var questions = (Array.isArray(input.questions || input.data || input.blocks) ? (input.questions || input.data || input.blocks) : []).map(normalizeQuestion);
    var legacyPkg = { meta: { version: '2.0', engine: 'zayvora', type: 'study-session', created: Date.now(), sessionId: sessionId, questionCount: questions.length }, content: { blocks: questions.map(function (q, index) { return { type: 'question', title: 'Question ' + (index + 1), body: { question: q.question, answer: q.answer, logic: q.logic } }; }) }, vault: { entities: questions.map(function (q) { return { id: q.id, topic: q.topicHint || q.hint || '' }; }) }, state: { sessionId: sessionId, exportedAt: normalizeDate() } };
    var pkg = zayFormat && typeof zayFormat.buildV2Package === 'function' ? zayFormat.buildV2Package(Object.assign({}, input, { sessionId: sessionId, questions: questions })) : legacyPkg;
    return { fileName: 'ALCHEMIST_SESSION_' + safeFileName(sessionId) + '.zay', mimeType: JSON_MIME, metadata: pkg.meta || legacyPkg.meta, content: JSON.stringify(pkg, null, 2), package: pkg };
  };

  function asSession(input) {
    if (input && typeof input === 'object' && (input.questions || input.data || input.blocks)) return input;
    return { sessionId: input && input.id || 'SINGLE_QUESTION', questions: [input || {}] };
  }

  function createFacade() {
    return {
      BaseExporter: BaseExporter,
      PDFExporter: PDFExporter,
      EPUBExporter: EPUBExporter,
      ZAYExporter: ZAYExporter,
      KnowledgeBookExporter: KnowledgeBookExporter,
      exportSingleQuestionPdf: function (asset) { return new PDFExporter().build(asSession(asset)); },
      exportSingleQuestionEpub: function (asset) { return new AssetEPUBExporter().build(buildQuestionStructuredContent(asset)); },
      exportSingleQuestionZay: function (asset) { return new ZAYExporter().build(asSession(asset)); },
      exportSessionPdf: function (session) { return new PDFExporter().build(session); },
      exportSessionEpub: function (session) { return new SessionEPUBExporter().build(session); },
      exportSessionZay: function (session) { return new ZAYExporter().build(session); },
      exportKnowledgeBook: function (session) { return new KnowledgeBookExporter().build(session); }
    };
  }

  var api = { EPUB_MIME: EPUB_MIME, JSON_MIME: JSON_MIME, BaseExporter: BaseExporter, PDFExporter: PDFExporter, EPUBExporter: EPUBExporter, AssetEPUBExporter: AssetEPUBExporter, SessionEPUBExporter: SessionEPUBExporter, ZAYExporter: ZAYExporter, KnowledgeBookExporter: KnowledgeBookExporter, buildQuestionStructuredContent: buildQuestionStructuredContent, buildKnowledgeBookModel: buildKnowledgeBookModel, buildEPUBPackage: buildEPUBPackage, safeFileName: safeFileName, createFacade: createFacade };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlchemistEPUB = api;
  global.AlchemistExporters = createFacade();
})(typeof window !== 'undefined' ? window : globalThis);
