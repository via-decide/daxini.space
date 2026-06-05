const assert = require('node:assert');
const exporter = require('./knowledge-book-exporter.js');

const session = {
  sessionId: 'SES_JLWXY',
  createdAt: '2026-06-04T00:00:00.000Z',
  questions: [
    {
      id: 'A_0094',
      domain: 'Physical Chemistry',
      topic: 'Hardy-Schulze Rule',
      question: 'According to the Hardy-Schulze rule, which ion has maximum coagulating power?',
      answer: 'The ion with greater opposite charge.',
      logic: 'Coagulation occurs when ions of opposite charge neutralize colloids.'
    },
    {
      id: 'A_0101',
      domain: 'Organic Chemistry',
      topic: 'Hoffmann Bromamide',
      question: 'What does Hoffmann bromamide degradation produce?',
      answer: 'A primary amine with one fewer carbon.',
      logic: 'The carbonyl carbon is removed during rearrangement.'
    },
    {
      id: 'A_BAD',
      domain: 'Inorganic Chemistry',
      topic: '<script>alert(1)</script>Coordination',
      question: 'Does <img src=x onerror=alert(1)> survive?',
      answer: '<b>No</b>',
      logic: 'Unsafe tags must be escaped or stripped.'
    }
  ]
};

const book = exporter.createKnowledgeBook(session);
assert.equal(book.metadata.sessionId, 'SES_JLWXY');
assert.equal(book.metadata.questionCount, 3);
assert(book.concepts.length >= 3);
assert.equal(book.questions.length, 3);

const text = exporter.renderAsText(book);
assert(text.includes('Session: SES_JLWXY'));
assert(text.includes('CHAPTER 1 — PHYSICAL CHEMISTRY'));
assert(text.includes('Organic Chemistry'));
assert(text.includes('LEARNING REFLECTION'));

const html = exporter.renderAsHtml(book);
assert(html.includes('SES_JLWXY'));
assert(!html.includes('<img src=x'));
assert(!html.includes('<script>alert(1)</script>'));
assert(html.includes('&lt;b&gt;No&lt;/b&gt;') || html.includes('No'));

const formats = exporter.getSupportedFormats();
assert(formats.find((format) => format.id === 'txt' && format.enabled));
assert(formats.find((format) => format.id === 'html' && format.enabled));
assert(formats.find((format) => format.id === 'docx' && !format.enabled && format.disabledReason === 'Coming soon'));
assert.throws(() => exporter.exportKnowledgeBook(session, 'docx'), /Coming soon/);

const txtResult = exporter.exportKnowledgeBook(session, 'txt');
assert.equal(txtResult.fileName, 'ALCHEMIST_KNOWLEDGE_BOOK_SES_JLWXY.txt');
assert(txtResult.content.includes('Hardy-Schulze Rule'));

const htmlResult = exporter.exportKnowledgeBook(session, 'html');
assert.equal(htmlResult.fileName, 'ALCHEMIST_KNOWLEDGE_BOOK_SES_JLWXY.html');
assert(htmlResult.content.includes('<!DOCTYPE html>'));

const pdfResult = exporter.renderAsPdf(book);
assert.equal(pdfResult.fileName, 'ALCHEMIST_KNOWLEDGE_BOOK_SES_JLWXY.pdf');
assert.equal(pdfResult.fallback, true);

const epubResult = exporter.exportKnowledgeBook(session, 'epub');
assert.equal(epubResult.fileName, 'ALCHEMIST_KNOWLEDGE_BOOK_SES_JLWXY.epub');

console.log('knowledge-book-exporter tests passed');
