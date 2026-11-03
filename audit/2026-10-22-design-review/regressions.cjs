/* eslint-disable @typescript-eslint/no-require-imports */
// Execute the actual page handlers with synthetic state and mocked transport.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync('app/match/new/page.tsx', 'utf8');
const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map();
function walk(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(tree));
  ts.forEachChild(node, walk);
}
walk(tree);
function moduleExports(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  return exports;
}
const demo = moduleExports('app/lib/demo-materials.ts').getDemoMaterials('zh');
const { isMatchAnalysis } = moduleExports('app/lib/match-analysis.ts');
function harness(fetch) {
  const calls = [];
  const ctx = {
    console, AbortController, DOMException, isMatchAnalysis, fetch,
    window: { setTimeout, clearTimeout },
    resumeReady: true, jdReady: true, resumeState: 'ready', jdState: 'ready', analysisState: 'idle',
    resumeText: demo.resume, jdText: demo.jd, resumeMode: 'paste', looksLikeUrl: false, jdFile: null,
    language: 'zh', sampleConsent: false, t: new Proxy({}, { get: (_, key) => key }),
    analysis: demo.analysis, reviewDraft: 'My manually edited draft',
    analysisRequestRef: { current: null }, resumeReadVersion: { current: 0 }, jdReadVersion: { current: 0 },
    beginMatch() {}, scrollToTop() {}, trackEvent(name) { calls.push([name]); },
    fileExtension: (name) => name.split('.').at(-1), fileSizeBucket: () => 'small',
    ACCEPTED_RESUME_EXTENSIONS: new Set(['pdf', 'txt']),
    readDocumentFile: async () => '', recognizeDocumentFile: async () => { throw new Error('OCR_FAILED'); },
  };
  for (const name of new Set(source.match(/\bset[A-Z]\w+/g))) ctx[name] = (value) => {
    calls.push([name, value]);
    const stateKey = name[3].toLowerCase() + name.slice(4);
    ctx[stateKey] = value;
  };
  vm.createContext(ctx);
  for (const name of ['runAiAnalysis', 'cancelAnalysis', 'handleResumeFile', 'handleJdFile']) {
    const compiled = ts.transpileModule(`globalThis.${name} = ${functions.get(name)}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInContext(compiled, ctx);
  }
  return { ctx, calls };
}
const noDestructiveDraftWrites = (calls) => {
  for (const name of ['setReviewDraft', 'setReviewBaseline', 'setReviewBlocks', 'setFactConfirmations', 'setConfirmedDraft', 'setSuggestionDecisions']) assert.equal(calls.some(([called]) => called === name), false, name);
};
(async () => {
  let h = harness(async () => { throw new Error('offline'); });
  await h.ctx.runAiAnalysis();
  noDestructiveDraftWrites(h.calls);
  assert.equal(h.ctx.analysisState, 'error');
  assert.equal(h.ctx.reviewDraft, 'My manually edited draft');
  h = harness(async () => ({ ok: false, json: async () => ({ error: 'DEEPSEEK_INVALID_OUTPUT' }) }));
  await h.ctx.runAiAnalysis();
  noDestructiveDraftWrites(h.calls);
  assert.equal(h.ctx.analysisError, 'aiOutput');
  h = harness((_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')))));
  const pending = h.ctx.runAiAnalysis();
  h.ctx.cancelAnalysis();
  await pending;
  noDestructiveDraftWrites(h.calls);
  assert.equal(h.ctx.analysisState, 'idle');
  assert.equal(h.calls.some(([name]) => name === 'analysis_failed'), false);
  let finish;
  h = harness(() => new Promise((resolve) => { finish = resolve; }));
  const stale = h.ctx.runAiAnalysis();
  h.ctx.resumeReadVersion.current += 1;
  finish({ ok: true, json: async () => ({ analysis: demo.analysis }) });
  await stale;
  noDestructiveDraftWrites(h.calls);
  assert.equal(h.calls.some(([name]) => name === 'setAnalysis'), false);
  assert.equal(h.ctx.analysisState, 'idle');
  for (const name of ['handleResumeFile', 'handleJdFile']) {
    h = harness();
    await h.ctx[name]({ target: { files: [{ name: 'synthetic.pdf', size: 1000 }], value: 'synthetic.pdf' } });
    noDestructiveDraftWrites(h.calls);
    assert.equal(h.ctx.resumeText, demo.resume);
    assert.equal(h.ctx.jdText, demo.jd);
  }
  for (const language of ['zh', 'en']) {
    const example = moduleExports('app/lib/demo-materials.ts').getDemoMaterials(language);
    assert.ok(isMatchAnalysis(example.analysis));
    for (const item of example.analysis.suggestions) assert.equal(example.resume.slice(item.sourceStart, item.sourceEnd), item.originalText);
  }
  console.log('PASS: network failure, malformed report, cancellation, stale response, failed file replacement, bilingual demo evidence offsets');
})().catch((error) => { console.error(error); process.exitCode = 1; });
