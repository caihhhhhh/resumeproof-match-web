/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(path) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  return exports;
}
const { mergeReview } = load('app/lib/review-merge.ts');
const { auditFactChanges } = load('app/lib/fact-audit.ts');
const block = (text, kind = 'bullet') => ({ kind, text });
const before = [block('Original Name', 'name'), block('Old bullet')];
const current = [block('New experience', 'entry'), block('Old bullet'), block('Edited Name', 'name')];
let result = mergeReview(current, before, before);
assert.equal(JSON.stringify(result.blocks), JSON.stringify(current));
result = mergeReview(current, before, [before[0], block('Suggested bullet')]);
assert.equal(result.blocks[0].text, 'New experience');
assert.equal(result.blocks[1].text, 'Suggested bullet');
assert.equal(result.blocks[2].text, 'Edited Name');
assert.equal(result.conflicts, 0);
result = mergeReview([block('Manually edited bullet')], [block('Old bullet')], [block('Suggested bullet')]);
assert.equal(result.blocks[0].text, 'Manually edited bullet');
assert.equal(result.conflicts, 1);
assert.equal(mergeReview(current, before, []).conflicts, 1);
const original = '通过受众与素材 A/B Test 调整投放组合，使注册成本下降 28%。';
const revised = '基于受众与素材 A/B Test 调整投放组合，推动注册成本下降 28%。';
const audit = (a, b) => auditFactChanges(a, b, [block(a)], [block(b)]);
assert.equal(audit(original, revised).length, 0);
for (const changed of [revised.replace('28%', '40%'), revised.replace('下降', '上升'), revised.replace('注册成本', '入金成本'), revised.replace('推动', '未推动'), '独立负责' + revised]) assert.ok(audit(original, changed).length > 0, changed);
assert.ok(audit('注册成本下降 28%；入金成本下降 12%', '注册成本下降 12%；入金成本下降 28%').length > 0);
console.log('PASS: draft preservation, safe merge, conflicts, wording equivalence, metrics, negation and ownership');
