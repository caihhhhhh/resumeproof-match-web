/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(source) {
  const context = vm.createContext({exports:{}, console, crypto:require('node:crypto').webcrypto});
  vm.runInContext(ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText, context);
  return context;
}
const read = path => fs.readFileSync(path,'utf8');
const route = load(read('app/api/match/analyze/route.ts').replace(/^import .*;\r?\n/gm,''));
const page = read('app/match/new/page.tsx');
const parser = load(page.slice(page.indexOf('const REVIEW_SECTION'),page.indexOf('function escapeHtml')));
const document = read('app/components/resume-document.tsx');
const editor = read('app/components/resume-structured-editor.tsx');
const fields = load(document.slice(document.indexOf('export function splitResumeEntry')).replace('export ','') + '\n' + editor.slice(editor.indexOf('function groupBlocks'),editor.indexOf('export function ResumeStructuredEditor')));
const fact = load(read('app/lib/fact-audit.ts').replace(/^import .*;\r?\n/gm,''));
const blocks = parser.parseReviewBlocks('Test Person\n项目经历\n合作伙伴增长计划\n• 联合 12 家内容合作伙伴开展季度活动，推动 4 家长期合作。');
const group = fields.groupBlocks(blocks,'Header').find(g=>g.title==='项目经历');
const demoEvidence = [{requirement:'A',importance:'must',status:'gap',resumeEvidence:[],rationale:'none'}, {requirement:'B',importance:'must',status:'gap',resumeEvidence:[],rationale:'none'}, {requirement:'C',importance:'must',status:'gap',resumeEvidence:[],rationale:'none'}];
const results = {
  invisibleProject: {blocks, displayedCards:fields.entryCards(group,blocks).length},
  partialDateInput: fields.withEntryField({kind:'entry', text:'Example | Manager 2023.06 - Present'},'date','2').fields,
  missingShortFacts: route.resumeSources('姓名：林晨。\n学历：本科。\n语言：英语流利。\n工作经历\n'+ '负责市场活动并与跨职能团队协调推广素材上线。'),
  allGapReportAccepted:route.coreIsComplete({summary:'No relevant experience',strengths:[],gaps:['all'],hardRequirements:[],evidence:[]},demoEvidence),
  existingNumberReassigned:fact.exports.auditFactChanges('注册提升 28%，入金提升 12%。','注册提升 12%，入金提升 28%。',[],[]),
  leadingWhitespaceQuote:(()=>{const raw='  实际负责季度广告预算并使用数据分析优化素材和转化表现。';const source=route.resumeSources(raw)[0];return {source,quoteMatches:raw.slice(source.start,source.end)===source.text};})(),
  localBaseEventsAllowed:['base_resume_saved','base_resume_loaded','base_resume_cleared'].map(name=>({name,listed:read('app/lib/product-events.ts').includes("'"+name+"'")})),
};
console.log(JSON.stringify(results,null,2));
const assert = require('node:assert/strict');
assert.equal(results.invisibleProject.displayedCards, 1);
assert.equal(results.partialDateInput.date, '2');
assert.equal(results.partialDateInput.role, 'Manager');
assert.equal(results.allGapReportAccepted, true);
assert.ok(results.existingNumberReassigned.length > 0);
assert.equal(results.leadingWhitespaceQuote.quoteMatches, true);
assert.ok(results.localBaseEventsAllowed.every(item => item.listed));
assert.ok(results.missingShortFacts.some(item => item.text.includes('本科')));
console.log('PASS: 8 regression assertions');
