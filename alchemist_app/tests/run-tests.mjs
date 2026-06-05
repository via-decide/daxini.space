import assert from 'node:assert';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const normalizer = require('../kernel/alchemist/session-normalizer.js');
const exporters = require('../kernel/alchemist/epub-exporter.js');

const rawQuestion = {
  id: 'Q1',
  set: 'SET_A',
  dom: 'Physical Chemistry',
  q: 'What is entropy?',
  correct: 'Disorder measure',
  logic: '',
  hint: 'Thermodynamics',
  trap: '12'
};

const normalized = normalizer.normalizeQuestion(rawQuestion, 0);
assert.equal(normalized.id, 'Q1');
assert.equal(normalized.domain, 'Physical Chemistry');
assert.equal(normalized.question, 'What is entropy?');
assert.equal(normalized.answer, 'Disorder measure');
assert.equal(normalized.logic, 'Logic unavailable.');
assert.equal(normalized.topic, 'Thermodynamics');
assert.equal(normalized.trap, '');
assert.equal(normalizer.isNumericTrap('12'), true);

const session = normalizer.normalizeSession({
  sessionId: 'SES_TEST',
  createdAt: '2026-06-04T00:00:00.000Z',
  questions: [
    rawQuestion,
    { id: 'Q2', domain: 'Organic Chemistry', question: 'What is Hoffmann bromamide?', answer: 'Amide degradation', logic: 'Forms amine.', trap: 'Carbon count unchanged' },
    { id: 'Q3', q: 'No domain question', correct: 'Fallback', trap: 5 }
  ]
});

const grouped = normalizer.groupByDomain(session);
assert.equal(grouped['Physical Chemistry'].length, 1);
assert.equal(grouped['Organic Chemistry'].length, 1);
assert.equal(grouped.Uncategorized.length, 1);

const knowledge = normalizer.buildKnowledgeBook(session);
assert.equal(knowledge.metadata.exportType, 'knowledge_book');
assert.equal(knowledge.metadata.sessionId, 'SES_TEST');
assert.equal(knowledge.metadata.questionCount, 3);
assert.equal(knowledge.chapters.length, 3);
assert.equal(knowledge.reflection.totalQuestions, 3);
assert(knowledge.metadata.topics.includes('Uncategorized'));

const sessionEpub = new exporters.SessionEPUBExporter().build(session);
assert.equal(sessionEpub.fileName, 'ALCHEMIST_SESSION_SES_TEST.epub');
assert(sessionEpub.bytes instanceof Uint8Array);

const knowledgeEpub = new exporters.KnowledgeBookExporter().build(session);
assert.equal(knowledgeEpub.fileName, 'ALCHEMIST_KNOWLEDGE_BOOK_SES_TEST.epub');
assert.equal(knowledgeEpub.metadata.exportType, 'knowledge_book');

const facade = exporters.createFacade();
assert.equal(facade.exportSessionPdf(session).fileName, 'ALCHEMIST_SES_TEST.pdf');
assert.equal(facade.exportSessionZay(session).fileName, 'ALCHEMIST_SESSION_SES_TEST.zay');
assert.equal(facade.exportSingleQuestionEpub(rawQuestion).fileName, 'What_is_entropy.epub');

const vault = spawnSync('node', ['scripts/validate-vault.mjs'], { encoding: 'utf8' });
assert.equal(vault.status, 0, vault.stderr || vault.stdout);

const kernelTests = [
  'kernel/alchemist/block-system.test.js',
  'kernel/alchemist/epub-exporter.test.js',
  'kernel/alchemist/session-engine.test.js',
  'kernel/alchemist/session-review.test.js',
  'kernel/alchemist/navigation-state.test.js',
  'kernel/alchemist/knowledge-book-exporter.test.js',
  'kernel/alchemist/zay-compiler.test.js',
  'kernel/alchemist/zay-importer.test.js',
  'tests/universe-integration.test.js'
];
for (const test of kernelTests) {
  const result = spawnSync('node', [test], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${test}\n${result.stdout}\n${result.stderr}`);
}

console.log('Alchemist lightweight tests passed.');
