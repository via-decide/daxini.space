/**
 * MODULE_CONTRACT
 * Inputs: completed Alchemist session data and a selected export format
 * Outputs: Knowledge Book render results, format chooser UI, and browser downloads/print fallback
 * Functions: openFormatDialog(), exportKnowledgeBook(), renderAsText(), renderAsHtml(), renderAsEpub(), renderAsPdf(), getSupportedFormats()
 * Constraints: browser-first IIFE, no external UI library, no framework dependencies, render from neutral KnowledgeBook model
 */
(function (global) {
  'use strict';

  var normalizer = global.AlchemistSessionNormalizer;
  if (!normalizer && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    normalizer = require('./session-normalizer.js');
  }

  var epubApi = global.AlchemistEPUB;
  if (!epubApi && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    epubApi = require('./epub-exporter.js');
  }

  var TEXT_MIME = 'text/plain;charset=utf-8';
  var HTML_MIME = 'text/html;charset=utf-8';
  var PDF_MIME = 'application/pdf';

  function fail(code, message) {
    var error = new Error(message || code);
    error.code = code;
    throw error;
  }

  function nowIso() { return new Date().toISOString(); }

  function safeText(value, fallback) {
    var text = value === null || typeof value === 'undefined' ? '' : String(value);
    text = text.replace(/<[^>]*>/g, '').replace(/&Delta;/g, 'Δ').replace(/\s+/g, ' ').trim();
    return text || fallback || '';
  }

  function escapeHtml(value) {
    return String(value === null || typeof value === 'undefined' ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeFileName(value) {
    if (epubApi && typeof epubApi.safeFileName === 'function') return epubApi.safeFileName(value);
    return safeText(value, 'SESSION_UNKNOWN').replace(/[\\/:*?"<>|]+/g, ' ').trim().replace(/\s+/g, '_') || 'SESSION_UNKNOWN';
  }

  function normalizeSession(session) {
    if (!normalizer || typeof normalizer.normalizeSession !== 'function') {
      fail('KNOWLEDGE_NORMALIZER_UNAVAILABLE', 'Knowledge Book normalizer is unavailable.');
    }
    return normalizer.normalizeSession(session || {});
  }

  function baseKnowledgeBook(session) {
    if (!normalizer || typeof normalizer.buildKnowledgeBook !== 'function') {
      fail('KNOWLEDGE_BUILDER_UNAVAILABLE', 'Knowledge Book builder is unavailable.');
    }
    return normalizer.buildKnowledgeBook(session || {});
  }

  function buildQuestionMap(questions) {
    return (Array.isArray(questions) ? questions : []).reduce(function (map, question) {
      map[question.id] = question;
      return map;
    }, {});
  }

  function createKnowledgeBook(session) {
    var normalized = normalizeSession(session);
    var base = baseKnowledgeBook(normalized);
    var questionMap = buildQuestionMap(normalized.questions);
    var concepts = [];

    var chapters = (base.chapters || []).map(function (chapter, chapterIndex) {
      var chapterQuestions = [];
      var chapterConcepts = (chapter.concepts || []).map(function (concept) {
        var relatedQuestions = (concept.questions || []).map(function (questionRef) {
          var question = questionMap[questionRef.id] || questionRef;
          var normalizedQuestion = {
            id: safeText(question.id, questionRef.id),
            question: safeText(question.question, questionRef.question),
            answer: safeText(question.answer, questionRef.answer),
            logic: safeText(question.logic || concept.explanation, 'Logic unavailable.'),
            domain: safeText(question.domain, chapter.title),
            topic: safeText(question.topic, concept.title)
          };
          chapterQuestions.push(normalizedQuestion);
          return normalizedQuestion;
        });
        var conceptModel = {
          id: safeText(concept.id, 'concept_' + (concepts.length + 1)),
          title: safeText(concept.title, 'Concept'),
          summary: safeText(concept.explanation, 'Logic unavailable.'),
          questions: relatedQuestions,
          chapterTitle: safeText(chapter.title, 'Uncategorized')
        };
        concepts.push(conceptModel);
        return conceptModel;
      });
      return {
        id: safeText(chapter.id, 'chapter_' + (chapterIndex + 1)),
        title: safeText(chapter.title, 'Uncategorized'),
        overview: chapterConcepts.length + ' concept' + (chapterConcepts.length === 1 ? '' : 's') + ' from ' + chapterQuestions.length + ' question' + (chapterQuestions.length === 1 ? '' : 's') + '.',
        concepts: chapterConcepts,
        questions: chapterQuestions
      };
    });

    return {
      metadata: {
        title: 'ALCHEMIST KNOWLEDGE BOOK',
        generatedBy: 'VIA.STACK',
        exportType: 'knowledge_book',
        sessionId: base.metadata && base.metadata.sessionId || normalized.sessionId,
        createdAt: base.metadata && base.metadata.createdAt || normalized.createdAt,
        generatedAt: nowIso(),
        questionCount: normalized.questions.length,
        topics: base.metadata && base.metadata.topics || chapters.map(function (chapter) { return chapter.title; })
      },
      chapters: chapters,
      concepts: concepts,
      questions: normalized.questions.map(function (question) {
        return {
          id: question.id,
          question: question.question,
          answer: question.answer,
          logic: question.logic,
          domain: question.domain,
          topic: question.topic
        };
      }),
      logic: normalized.logic || session && session.logic || null,
      visuals: normalized.visuals || session && session.visuals || null,
      reflection: base.reflection || {
        totalQuestions: normalized.questions.length,
        topicsCovered: chapters.map(function (chapter) { return chapter.title; }),
        mostFrequentTopic: '',
        repeatedConceptCount: 0,
        sessionId: normalized.sessionId,
        exportTimestamp: nowIso()
      }
    };
  }

  function getFileName(knowledgeBook, extension) {
    return 'ALCHEMIST_KNOWLEDGE_BOOK_' + safeFileName(knowledgeBook.metadata && knowledgeBook.metadata.sessionId || 'SESSION_UNKNOWN') + '.' + extension;
  }

  function getSupportedFormats() {
    var epubEnabled = !!(epubApi && typeof epubApi.KnowledgeBookExporter === 'function');
    return [
      { id: 'epub', label: 'EPUB publication', extension: 'epub', enabled: epubEnabled, disabledReason: epubEnabled ? '' : 'EPUB export requires JSZip. TXT and HTML are available now.' },
      { id: 'pdf', label: 'PDF document', extension: 'pdf', enabled: true },
      { id: 'docx', label: 'Word document', extension: 'docx', enabled: false, disabledReason: 'Coming soon' },
      { id: 'txt', label: 'Plain text', extension: 'txt', enabled: true },
      { id: 'html', label: 'Web page', extension: 'html', enabled: true },
      { id: 'rtf', label: 'Rich Text format', extension: 'rtf', enabled: false, disabledReason: 'Coming soon' },
      { id: 'odt', label: 'OpenDocument format', extension: 'odt', enabled: false, disabledReason: 'Coming soon' }
    ];
  }

  function findFormat(formatId) {
    var id = String(formatId || '').toLowerCase();
    var match = getSupportedFormats().filter(function (format) { return format.id === id; })[0];
    if (!match) fail('KNOWLEDGE_FORMAT_UNKNOWN', 'Unknown Knowledge Book format: ' + formatId);
    return match;
  }

  function sectionLine(text) {
    return text + '\n' + new Array(text.length + 1).join('-') + '\n';
  }

  function listNames(items) {
    return (Array.isArray(items) ? items : []).map(function (item) { return safeText(item && item.name || item, ''); }).filter(Boolean).join(', ') || 'None';
  }

  function actionLines(actions, prefix) {
    return (Array.isArray(actions) ? actions : []).map(function (action) { return (prefix || '- ') + safeText(action.label || action.type, 'Next action') + ' — ' + safeText(action.reason, ''); });
  }

  function renderAsText(knowledgeBook) {
    var book = knowledgeBook && knowledgeBook.metadata ? knowledgeBook : createKnowledgeBook(knowledgeBook);
    var metadata = book.metadata || {};
    var lines = [];
    lines.push('ALCHEMIST KNOWLEDGE BOOK');
    lines.push('Generated by VIA.STACK');
    lines.push('');
    lines.push('Session: ' + safeText(metadata.sessionId, 'SESSION_UNKNOWN'));
    lines.push('Questions: ' + (metadata.questionCount || 0));
    lines.push('Generated: ' + safeText(metadata.generatedAt || metadata.createdAt, nowIso()));
    lines.push('');
    lines.push('TABLE OF CONTENTS');
    (book.chapters || []).forEach(function (chapter, index) { lines.push((index + 1) + '. ' + chapter.title); });
    lines.push((book.chapters || []).length + 1 + '. Learning Reflection');
    lines.push('');

    (book.chapters || []).forEach(function (chapter, chapterIndex) {
      lines.push('==================================================');
      lines.push('CHAPTER ' + (chapterIndex + 1) + ' — ' + chapter.title.toUpperCase());
      lines.push('==================================================');
      lines.push('');
      lines.push('Chapter Overview:');
      lines.push(chapter.overview || 'Concept overview unavailable.');
      lines.push('');
      (chapter.concepts || []).forEach(function (concept) {
        lines.push('Concept: ' + concept.title);
        lines.push('');
        lines.push('Concept Summary:');
        lines.push(concept.summary || 'Logic unavailable.');
        lines.push('');
        lines.push('Related Questions:');
        (concept.questions || []).forEach(function (question) {
          lines.push('- ' + question.id + ': ' + question.question);
        });
        lines.push('');
        (concept.questions || []).forEach(function (question) {
          lines.push('Answer:');
          lines.push(question.answer || 'Answer unavailable.');
          lines.push('');
          lines.push('Logic:');
          lines.push(question.logic || concept.summary || 'Logic unavailable.');
          lines.push('');
        });
        lines.push('--------------------------------------------------');
        lines.push('');
      });
    });

    var logic = book.logic || {};
    lines.push('## Reasoning Layer');
    lines.push('Rules Applied: ' + ((logic.rulesApplied || []).join(', ') || 'None'));
    lines.push('Weak Domains: ' + listNames(logic.weakDomains));
    lines.push('Weak Concepts: ' + listNames(logic.weakConcepts));
    lines.push('Suggested Next Actions:');
    lines = lines.concat(actionLines(logic.nextActions, '- '));
    if (!logic || logic.unavailable) lines.push('- Reasoning engine unavailable.');
    lines.push('');

    var visualDiagram = book.visuals && book.visuals.diagrams && book.visuals.diagrams[0] && book.visuals.diagrams[0].content;
    lines.push('## Visual Map');
    lines.push(visualDiagram ? safeText(visualDiagram, 'Inline SVG available in HTML/EPUB exports.') : 'Visual graph unavailable. Reasoning summary is still available.');
    lines.push('');

    var reflection = book.reflection || {};
    lines.push('LEARNING REFLECTION');
    lines.push('Total Questions: ' + (reflection.totalQuestions || metadata.questionCount || 0));
    lines.push('Topics Covered: ' + ((reflection.topicsCovered || metadata.topics || []).join(', ') || 'None'));
    lines.push('Most Frequent Topic: ' + (reflection.mostFrequentTopic || 'N/A'));
    lines.push('Repeated Concept Count: ' + (reflection.repeatedConceptCount || reflection.conceptRepetitionCount || 0));
    return lines.join('\n');
  }

  function renderAsHtml(knowledgeBook) {
    var book = knowledgeBook && knowledgeBook.metadata ? knowledgeBook : createKnowledgeBook(knowledgeBook);
    var metadata = book.metadata || {};
    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + escapeHtml(metadata.title || 'Alchemist Knowledge Book') + '</title>';
    html += '<style>body{font-family:Georgia,serif;line-height:1.55;color:#111;background:#fff;max-width:880px;margin:0 auto;padding:32px;}h1,h2,h3{font-family:Arial,sans-serif;}h1{border-bottom:2px solid #111;padding-bottom:12px;}h2{break-before:page;margin-top:36px;border-bottom:1px solid #bbb;padding-bottom:6px;}nav ol{padding-left:24px}.meta,.reflection{background:#f4f4f4;border:1px solid #ddd;padding:14px;margin:18px 0}.concept{margin:24px 0;padding:14px;border-left:4px solid #222;background:#fafafa}.question{margin:14px 0;padding:12px;border:1px solid #ddd}pre{white-space:pre-wrap}@media print{body{max-width:none;padding:0}.no-print{display:none}h2{break-before:page}}</style></head><body>';
    html += '<h1>' + escapeHtml(metadata.title || 'ALCHEMIST KNOWLEDGE BOOK') + '</h1>';
    html += '<p><strong>Generated by VIA.STACK</strong></p>';
    html += '<section class="meta"><p><strong>Session:</strong> ' + escapeHtml(metadata.sessionId || 'SESSION_UNKNOWN') + '</p><p><strong>Questions:</strong> ' + escapeHtml(metadata.questionCount || 0) + '</p><p><strong>Generated:</strong> ' + escapeHtml(metadata.generatedAt || metadata.createdAt || nowIso()) + '</p></section>';
    html += '<nav><h2>Table of Contents</h2><ol>' + (book.chapters || []).map(function (chapter) { return '<li>' + escapeHtml(chapter.title) + '</li>'; }).join('') + '<li>Learning Reflection</li></ol></nav>';
    (book.chapters || []).forEach(function (chapter, chapterIndex) {
      html += '<section class="chapter"><h2>Chapter ' + (chapterIndex + 1) + ' — ' + escapeHtml(chapter.title) + '</h2>';
      html += '<h3>Chapter Overview</h3><p>' + escapeHtml(chapter.overview || 'Concept overview unavailable.') + '</p>';
      (chapter.concepts || []).forEach(function (concept) {
        html += '<article class="concept"><h3>Concept: ' + escapeHtml(concept.title) + '</h3><p><strong>Concept Summary:</strong></p><p>' + escapeHtml(concept.summary || 'Logic unavailable.') + '</p>';
        html += '<h4>Related Questions</h4><ul>' + (concept.questions || []).map(function (question) { return '<li>' + escapeHtml(question.id) + ': ' + escapeHtml(question.question) + '</li>'; }).join('') + '</ul>';
        (concept.questions || []).forEach(function (question) {
          html += '<div class="question"><p><strong>' + escapeHtml(question.id) + '</strong></p><p>' + escapeHtml(question.question) + '</p><p><strong>Answer:</strong> ' + escapeHtml(question.answer || 'Answer unavailable.') + '</p><p><strong>Logic:</strong> ' + escapeHtml(question.logic || concept.summary || 'Logic unavailable.') + '</p></div>';
        });
        html += '</article>';
      });
      html += '</section>';
    });
    var logic = book.logic || {};
    html += '<section class="reasoning"><h2>Reasoning Layer</h2><p><strong>Rules Applied:</strong> ' + escapeHtml((logic.rulesApplied || []).join(', ') || 'None') + '</p><p><strong>Weak Domains:</strong> ' + escapeHtml(listNames(logic.weakDomains)) + '</p><p><strong>Weak Concepts:</strong> ' + escapeHtml(listNames(logic.weakConcepts)) + '</p><h3>Suggested Next Actions</h3><ul>' + (actionLines(logic.nextActions, '').map(function (line) { return '<li>' + escapeHtml(line) + '</li>'; }).join('') || '<li>' + (logic.unavailable ? 'Reasoning engine unavailable.' : 'Export Knowledge Book') + '</li>') + '</ul></section>';
    var visualDiagram = book.visuals && book.visuals.diagrams && book.visuals.diagrams[0] && book.visuals.diagrams[0].content;
    html += '<section class="visual-map"><h2>Visual Map</h2>' + (visualDiagram ? visualDiagram : '<p>Visual graph unavailable. Reasoning summary is still available.</p>') + '</section>';
    var reflection = book.reflection || {};
    html += '<section class="reflection"><h2>Learning Reflection</h2><p><strong>Total Questions:</strong> ' + escapeHtml(reflection.totalQuestions || metadata.questionCount || 0) + '</p><p><strong>Topics Covered:</strong> ' + escapeHtml((reflection.topicsCovered || metadata.topics || []).join(', ') || 'None') + '</p><p><strong>Most Frequent Topic:</strong> ' + escapeHtml(reflection.mostFrequentTopic || 'N/A') + '</p><p><strong>Repeated Concept Count:</strong> ' + escapeHtml(reflection.repeatedConceptCount || reflection.conceptRepetitionCount || 0) + '</p></section>';
    html += '</body></html>';
    return html;
  }

  function renderAsEpub(knowledgeBook) {
    var book = knowledgeBook && knowledgeBook.metadata ? knowledgeBook : createKnowledgeBook(knowledgeBook);
    if (!epubApi || typeof epubApi.KnowledgeBookExporter !== 'function') {
      fail('KNOWLEDGE_EPUB_UNAVAILABLE', 'EPUB export requires JSZip. TXT and HTML are available now.');
    }
    var session = { sessionId: book.metadata.sessionId, createdAt: book.metadata.createdAt, questions: book.questions || [], logic: book.logic || null, visuals: book.visuals || null };
    return new epubApi.KnowledgeBookExporter().build(session);
  }

  function writePdfWithJsPdf(knowledgeBook) {
    var jsPDF = global.jspdf && global.jspdf.jsPDF;
    if (!jsPDF) return null;
    var text = renderAsText(knowledgeBook);
    var doc = new jsPDF();
    var y = 18;
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    text.split('\n').forEach(function (line) {
      var wrapped = doc.splitTextToSize(line || ' ', 180);
      wrapped.forEach(function (part) {
        if (y > 280) { doc.addPage(); y = 18; }
        doc.text(part, 15, y);
        y += 5;
      });
    });
    return { fileName: getFileName(knowledgeBook, 'pdf'), mimeType: PDF_MIME, pdfDocument: doc, fallback: false };
  }

  function renderAsPdf(knowledgeBook) {
    var book = knowledgeBook && knowledgeBook.metadata ? knowledgeBook : createKnowledgeBook(knowledgeBook);
    var pdf = writePdfWithJsPdf(book);
    if (pdf) return pdf;
    return { fileName: getFileName(book, 'pdf'), mimeType: HTML_MIME, content: renderAsHtml(book), fallback: true, message: 'Use browser print to save as PDF' };
  }

  function makeBlobDownload(fileName, content, mimeType) {
    if (!global.document || typeof global.Blob === 'undefined' || !global.URL) return;
    var anchor = global.document.createElement('a');
    anchor.href = global.URL.createObjectURL(new global.Blob([content], { type: mimeType }));
    anchor.download = fileName;
    anchor.click();
    setTimeout(function () { global.URL.revokeObjectURL(anchor.href); }, 1000);
  }

  function openPrintFallback(result) {
    if (!global.open) return false;
    var printWindow = global.open('', '_blank');
    if (!printWindow || !printWindow.document) return false;
    printWindow.document.open();
    printWindow.document.write(result.content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function () { printWindow.print(); }, 250);
    return true;
  }

  function notifyNavigation(success, payload) {
    var nav = global.AlchemistNavigation;
    if (nav && typeof nav.pushView === 'function') {
      nav.pushView('export-complete', payload);
      return;
    }
    showSimpleToast(success ? 'Knowledge Book exported' : 'Knowledge Book export failed', payload.reason || payload.filename || '');
  }

  function showSimpleToast(title, message) {
    if (!global.document) return;
    var toast = global.document.createElement('div');
    toast.setAttribute('role', 'status');
    toast.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;background:#080808;color:#ccc;border:1px solid #333;border-radius:8px;padding:12px;font:12px monospace;max-width:92vw;box-shadow:0 12px 40px rgba(0,0,0,.8)';
    toast.textContent = title + (message ? ' — ' + message : '');
    global.document.body.appendChild(toast);
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4500);
  }

  function exportKnowledgeBook(session, formatId) {
    var format = findFormat(formatId);
    if (!format.enabled) fail('KNOWLEDGE_FORMAT_DISABLED', (format.disabledReason || 'Coming soon'));
    var book = createKnowledgeBook(session);
    var result;
    if (format.id === 'txt') {
      result = { fileName: getFileName(book, 'txt'), mimeType: TEXT_MIME, content: renderAsText(book) };
      makeBlobDownload(result.fileName, result.content, result.mimeType);
    } else if (format.id === 'html') {
      result = { fileName: getFileName(book, 'html'), mimeType: HTML_MIME, content: renderAsHtml(book) };
      makeBlobDownload(result.fileName, result.content, result.mimeType);
    } else if (format.id === 'epub') {
      result = renderAsEpub(book);
      makeBlobDownload(result.fileName, result.bytes, result.mimeType || (epubApi && epubApi.EPUB_MIME) || 'application/epub+zip');
    } else if (format.id === 'pdf') {
      result = renderAsPdf(book);
      if (result.pdfDocument && typeof result.pdfDocument.save === 'function') result.pdfDocument.save(result.fileName);
      else if (result.fallback) openPrintFallback(result);
    }
    if (!result) fail('KNOWLEDGE_EXPORT_EMPTY', 'Knowledge Book export did not produce a file.');
    notifyNavigation(true, { type: 'knowledge-book', format: format.id, formatLabel: format.label, filename: result.fileName, message: result.message || '', data: book.questions || [], knowledgeBook: book });
    return result;
  }

  function ensureDialogStyles() {
    if (!global.document || global.document.getElementById('knowledge-book-exporter-style')) return;
    var style = global.document.createElement('style');
    style.id = 'knowledge-book-exporter-style';
    style.textContent = '.kb-format-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:220;display:flex;align-items:flex-end;justify-content:center;padding:16px}.kb-format-dialog{width:min(520px,100%);background:#080808;border:1px solid #333;border-radius:10px;color:#ccc;font:12px monospace;box-shadow:0 20px 70px rgba(0,0,0,.9);padding:16px}.kb-format-dialog h2{margin:0 0 12px;color:#ffd600;font:700 13px monospace;text-transform:uppercase;letter-spacing:1.4px}.kb-format-option{display:flex;align-items:flex-start;gap:9px;padding:9px 6px;border-bottom:1px solid #1a1a1a}.kb-format-option.disabled{color:#666}.kb-format-option input{margin-top:2px}.kb-format-sub{display:block;color:#777;margin-top:3px}.kb-format-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.kb-format-actions button{background:#080808;color:#aaa;border:1px solid #333;border-radius:4px;padding:7px 10px;font:11px monospace;text-transform:uppercase;letter-spacing:1px;cursor:pointer}.kb-format-actions button:hover,.kb-format-actions button:focus{border-color:#ffd600;color:#ffd600;outline:none}@media(min-width:640px){.kb-format-backdrop{align-items:center}}';
    global.document.head.appendChild(style);
  }

  function closeFormatDialog() {
    if (!global.document) return;
    var existing = global.document.getElementById('knowledge-book-format-dialog');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  function openFormatDialog(session) {
    if (!global.document) fail('KNOWLEDGE_DIALOG_UNAVAILABLE', 'Format dialog requires a browser document.');
    ensureDialogStyles();
    closeFormatDialog();
    var formats = getSupportedFormats();
    var firstEnabled = formats.filter(function (format) { return format.enabled; })[0];
    var backdrop = global.document.createElement('div');
    backdrop.id = 'knowledge-book-format-dialog';
    backdrop.className = 'kb-format-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Choose Knowledge Book Format');
    backdrop.innerHTML = '<form class="kb-format-dialog"><h2>Choose Knowledge Book Format</h2><div class="kb-format-list">' + formats.map(function (format) {
      var disabled = format.enabled ? '' : ' disabled';
      var checked = firstEnabled && firstEnabled.id === format.id ? ' checked' : '';
      return '<label class="kb-format-option' + (format.enabled ? '' : ' disabled') + '"><input type="radio" name="kb-format" value="' + escapeHtml(format.id) + '"' + disabled + checked + '><span>' + escapeHtml(format.label) + ' (.' + escapeHtml(format.extension) + ')' + (!format.enabled ? '<span class="kb-format-sub">' + escapeHtml(format.disabledReason || 'Coming soon') + '</span>' : '') + '</span></label>';
    }).join('') + '</div><div class="kb-format-actions"><button type="button" id="kb-format-cancel" aria-label="Cancel Knowledge Book export">Cancel</button><button type="submit" aria-label="Export Knowledge Book">Export</button></div></form>';
    backdrop.addEventListener('click', function (event) { if (event.target === backdrop) closeFormatDialog(); });
    backdrop.querySelector('#kb-format-cancel').addEventListener('click', closeFormatDialog);
    backdrop.querySelector('form').addEventListener('submit', function (event) {
      event.preventDefault();
      var selected = backdrop.querySelector('input[name="kb-format"]:checked');
      if (!selected) return;
      try {
        exportKnowledgeBook(session, selected.value);
        closeFormatDialog();
      } catch (error) {
        notifyNavigation(false, { type: 'knowledge-book', failed: true, reason: error && error.message ? error.message : 'Knowledge Book export failed', filename: '', format: selected.value });
      }
    });
    global.document.body.appendChild(backdrop);
    var firstInput = backdrop.querySelector('input[name="kb-format"]:not(:disabled)');
    if (firstInput) firstInput.focus();
    return backdrop;
  }

  var api = {
    openFormatDialog: openFormatDialog,
    exportKnowledgeBook: exportKnowledgeBook,
    renderAsText: renderAsText,
    renderAsHtml: renderAsHtml,
    renderAsEpub: renderAsEpub,
    renderAsPdf: renderAsPdf,
    getSupportedFormats: getSupportedFormats,
    createKnowledgeBook: createKnowledgeBook,
    _getFileName: getFileName,
    _escapeHtml: escapeHtml
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlchemistKnowledgeBookExporter = api;
})(typeof window !== 'undefined' ? window : globalThis);
