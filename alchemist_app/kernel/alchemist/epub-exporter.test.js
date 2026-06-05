'use strict';

const assert = require('assert');
const {
  AssetEPUBExporter,
  SessionEPUBExporter,
  KnowledgeBookExporter,
  PDFExporter,
  ZAYExporter,
  EPUB_MIME,
  buildKnowledgeBookModel
} = require('./epub-exporter.js');

function readUInt16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function readZipEntries(bytes) {
  const entries = {};
  let offset = 0;
  const decoder = new TextDecoder();
  while (offset < bytes.length) {
    const sig = readUInt32(bytes, offset);
    if (sig === 0x02014b50 || sig === 0x06054b50) break;
    assert.equal(sig, 0x04034b50);
    const compression = readUInt16(bytes, offset + 8);
    const size = readUInt32(bytes, offset + 18);
    const nameLength = readUInt16(bytes, offset + 26);
    const extraLength = readUInt16(bytes, offset + 28);
    const nameStart = offset + 30;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    assert.equal(compression, 0);
    entries[name] = decoder.decode(bytes.slice(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return entries;
}

(function runTests() {
  const session = {
    sessionId: 'SES_JLWXY',
    createdAt: '2026-06-04T00:00:00.000Z',
    questions: [
      { id: 'q1', q: 'What is ΔH?', u: 'Enthalpy change', logic: 'Heat at constant pressure.', hint: 'Thermodynamics', topic: 'Physical Chemistry', set: 'CHEM' },
      { id: 'q2', q: 'Hardy-Schulze Rule applies to coagulation?', u: 'Higher ion valency coagulates faster', logic: 'Surface chemistry rule for colloids.', hint: 'Hardy-Schulze Rule', topic: 'Physical Chemistry' },
      { id: 'q3', q: 'Hardy-Schulze Rule repeated example?', u: 'Greater charge means greater coagulating power', logic: 'The same surface chemistry concept repeats.', hint: 'Hardy-Schulze Rule', topic: 'Physical Chemistry' },
      { id: 'q4', question: '<b>Rate law?</b>', answer: 'Depends on concentration', explanation: 'Use experimental data.', topic: 'Organic Chemistry' },
      { id: 'q5', q: 'Coordination number of cobalt complex?', u: 'Six', logic: 'Three bidentate ligands donate six atoms.', tags: ['Coordination Chemistry'] }
    ]
  };

  const model = buildKnowledgeBookModel(session);
  assert.deepEqual(model.metadata, {
    exportType: 'knowledge_book',
    sessionId: 'SES_JLWXY',
    createdAt: '2026-06-04T00:00:00.000Z',
    questionCount: 5,
    topics: ['Physical Chemistry', 'Organic Chemistry', 'Coordination Chemistry']
  });
  assert.equal(model.chapters.length, 3);
  assert.equal(model.chapters[0].title, 'Physical Chemistry');
  assert.equal(model.chapters[0].questions.length, 3);
  assert(model.chapters[0].overview.includes('Hardy-Schulze Rule'));
  const hardy = model.concepts.find((concept) => concept.title === 'Hardy-Schulze Rule');
  assert(hardy);
  assert.equal(hardy.count, 2);
  assert.deepEqual(hardy.relatedQuestions, ['q2', 'q3']);
  assert.equal(model.reflection.mostFrequentTopic, 'Physical Chemistry');
  assert.equal(model.reflection.conceptRepetitionCount, 1);

  const knowledgeBook = new KnowledgeBookExporter().build(session);
  assert.equal(knowledgeBook.fileName, 'ALCHEMIST_KNOWLEDGE_BOOK_SES_JLWXY.epub');
  assert(knowledgeBook.bytes instanceof Uint8Array);
  assert(knowledgeBook.bytes.length > 0);
  assert.equal(knowledgeBook.metadata.exportType, 'knowledge_book');
  assert.deepEqual(knowledgeBook.metadata.topics, ['Physical Chemistry', 'Organic Chemistry', 'Coordination Chemistry']);

  const knowledgeEntries = readZipEntries(knowledgeBook.bytes);
  assert.equal(knowledgeEntries.mimetype, EPUB_MIME);
  assert(knowledgeEntries['EPUB/package.opf'].includes('ALCHEMIST_KNOWLEDGE_BOOK_SES_JLWXY.epub'));
  assert(knowledgeEntries['EPUB/nav.xhtml'].includes('Table of Contents'));
  assert(knowledgeEntries['EPUB/table_of_contents.xhtml'].includes('Chapter 1: Physical Chemistry'));
  assert(knowledgeEntries['EPUB/topic_1_physical_chemistry.xhtml'].includes('Chapter Overview'));
  assert(knowledgeEntries['EPUB/topic_1_physical_chemistry.xhtml'].includes('Concept Summary: Hardy-Schulze Rule'));
  assert(knowledgeEntries['EPUB/topic_1_physical_chemistry.xhtml'].includes('This concept appeared 2 times'));
  assert(knowledgeEntries['EPUB/learning_reflection.xhtml'].includes('Learning Reflection'));
  assert.equal(JSON.parse(knowledgeEntries['EPUB/metadata/export.json']).exportType, 'knowledge_book');
  assert.equal(JSON.parse(knowledgeEntries['EPUB/metadata/knowledge-book.json']).concepts.find((concept) => concept.title === 'Hardy-Schulze Rule').count, 2);

  const sessionBook = new SessionEPUBExporter().build(session);
  assert.equal(sessionBook.fileName, 'ALCHEMIST_SESSION_SES_JLWXY.epub');
  assert(sessionBook.bytes instanceof Uint8Array);
  assert.equal(sessionBook.metadata.questionCount, 5);
  const sessionEntries = readZipEntries(sessionBook.bytes);
  assert(sessionEntries['EPUB/package.opf'].includes('ALCHEMIST_SESSION_SES_JLWXY.epub'));
  assert.equal(JSON.parse(sessionEntries['EPUB/metadata/export.json']).questionCount, 5);
  assert(sessionEntries['EPUB/question_1.xhtml'].includes('What is ΔH?'));

  const emptyBook = new SessionEPUBExporter().build({ sessionId: 'SES_EMPTY', createdAt: '2026-06-04T00:00:00.000Z', questions: [] });
  const emptyEntries = readZipEntries(emptyBook.bytes);
  assert.equal(emptyBook.metadata.questionCount, 0);
  assert(emptyEntries['EPUB/empty_session.xhtml'].includes('No questions were available'));

  const assetBook = new AssetEPUBExporter().build({
    title: 'Single Question Asset',
    author: 'Alchemist Engine',
    question: 'What is pH?',
    answer: 'Potential of hydrogen',
    logic: 'Measures acidity.',
    chapters: [{ title: 'Concept', content: 'pH uses logarithms.' }]
  });
  const assetEntries = readZipEntries(assetBook.bytes);
  assert.equal(assetBook.fileName, 'Single_Question_Asset.epub');
  assert(assetEntries['EPUB/asset.xhtml'].includes('What is pH?'));
  assert(assetEntries['EPUB/asset.xhtml'].includes('pH uses logarithms.'));

  const pdf = new PDFExporter().build(session);
  assert.equal(pdf.fileName, 'ALCHEMIST_SES_JLWXY.pdf');
  assert.equal(pdf.metadata.questionCount, 5);

  const zay = new ZAYExporter().build(session);
  assert.equal(zay.fileName, 'ALCHEMIST_SESSION_SES_JLWXY.zay');
  assert.equal(zay.package.meta.questionCount, 5);
  assert.equal(JSON.parse(zay.content).content.blocks.length, 5);

  console.log('epub-exporter tests passed');
})();
