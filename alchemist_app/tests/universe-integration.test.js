const assert = require('assert');

const normalizer = require('../kernel/alchemist/session-normalizer.js');
global.AlchemistSessionNormalizer = normalizer;
const ViaLogic = require('../packages/logic-core/vialogic.js');
const VisualEngine = require('../packages/visual-core/zayvora-visual-engine.js');
global.ViaLogic = ViaLogic;
global.ZayvoraVisualEngine = VisualEngine;
const Universe = require('../packages/kernel/alchemist-universe-session.js');
const ZayFormat = require('../packages/zay-format/zay-v2.js');
global.AlchemistZayFormat = ZayFormat;
const exporters = require('../kernel/alchemist/epub-exporter.js');
const knowledgeExporter = require('../kernel/alchemist/knowledge-book-exporter.js');

const questions = [
  { id: 'Q1', dom: 'Physical Chemistry', topic: 'Entropy', q: 'What is entropy?', u: 'Disorder measure', correct: 'Disorder measure', logic: 'Entropy measures energy dispersal.' },
  { id: 'Q2', dom: 'Organic Chemistry', topic: 'SN2', q: 'What does SN2 require?', u: 'Backside attack', correct: 'Backside attack', logic: 'SN2 is concerted and backside.' }
];
const results = [
  { id: 'Q1', res: 'LOSS' },
  { id: 'Q2', res: 'WIN' }
];

assert.equal(typeof ViaLogic.getVersion(), 'string');
const questionEval = ViaLogic.evaluateQuestion(questions[0], results[0]);
assert.equal(questionEval.questionId, 'Q1');
assert.equal(questionEval.domain, 'Physical Chemistry');
assert.equal(questionEval.isCorrect, false);
assert(questionEval.weaknessSignal.includes('Physical Chemistry'));

const session = Universe.buildSessionEnvelope('SES_UNIVERSE', questions, results, { createdAt: '2026-06-04T00:00:00.000Z' });
const sessionEval = ViaLogic.evaluateSession(session);
assert.equal(sessionEval.sessionId, 'SES_UNIVERSE');
assert.equal(sessionEval.totalQuestions, 2);
assert.equal(sessionEval.correctCount, 1);
assert.equal(sessionEval.wrongCount, 1);
assert(sessionEval.conceptGraph.nodes.length > 0);
assert(sessionEval.nextActions.length > 0);

const graph = ViaLogic.buildConceptGraph(session);
assert(graph.nodes.length > 0);
const svg = VisualEngine.serializeDiagram(graph);
assert(svg.includes('<svg') || svg.includes('Visual graph unavailable'));
const rendered = VisualEngine.renderSessionGraph(null, graph);
assert.equal(rendered.ok, true);
assert(rendered.content.includes('<svg') || rendered.content.includes('Visual graph unavailable'));

const enhanced = Universe.attachLogicToSession(session, ViaLogic, VisualEngine);
assert(enhanced.logic);
assert.equal(enhanced.logic.version, ViaLogic.getVersion());
assert(enhanced.logic.conceptGraph.nodes.length > 0);
assert(enhanced.visuals.diagrams.length > 0);

const kbText = knowledgeExporter.renderAsText(enhanced);
assert(kbText.includes('## Reasoning Layer'));
assert(kbText.includes('## Visual Map'));
const kbHtml = knowledgeExporter.renderAsHtml(enhanced);
assert(kbHtml.includes('Reasoning Layer'));
assert(kbHtml.includes('Visual Map'));

const zay = ZayFormat.buildV2Package(enhanced);
assert.equal(zay.format, 'zay');
assert.equal(zay.version, '2.0');
assert.equal(zay.source, 'alchemist');
assert.equal(zay.logic.engine, 'ViaLogic');
assert.equal(zay.visuals.engine, 'ZayvoraVisualEngine');
assert.equal(zay.exports.knowledgeBookReady, true);
assert(zay.meta);
assert(zay.content.blocks.length === 2);

const zayExport = new exporters.ZAYExporter().build(enhanced);
const parsed = JSON.parse(zayExport.content);
assert.equal(parsed.version, '2.0');
assert(parsed.logic);
assert(parsed.visuals);
assert(parsed.meta);
assert(parsed.content.blocks.length === 2);

const oldShape = { meta: { version: '1.0' }, content: { blocks: [] } };
assert.equal(ZayFormat.detectVersion(oldShape), '1.0');

const unavailable = Universe.evaluateSession({ sessionId: 'NO_ENGINE', questions: [] }, {});
assert.equal(unavailable.unavailable, true);
assert.equal(unavailable.message, 'Reasoning engine unavailable.');

console.log('universe integration tests passed');
