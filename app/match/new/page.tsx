'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { OptimizationReview, SuggestionDecision } from '../../components/optimization-review';
import { ResumeDocument, ResumeTemplate, ReviewBlock } from '../../components/resume-document';
import { SiteFooter } from '../../components/site-footer';
import { useLanguage } from '../../components/language-context';
import { EvidenceStatus, isMatchAnalysis, MatchAnalysis } from '../../lib/match-analysis';
import { identifyJobSource, sourceLabels } from '../../lib/job-source';
import { fileSizeBucket, trackEvent } from '../../lib/analytics';

type Screen = 'materials' | 'results' | 'review';
type InputMode = 'upload' | 'paste';
type ParseState = 'idle' | 'working' | 'ready' | 'paste_required' | 'error';
type ReviewMode = 'preview' | 'edit';

const ACCEPTED_RESUME_EXTENSIONS = new Set([
  'pdf', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp',
]);

const RESUME_FILE_ACCEPT = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg,image/webp';

type StoredDraft = {
  screen: Screen;
  resumeMode: InputMode;
  resumeText: string;
  jdEntry: string;
  jdUrl?: string;
  jdText: string;
  jdSource: string;
  jobTitle: string;
  jobCompany: string;
  jobLocation: string;
  analysis?: MatchAnalysis;
  suggestionDecisions?: Record<string, SuggestionDecision>;
  suggestionNotes?: Record<string, string>;
  reviewDraft?: string;
  confirmedDraft?: string;
  confirmedAt?: string;
  selectedTemplate?: ResumeTemplate;
  sampleReference?: string;
  step?: number;
};

const copy = {
  zh: {
    back: '返回首页', workspaceTitle: '先把两份材料放在一起。', workspaceBody: '文件优先在浏览器读取，并仅在当前标签页临时保留；开始分析后，简历与 JD 文字会发送至 AI 服务，扫描文件会使用视觉识别服务。',
    resumeReady: '简历已就绪', resumeWaiting: '等待简历', jdReady: 'JD 已就绪', jdWaiting: '等待 JD', localOnly: 'AI 语义分析',
    resumeTitle: '基础简历', resumeBody: '上传文件，或直接粘贴简历文字。', upload: '上传文件', paste: '粘贴文字', chooseFile: '选择一份简历文件',
    fileHint: '最大 8 MB · PDF、DOCX、TXT、MD、PNG、JPG 或 WebP', reading: '正在读取并识别内容…', uploaded: '上传成功', parsed: '内容已读取，请先核对文字再开始匹配',
    pendingOcr: '文件已上传，但没有识别到足够文字。请重新上传或粘贴文字。', replace: '重新选择', unsupported: '暂不支持此格式，请上传 PDF、DOCX、TXT、MD、PNG、JPG 或 WebP。', tooLarge: '文件超过 8 MB。',
    ocrNotConfigured: '视觉识别服务尚未配置，请联系网站管理员。', ocrAuth: '视觉识别服务授权异常，请联系网站管理员。', ocrRate: '视觉识别请求过于频繁，请稍后重试。', ocrTimeout: '视觉识别超时，请重新上传。', ocrPageLimit: '扫描 PDF 最多支持 6 页，请上传精简版简历。', ocrFailed: '没有可靠识别出简历文字，请重新上传清晰文件或粘贴文字。',
    resumePlaceholder: '粘贴完整简历内容……', reviewResume: '查看或编辑读取到的简历文字', restoredResume: '已恢复当前标签页中的简历文字',
    jdTitle: '目标岗位', jdBody: '同一个输入框可接收职位链接或完整 JD。', jdPlaceholder: '粘贴职位链接，或直接粘贴职责与任职要求……',
    parseLink: '读取职位链接', parsingLink: '正在读取…', detected: '已识别来源', linkParsed: '职位内容已读取，请检查原文。', pasteRequired: '该页面无法可靠自动读取，请把完整 JD 粘贴到输入框。', detailLinkRequired: '请粘贴具体职位详情页链接，而不是搜索结果或职位列表页。',
    invalidUrl: '请输入有效的 HTTPS 招聘链接。', reviewJd: '查看或编辑读取到的 JD 文字', characters: '字符', start: '开始 AI 分析', confirmAndAnalyze: '确认识别文字并分析', analyzing: 'AI 正在分析…', startHint: '点击后，已核对的简历与 JD 文字将发送给 DeepSeek 做语义分析；图片或扫描 PDF 仅在识别时发送给智谱。', sampleConsent: '允许保存自动脱敏后的简历与 JD 30 天，用于改进匹配质量（可选）', samplePrivacy: '了解数据处理', sampleSaved: '脱敏样本已保存 30 天', sampleDelete: '立即删除', sampleDeleted: '样本已删除',
    aiNotConfigured: '分析服务尚未配置，请联系网站管理员。', aiFailed: '分析服务暂时不可用，请稍后重试。', aiAuth: '分析服务授权异常，请联系网站管理员。', aiBalance: '分析服务额度不足，请联系网站管理员。', aiRate: '分析服务请求过于频繁，请稍后重试。', siteRate: '当前设备请求较频繁，请稍后再试。', aiOutput: '完整报告未生成成功，请重新分析。系统不会展示缺少评分、证据或建议的半成品。', aiTimeout: '分析超过 60 秒仍未响应，请重新分析。',
    resultBack: '返回修改材料', matchTitle: '证据先于分数。', matchBody: 'AI 会识别同义表达和可迁移经验，但每项匹配都必须引用真实的简历原句。结果不代表招聘决定。',
    scoreLabel: '证据匹配度', gradeA: '值得投递', gradeB: '有条件投递', gradeC: '证据不足', scoreMethod: '必须项、重要项、加分项分别按 3、2、1 权重计算；存在关键必须项缺口时不会标记为“值得投递”。', mustCoverage: '必须项覆盖', importantCoverage: '重要项覆盖', bonusCoverage: '加分项覆盖', verifiedCoverage: '原句核验率', mustNote: '对最终判断影响最大', importantNote: '影响岗位胜任度', bonusNote: '不满足通常不构成淘汰', verifiedNote: '匹配项中可核对简历原句的比例',
    evidenceTitle: 'JD 要求与简历证据', evidenceBody: '先看原句，再看简历中是否有语义对应且可核对的证据。',
    statusStrong: '已证实', statusPartial: '部分证据', statusGap: '尚无证据', noMatchedTerms: '暂无可核对原句', coveredTitle: '已有优势', missingTitle: '优先补证',
    missingAdvice: '只补充真实做过的项目、动作或结果；没有经历就保留为差距。', metricSignals: '份量化结果已识别', localRules: 'AI 语义诊断 · 原句证据校验', evidenceQuote: '简历证据', whyMatch: '判断依据',
    reviewEyebrow: '完整文字审核稿', reviewTitle: '读顺全文，选好版式再导出。', reviewBody: '这里只合并你明确采用的建议。你可以继续编辑全文和切换版式；确认前不会创建任何文件。', reviewChanges: '本轮已采用修改', reviewOriginal: '原文', reviewFinal: '审核稿', reviewCharacters: '字符', reviewWarning: '请重点核对公司、职位、日期、数字和专有名词。确认文字稿后，本页会立即开放 HTML 与 PDF 导出。', reviewBack: '返回建议审核', reviewNext: '确认并锁定文字稿', reviewPreview: '排版预览', reviewEdit: '编辑文字', reviewPreviewHint: '预览只调整视觉层级与空白，不改变审核稿内容。', reviewNoChanges: '本轮没有采用 AI 改写，当前显示原始简历全文。', reviewCanvas: '文字排版预览',
    confirmedEyebrow: '文字审核已完成', confirmedTitle: '这份文字稿已锁定。', confirmedBody: '系统保存了当前全文快照。返回修改任何文字后，本次确认会自动失效；此操作不会生成 HTML、PDF 或其他文件。', confirmedSnapshot: '已确认全文', confirmedChanges: '采用修改', confirmedTime: '确认时间', confirmedEdit: '返回继续编辑', confirmedNext: '选择简历模板', confirmedNextHint: '先选择版式，不会立即生成文件。',
    templateEyebrow: '选择版式', templateTitle: '内容不变，只调整阅读节奏。', templateBody: '三个模板共用已确认文字。切换模板不会重写内容，也不会影响匹配报告。', templateBalanced: '均衡单栏', templateBalancedBody: '清晰分区与舒适行距，适合大多数岗位。', templateCompact: '紧凑单栏', templateCompactBody: '缩小段间距，适合经历较多或希望控制页数的简历。', templateMinimal: '极简单栏', templateMinimalBody: '弱化颜色和边框，让公司、岗位与成果成为重点。', templateSelected: '已选择', templateBack: '返回确认记录', templateContinue: '进入最终预览',
    exportEyebrow: '最终预览', exportTitle: '下载前，再看一遍成品。', exportBody: '这里展示最终版式。HTML 可继续编辑；打印时在系统窗口选择“另存为 PDF”。', exportBack: '返回选择模板', exportDownload: '下载 HTML', exportPrint: '打印 / 保存 PDF', exportPrintHint: '打印建议：A4、默认边距、背景图形开启。', exportTemplate: '当前模板', exportReady: '文字与版式已准备完成',
  },
  en: {
    back: 'Back home', workspaceTitle: 'Put both sources in one place.', workspaceBody: 'Files are read in your browser and kept only for this tab. Resume and JD text is sent to the AI service after you start analysis; scanned files use visual recognition.',
    resumeReady: 'Resume ready', resumeWaiting: 'Resume needed', jdReady: 'JD ready', jdWaiting: 'JD needed', localOnly: 'AI semantic analysis',
    resumeTitle: 'Base resume', resumeBody: 'Upload a file or paste the complete resume.', upload: 'Upload file', paste: 'Paste text', chooseFile: 'Choose a resume file',
    fileHint: 'Up to 8 MB · PDF, DOCX, TXT, MD, PNG, JPG, or WebP', reading: 'Reading and recognizing content…', uploaded: 'Upload successful', parsed: 'Content extracted. Review the text before matching.',
    pendingOcr: 'The file uploaded, but not enough text was recognized. Upload it again or paste the text.', replace: 'Choose another', unsupported: 'Upload a PDF, DOCX, TXT, MD, PNG, JPG, or WebP file.', tooLarge: 'The file is larger than 8 MB.',
    ocrNotConfigured: 'Visual recognition is not configured. Contact the site administrator.', ocrAuth: 'Visual recognition has an authorization issue. Contact the site administrator.', ocrRate: 'Visual recognition is rate-limited. Try again shortly.', ocrTimeout: 'Visual recognition timed out. Upload the file again.', ocrPageLimit: 'Scanned PDFs can contain up to 6 pages. Upload a shorter resume.', ocrFailed: 'The resume text could not be read reliably. Upload a clearer file or paste the text.',
    resumePlaceholder: 'Paste the complete resume here…', reviewResume: 'Review or edit the extracted resume text', restoredResume: 'Restored text from this browser tab',
    jdTitle: 'Target role', jdBody: 'The same field accepts a job link or the complete JD.', jdPlaceholder: 'Paste a job link or the complete responsibilities and requirements…',
    parseLink: 'Read job link', parsingLink: 'Reading…', detected: 'Detected source', linkParsed: 'Job content extracted. Review the source text.', pasteRequired: 'This page cannot be read reliably. Paste the complete JD into the field.', detailLinkRequired: 'Paste a specific job-detail URL rather than a search or job-listing page.',
    invalidUrl: 'Enter a valid HTTPS job posting URL.', reviewJd: 'Review or edit the extracted JD text', characters: 'characters', start: 'Start AI analysis', confirmAndAnalyze: 'Confirm extracted text and analyze', analyzing: 'AI is analyzing…', startHint: 'After you click, reviewed resume and JD text is sent to DeepSeek for semantic analysis. Images or scanned PDFs are sent to Zhipu only for recognition.', sampleConsent: 'Save an automatically redacted resume and JD for 30 days to improve matching (optional)', samplePrivacy: 'How data is handled', sampleSaved: 'Redacted sample saved for 30 days', sampleDelete: 'Delete now', sampleDeleted: 'Sample deleted',
    aiNotConfigured: 'The analysis service is not configured. Contact the site administrator.', aiFailed: 'The analysis service is temporarily unavailable. Please try again.', aiAuth: 'The analysis service has an authorization issue. Contact the site administrator.', aiBalance: 'The analysis service has insufficient quota. Contact the site administrator.', aiRate: 'The analysis service is rate-limiting requests. Try again shortly.', siteRate: 'This device has made too many requests. Please try again shortly.', aiOutput: 'The complete report could not be generated. Please retry; incomplete scores, evidence, or suggestions will never be shown.', aiTimeout: 'Analysis did not finish within 60 seconds. Please run it again.',
    resultBack: 'Back to materials', matchTitle: 'Evidence before scores.', matchBody: 'AI can recognize equivalent wording and transferable experience, but every match must cite a real resume excerpt. Results are not hiring decisions.',
    scoreLabel: 'Evidence match', gradeA: 'Pursue', gradeB: 'Conditional fit', gradeC: 'Evidence gap', scoreMethod: 'Must-have, important, and bonus requirements use 3:2:1 weights. A critical must-have gap prevents a “Pursue” recommendation.', mustCoverage: 'Must-have coverage', importantCoverage: 'Important coverage', bonusCoverage: 'Bonus coverage', verifiedCoverage: 'Source verification', mustNote: 'Largest impact on the final score', importantNote: 'Material to role readiness', bonusNote: 'Usually not disqualifying', verifiedNote: 'Share of mappings backed by exact resume excerpts',
    evidenceTitle: 'JD requirements and resume evidence', evidenceBody: 'Start from each requirement, then verify whether the resume contains semantically relevant source evidence.',
    statusStrong: 'Supported', statusPartial: 'Partial evidence', statusGap: 'No evidence yet', noMatchedTerms: 'No verified excerpt yet', coveredTitle: 'Current strengths', missingTitle: 'Evidence to add first',
    missingAdvice: 'Add only projects, actions, or outcomes you actually have. If the experience does not exist, keep it as a gap.', metricSignals: 'quantified results detected', localRules: 'AI semantic diagnostic · source evidence verified', evidenceQuote: 'Resume evidence', whyMatch: 'Reasoning',
    reviewEyebrow: 'Full text review', reviewTitle: 'Read it through, choose a layout, then export.', reviewBody: 'Only suggestions you explicitly adopted are merged here. Keep editing or switch layouts; no file is created before confirmation.', reviewChanges: 'Adopted changes', reviewOriginal: 'Original', reviewFinal: 'Review draft', reviewCharacters: 'characters', reviewWarning: 'Verify company names, titles, dates, metrics, and proper nouns. Confirming the text unlocks HTML and PDF export on this page.', reviewBack: 'Back to suggestions', reviewNext: 'Confirm and lock text', reviewPreview: 'Layout preview', reviewEdit: 'Edit text', reviewPreviewHint: 'The preview changes hierarchy and spacing only. Draft content stays unchanged.', reviewNoChanges: 'No AI rewrite was adopted. The original resume is shown in full.', reviewCanvas: 'Text layout preview',
    confirmedEyebrow: 'Text review complete', confirmedTitle: 'This draft is now locked.', confirmedBody: 'The complete text snapshot has been saved. Editing any text will invalidate this confirmation. No HTML, PDF, or other file is created here.', confirmedSnapshot: 'Confirmed text', confirmedChanges: 'adopted changes', confirmedTime: 'Confirmed at', confirmedEdit: 'Return to edit', confirmedNext: 'Choose a template', confirmedNextHint: 'Choose the layout first. No file is generated yet.',
    templateEyebrow: 'Choose a layout', templateTitle: 'Keep the content. Change the reading rhythm.', templateBody: 'All three templates use the confirmed text. Switching layouts does not rewrite the resume or change the match report.', templateBalanced: 'Balanced single column', templateBalancedBody: 'Clear sections and comfortable spacing for most roles.', templateCompact: 'Compact single column', templateCompactBody: 'Tighter spacing for longer resumes or stricter page limits.', templateMinimal: 'Minimal single column', templateMinimalBody: 'Less color and fewer rules, with focus on roles and outcomes.', templateSelected: 'Selected', templateBack: 'Back to confirmation', templateContinue: 'Open final preview',
    exportEyebrow: 'Final preview', exportTitle: 'One last look before download.', exportBody: 'This is the final layout. The HTML remains editable; use the system print dialog to save a PDF.', exportBack: 'Back to templates', exportDownload: 'Download HTML', exportPrint: 'Print / save PDF', exportPrintHint: 'Recommended print settings: A4, default margins, background graphics on.', exportTemplate: 'Current template', exportReady: 'Text and layout are ready',
  },
} as const;

function fileExtension(name: string) { return name.toLowerCase().split('.').pop() ?? ''; }

function resumeFileTag(file: File | null) {
  if (!file) return 'FILE';
  const extension = fileExtension(file.name);
  if (['png', 'jpg', 'jpeg', 'webp'].includes(extension)) return 'IMG';
  if (['txt', 'md'].includes(extension)) return 'TXT';
  if (extension === 'docx') return 'DOC';
  return extension.toUpperCase() || 'FILE';
}

const REVIEW_SECTION = /^(个人总结|职业概述|个人简介|工作经历|正式工作经历|实习经历|项目经历|AI 项目|教育背景|教育经历|核心技能|专业技能|技能|证书|语言能力|summary|professional summary|profile|experience|work experience|professional experience|internships?|projects?|education|skills?|certifications?|languages?)[:：]?$/i;
const REVIEW_DATE_RANGE = /(?:19|20)\d{2}[./]\d{1,2}\s*[-–—]\s*(?:至今|present|(?:19|20)\d{2}[./]\d{1,2})/i;
const REVIEW_CONTACT = /@|(?:\+?\d[\d\s()-]{7,}\d)|(?:linkedin\.com|github\.com|https?:\/\/)/i;
const REVIEW_BULLET = /^(?:[•·▪◦]|[-*]\s)/;
const REVIEW_SKILL_LABEL = /^(市场执行|广告平台|数据分析|AI 与自动化|产品与 GTM|协作能力|marketing execution|ad platforms?|data analysis|AI & automation|product & GTM|collaboration)$/i;

function joinPreviewText(left: string, right: string) {
  const needsSpace = /[a-z0-9,.;:)]$/i.test(left) && /^[a-z0-9([]/i.test(right);
  return `${left}${needsSpace ? ' ' : ''}${right}`;
}

function compactComparableText(value: string) {
  return value.replace(/\s+/g, '').toLowerCase();
}

function parseReviewBlocks(value: string): ReviewBlock[] {
  const previewValue = value
    .replace(/Will Shen\s+International Growth Marketing\s*[·|]?\s*GTM Execution/gi, '\n')
    .replace(/实习经历（续）/g, '\n')
    .replace(/(AI 项目|教育经历|专业技能)/g, '\n$1\n')
    .replace(/(AI 辅助广告分析｜个人项目)(?=使用)/g, '$1\n')
    .replace(/(ClassQuest 课堂互动工具｜AI 辅助产品项目)(?=使用)/g, '$1\n')
    .replace(/(市场执行|广告平台|数据分析|AI 与自动化|产品与 GTM|协作能力)(?=\S)/g, '\n$1\n');
  const lines = previewValue.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const blocks: ReviewBlock[] = [];
  let currentSection = '';
  for (const [index, line] of lines.entries()) {
    let kind: ReviewBlock['kind'] = 'body';
    if (REVIEW_SECTION.test(line)) {
      kind = 'section';
      currentSection = line.replace(/[:：]$/, '');
    }
    else if (REVIEW_BULLET.test(line)) kind = 'bullet';
    else if ((REVIEW_DATE_RANGE.test(line) || (/｜/.test(line) && /(?:19|20)\d{2}[./]\d{1,2}/.test(line))) && line.length < 180) kind = 'entry';
    else if (currentSection === 'AI 项目' && /｜/.test(line) && line.length < 120) kind = 'entry';
    else if (/^(教育经历|education)$/i.test(currentSection) && /大学|university|college/i.test(line) && line.length < 160) kind = 'entry';
    else if (/^(专业技能|核心技能|技能|skills?)$/i.test(currentSection) && REVIEW_SKILL_LABEL.test(line)) kind = 'entry';
    else if (REVIEW_CONTACT.test(line) && line.length < 180) kind = 'contact';
    else if (index === 0 && line.length < 80) kind = 'name';
    else if (/^(正式工作经历|实习经历|工作经历|professional experience|work experience|experience|internships?)$/i.test(currentSection)) kind = 'bullet';

    const previous = blocks.at(-1);
    if (kind === 'body' && previous?.kind === 'body' && !/[。！？.!?]$/.test(previous.text)) previous.text = joinPreviewText(previous.text, line);
    else if (kind === 'bullet' && previous?.kind === 'bullet' && !/[。！？.!?]$/.test(previous.text)) previous.text = joinPreviewText(previous.text, line);
    else blocks.push({ kind, text: line });
  }
  return blocks;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}

function standaloneResumeHtml(blocks: ReviewBlock[], template: ResumeTemplate, language: 'zh' | 'en') {
  const body = blocks.map((block) => {
    const text = escapeHtml(block.text.replace(/[:：]$/, ''));
    if (block.kind === 'name') return `<h1>${text}</h1>`;
    if (block.kind === 'section') return `<h2>${text}</h2>`;
    if (block.kind === 'entry') return `<h3>${text}</h3>`;
    return `<p class="resume-${block.kind}">${text}</p>`;
  }).join('\n');
  return `<!doctype html>
<html lang="${language === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resume</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; background: #eef1f6; color: #20242b; font-family: Arial, "Microsoft YaHei", "PingFang SC", sans-serif; }
.resume { width: 210mm; min-height: 297mm; margin: 18px auto; padding: 17mm 18mm 20mm; background: #fdfdfc; box-shadow: 0 24px 70px rgba(30,48,79,.12); }
h1 { margin: 0; color: #171b22; font-size: 29px; line-height: 1.12; }
h2 { margin: 26px 0 11px; padding-bottom: 6px; border-bottom: 1px solid #315acb; color: #315acb; font-size: 12px; line-height: 1.35; }
h3 { margin: 18px 0 8px; color: #202630; font-size: 11.8px; line-height: 1.5; }
h2 + h3 { margin-top: 12px; }
p { margin: 0 0 7px; font-size: 10.8px; line-height: 1.62; }
.resume-contact { margin: 8px 0 17px; color: #596272; font-size: 9.5px; }
.resume-bullet { display: grid; grid-template-columns: 9px minmax(0,1fr); margin-bottom: 5px; line-height: 1.58; }
.resume-bullet::before { content: "•"; color: #647084; font-size: 8px; line-height: 2.05; }
.template-compact { padding: 13mm 16mm 16mm; }
.template-compact h2 { margin-top: 19px; }
.template-compact h3 { margin: 13px 0 5px; }
.template-compact p { margin-bottom: 4px; font-size: 10.2px; line-height: 1.5; }
.template-minimal h2 { border-color: #aeb5c0; color: #20242b; letter-spacing: .02em; }
.template-minimal h3 { font-size: 12px; }
.template-minimal .resume-bullet::before { color: #20242b; }
@media print { body { background: white; } .resume { margin: 0; box-shadow: none; } }
</style>
</head>
<body><main class="resume template-${template}">${body}</main></body>
</html>`;
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => { timeoutId = setTimeout(() => reject(new Error('READ_TIMEOUT')), milliseconds); })]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function readResumeFile(file: File): Promise<string> {
  const extension = fileExtension(file.name);
  if (extension === 'pdf') {
    const { extractText } = await import('unpdf');
    const result = await withTimeout(extractText(new Uint8Array(await file.arrayBuffer()), { mergePages: true }), 12_000);
    return result.text.trim();
  }
  if (extension === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value.trim();
  }
  if (['txt', 'md'].includes(extension)) return (await file.text()).trim();
  return '';
}

async function fileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('INVALID_IMAGE'));
    reader.onerror = () => reject(reader.error ?? new Error('READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

async function imageAsOcrDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1_600;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return fileAsDataUrl(file);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.9);
}

async function prepareOcrImages(file: File): Promise<string[]> {
  const extension = fileExtension(file.name);
  if (['png', 'jpg', 'jpeg', 'webp'].includes(extension)) return [await imageAsOcrDataUrl(file)];
  if (extension !== 'pdf') return [];

  const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  if (pdf.numPages > 6) throw new Error('OCR_PAGE_LIMIT');
  const pageCount = pdf.numPages;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const image = await renderPageAsImage(pdf, pageNumber, { width: 1500, toDataURL: true });
    if (typeof image === 'string') pages.push(image);
  }
  return pages;
}

async function recognizeResumeFile(file: File, language: 'zh' | 'en'): Promise<string> {
  const images = await withTimeout(prepareOcrImages(file), 30_000);
  if (!images.length) return '';
  const response = await fetch('/api/resume/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images, filename: file.name, language }),
    signal: AbortSignal.timeout(75_000),
  });
  const data = await response.json().catch(() => ({})) as { text?: string; error?: string };
  if (!response.ok || !data.text) throw new Error(data.error || 'OCR_FAILED');
  return data.text.trim();
}

export default function NewMatchPage() {
  const { language, toggleLanguage } = useLanguage();
  const t = copy[language];
  const [draftRestored, setDraftRestored] = useState(false);
  const [screen, setScreen] = useState<Screen>('materials');
  const [resumeMode, setResumeMode] = useState<InputMode>('upload');
  const [resumeName, setResumeName] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [resumeNeedsReview, setResumeNeedsReview] = useState(false);
  const [resumeState, setResumeState] = useState<ParseState>('idle');
  const [resumeError, setResumeError] = useState('');
  const [jdEntry, setJdEntry] = useState('');
  const [jdText, setJdText] = useState('');
  const [jdSource, setJdSource] = useState('');
  const [jdState, setJdState] = useState<ParseState>('idle');
  const [jdMessage, setJdMessage] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobCompany, setJobCompany] = useState('');
  const [jobLocation, setJobLocation] = useState('');
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [analysisState, setAnalysisState] = useState<'idle' | 'working' | 'error'>('idle');
  const [analysisError, setAnalysisError] = useState('');
  const [analysisSeconds, setAnalysisSeconds] = useState(0);
  const [suggestionDecisions, setSuggestionDecisions] = useState<Record<string, SuggestionDecision>>({});
  const [suggestionNotes, setSuggestionNotes] = useState<Record<string, string>>({});
  const [reviewDraft, setReviewDraft] = useState('');
  const [reviewMode, setReviewMode] = useState<ReviewMode>('preview');
  const [confirmedDraft, setConfirmedDraft] = useState('');
  const [confirmedAt, setConfirmedAt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ResumeTemplate>('balanced');
  const [sampleConsent, setSampleConsent] = useState(false);
  const [sampleReference, setSampleReference] = useState('');
  const [sampleDeleted, setSampleDeleted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const legacy = window.localStorage.getItem('resumematch-current-draft');
        const raw = window.sessionStorage.getItem('resumematch-current-draft') ?? legacy;
        if (legacy) {
          window.sessionStorage.setItem('resumematch-current-draft', legacy);
          window.localStorage.removeItem('resumematch-current-draft');
        }
        if (raw) {
          const draft = JSON.parse(raw) as Partial<StoredDraft>;
          const savedResumeText = typeof draft.resumeText === 'string' ? draft.resumeText : '';
          const savedJdText = typeof draft.jdText === 'string' ? draft.jdText : '';
          setResumeMode(draft.resumeMode === 'paste' ? 'paste' : 'upload');
          setResumeText(savedResumeText);
          if (savedResumeText.length >= 80) setResumeState('ready');
          const savedJdEntry = typeof draft.jdEntry === 'string'
            ? draft.jdEntry
            : typeof draft.jdUrl === 'string' && draft.jdUrl
              ? draft.jdUrl
              : savedJdText;
          setJdEntry(savedJdEntry);
          setJdText(savedJdText);
          setJdSource(typeof draft.jdSource === 'string' ? draft.jdSource : '');
          setJobTitle(typeof draft.jobTitle === 'string' ? draft.jobTitle : '');
          setJobCompany(typeof draft.jobCompany === 'string' ? draft.jobCompany : '');
          setJobLocation(typeof draft.jobLocation === 'string' ? draft.jobLocation : '');
          if (isMatchAnalysis(draft.analysis)) {
            setAnalysis(draft.analysis);
            if (draft.suggestionDecisions && typeof draft.suggestionDecisions === 'object') setSuggestionDecisions(draft.suggestionDecisions);
            if (draft.suggestionNotes && typeof draft.suggestionNotes === 'object') setSuggestionNotes(draft.suggestionNotes);
            if (typeof draft.reviewDraft === 'string') setReviewDraft(draft.reviewDraft);
            if (typeof draft.confirmedDraft === 'string') setConfirmedDraft(draft.confirmedDraft);
            if (typeof draft.confirmedAt === 'string') setConfirmedAt(draft.confirmedAt);
            if (typeof draft.sampleReference === 'string') setSampleReference(draft.sampleReference);
            if (draft.selectedTemplate === 'balanced' || draft.selectedTemplate === 'compact' || draft.selectedTemplate === 'minimal') setSelectedTemplate(draft.selectedTemplate);
            const savedScreen = String(draft.screen ?? '');
            if (['review', 'confirmed', 'template', 'export'].includes(savedScreen) && typeof draft.reviewDraft === 'string' && draft.reviewDraft.length >= 80) setScreen('review');
            else if ((draft.screen === 'results' || draft.step === 4) && savedResumeText.length >= 80 && savedJdText.length >= 80) setScreen('results');
          }
        }
      } catch {
        window.sessionStorage.removeItem('resumematch-current-draft');
        window.localStorage.removeItem('resumematch-current-draft');
      } finally { setDraftRestored(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!draftRestored) return;
    const draft: StoredDraft = { screen, resumeMode, resumeText, jdEntry, jdText, jdSource, jobTitle, jobCompany, jobLocation, analysis: analysis ?? undefined, suggestionDecisions, suggestionNotes, reviewDraft, confirmedDraft, confirmedAt, selectedTemplate, sampleReference };
    try { window.sessionStorage.setItem('resumematch-current-draft', JSON.stringify(draft)); } catch { /* Keep the current tab usable if browser storage is unavailable. */ }
  }, [draftRestored, screen, resumeMode, resumeText, jdEntry, jdText, jdSource, jobTitle, jobCompany, jobLocation, analysis, suggestionDecisions, suggestionNotes, reviewDraft, confirmedDraft, confirmedAt, selectedTemplate, sampleReference]);

  useEffect(() => {
    if (analysisState !== 'working') return;
    const timer = window.setInterval(() => setAnalysisSeconds((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [analysisState]);

  async function handleResumeFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setResumeError('');
    if (!ACCEPTED_RESUME_EXTENSIONS.has(fileExtension(file.name))) {
      setResumeFile(null); setResumeName(''); setResumeState('error'); setResumeError(t.unsupported); event.target.value = ''; return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setResumeFile(null); setResumeName(''); setResumeState('error'); setResumeError(t.tooLarge); event.target.value = ''; return;
    }
    setResumeFile(file); setResumeName(file.name); setResumeText(''); setResumeState('working'); setAnalysis(null); setSuggestionDecisions({}); setSuggestionNotes({}); setReviewDraft(''); setConfirmedDraft(''); setConfirmedAt('');
    trackEvent('resume_upload_started', { file_type: fileExtension(file.name), file_size: fileSizeBucket(file.size) });
    try {
      const localText = await readResumeFile(file).catch(() => '');
      const usedOcr = localText.length < 80;
      const text = usedOcr ? await recognizeResumeFile(file, language) : localText;
      setResumeText(text.length >= 80 ? text : '');
      setResumeNeedsReview(usedOcr && text.length >= 80);
      if (text.length >= 80) {
        setResumeState('ready');
        trackEvent('resume_upload_completed', { file_type: fileExtension(file.name), extraction: usedOcr ? 'ocr' : 'local' });
      } else {
        setResumeState('error'); setResumeError(t.ocrFailed);
        trackEvent('resume_upload_failed', { reason: 'insufficient_text', extraction: usedOcr ? 'ocr' : 'local' });
      }
    } catch (error) {
      setResumeText('');
      setResumeNeedsReview(false);
      const code = error instanceof Error ? error.message : 'OCR_FAILED';
      const message = code === 'OCR_NOT_CONFIGURED' ? t.ocrNotConfigured
        : code === 'OCR_AUTH' ? t.ocrAuth
          : code === 'OCR_RATE_LIMIT' ? t.ocrRate
            : code === 'SITE_RATE_LIMIT' ? t.siteRate
            : code === 'OCR_TIMEOUT' || code === 'READ_TIMEOUT' ? t.ocrTimeout
              : code === 'OCR_PAGE_LIMIT' ? t.ocrPageLimit
              : t.ocrFailed;
      setResumeError(message);
      setResumeState('error');
      trackEvent('resume_upload_failed', { reason: code.slice(0, 36), file_type: fileExtension(file.name) });
    }
  }

  function handleJdEntry(value: string) {
    setJdEntry(value); setJdMessage(''); setJdSource(''); setJobTitle(''); setJobCompany(''); setJobLocation(''); setAnalysis(null); setSuggestionDecisions({}); setSuggestionNotes({}); setReviewDraft(''); setConfirmedDraft(''); setConfirmedAt('');
    if (/^https?:\/\//i.test(value.trim())) { setJdText(''); setJdState('idle'); }
    else { setJdText(value); setJdState(value.trim().length >= 80 ? 'ready' : 'idle'); }
  }

  function changeResumeText(value: string) {
    setResumeText(value); setAnalysis(null); setSuggestionDecisions({}); setSuggestionNotes({}); setReviewDraft(''); setConfirmedDraft(''); setConfirmedAt('');
  }

  function changeParsedJd(value: string) {
    setJdText(value); setAnalysis(null); setSuggestionDecisions({}); setSuggestionNotes({}); setReviewDraft(''); setConfirmedDraft(''); setConfirmedAt('');
  }

  async function parseJobLink() {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(jdEntry.trim());
      if (parsedUrl.protocol !== 'https:') throw new Error('HTTPS_ONLY');
    } catch {
      setJdState('error'); setJdMessage(t.invalidUrl); return;
    }
    const source = sourceLabels[identifyJobSource(parsedUrl.toString())];
    setJdSource(source); setJdState('working'); setJdMessage('');
    trackEvent('jd_link_parse_started', { source });
    try {
      const response = await fetch('/api/jd/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: parsedUrl.toString() }) });
      const data = (await response.json()) as { status?: string; error?: string; code?: string; sourceLabel?: string; canonicalUrl?: string; jdText?: string; title?: string; company?: string; location?: string };
      if (data.sourceLabel) setJdSource(data.sourceLabel);
      if (data.canonicalUrl) setJdEntry(data.canonicalUrl);
      if (data.status === 'success' && data.jdText) {
        setJdText(data.jdText); setJobTitle(data.title ?? ''); setJobCompany(data.company ?? ''); setJobLocation(data.location ?? ''); setJdState('ready'); setJdMessage(t.linkParsed);
        trackEvent('jd_link_parse_completed', { source: data.sourceLabel || source });
      } else if ((data.error || data.code) === 'SITE_RATE_LIMIT') { setJdState('error'); setJdMessage(t.siteRate); }
      else if (data.code === 'JOB_DETAIL_REQUIRED') { setJdState('paste_required'); setJdMessage(t.detailLinkRequired); trackEvent('jd_link_parse_failed', { reason: data.code, source }); }
      else { setJdState('paste_required'); setJdMessage(t.pasteRequired); trackEvent('jd_link_parse_failed', { reason: data.error || data.code || 'paste_required', source }); }
    } catch { setJdState('paste_required'); setJdMessage(t.pasteRequired); trackEvent('jd_link_parse_failed', { reason: 'network_error', source }); }
  }

  const resumeReady = resumeText.trim().length >= 80;
  const jdReady = jdText.trim().length >= 80;
  const looksLikeUrl = /^https?:\/\//i.test(jdEntry.trim());
  const statusCopy: Record<EvidenceStatus, string> = { strong: t.statusStrong, partial: t.statusPartial, gap: t.statusGap };
  const gradeCopy = analysis ? { A: t.gradeA, B: t.gradeB, C: t.gradeC }[analysis.grade] : '';
  const adoptedSuggestions = analysis?.suggestions.filter((item) => suggestionDecisions[item.id] === 'accepted') ?? [];
  const reviewPreviewBlocks = useMemo(() => parseReviewBlocks(reviewDraft), [reviewDraft]);
  const confirmedPreviewBlocks = useMemo(() => parseReviewBlocks(confirmedDraft), [confirmedDraft]);
  const templateOptions: Array<{ id: ResumeTemplate; name: string; description: string }> = [
    { id: 'balanced', name: t.templateBalanced, description: t.templateBalancedBody },
    { id: 'compact', name: t.templateCompact, description: t.templateCompactBody },
    { id: 'minimal', name: t.templateMinimal, description: t.templateMinimalBody },
  ];
  const draftConfirmed = confirmedDraft.length >= 80 && confirmedDraft === reviewDraft;

  function buildTextReview() {
    if (!analysis) return;
    const candidates = adoptedSuggestions.map((suggestion) => {
      const start = suggestion.sourceStart;
      const revised = (suggestionNotes[suggestion.id] ?? suggestion.revisedText).trim();
      return {
        start,
        end: suggestion.sourceEnd,
        original: suggestion.originalText,
        revised,
        sourceStillMatches: resumeText.slice(start, suggestion.sourceEnd) === suggestion.originalText,
      };
    }).filter((item) => item.start >= 0 && item.revised && item.sourceStillMatches && compactComparableText(item.original) !== compactComparableText(item.revised)).sort((a, b) => b.original.length - a.original.length);
    const replacements = candidates.reduce<typeof candidates>((selected, candidate) => {
      const overlaps = selected.some((item) => candidate.start < item.end && candidate.end > item.start);
      if (!overlaps) selected.push(candidate);
      return selected;
    }, []).sort((a, b) => b.start - a.start);
    let merged = resumeText;
    for (const item of replacements) merged = `${merged.slice(0, item.start)}${item.revised}${merged.slice(item.end)}`;
    setReviewDraft(merged);
    setConfirmedDraft('');
    setConfirmedAt('');
    setReviewMode('preview');
    setScreen('review');
    trackEvent('review_draft_built', { adopted_suggestions: adoptedSuggestions.length, template: selectedTemplate });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function confirmTextDraft() {
    if (reviewDraft.trim().length < 80) return;
    setConfirmedDraft(reviewDraft);
    setConfirmedAt(new Date().toISOString());
    setReviewMode('preview');
    trackEvent('review_draft_confirmed', { adopted_suggestions: adoptedSuggestions.length, template: selectedTemplate });
  }

  function editReviewDraft(value: string) {
    setReviewDraft(value);
    setConfirmedDraft('');
    setConfirmedAt('');
  }

  function resumeFileBase() {
    const preferred = [jobCompany, jobTitle].filter(Boolean).join('_') || 'optimized_resume';
    return preferred.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').replace(/\s+/g, '_').slice(0, 90);
  }

  function downloadResumeHtml() {
    if (!confirmedDraft) return;
    const html = standaloneResumeHtml(confirmedPreviewBlocks, selectedTemplate, language);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${resumeFileBase()}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    trackEvent('resume_exported', { format: 'html', template: selectedTemplate });
  }

  function printResume() {
    const previousTitle = document.title;
    document.title = resumeFileBase();
    window.print();
    document.title = previousTitle;
    trackEvent('resume_exported', { format: 'print_pdf', template: selectedTemplate });
  }

  async function runAiAnalysis() {
    if (!resumeReady || !jdReady || analysisState === 'working') return;
    setAnalysisSeconds(0); setAnalysisState('working'); setAnalysisError(''); setSuggestionDecisions({}); setSuggestionNotes({}); setReviewDraft(''); setConfirmedDraft(''); setConfirmedAt('');
    trackEvent('analysis_started', { resume_method: resumeMode, jd_method: looksLikeUrl ? 'url' : 'paste', language });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 70_000);
    try {
      const response = await fetch('/api/match/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, jdText, language, sampleConsent }),
        signal: controller.signal,
      });
      const data = (await response.json()) as { analysis?: unknown; error?: string; sampleReference?: string | null };
      if (!response.ok || !isMatchAnalysis(data.analysis)) {
        const errors: Record<string, string> = {
          AI_NOT_CONFIGURED: t.aiNotConfigured,
          DEEPSEEK_AUTH_FAILED: t.aiAuth,
          DEEPSEEK_BALANCE: t.aiBalance,
          DEEPSEEK_RATE_LIMIT: t.aiRate,
          SITE_RATE_LIMIT: t.siteRate,
          DEEPSEEK_INVALID_OUTPUT: t.aiOutput,
          DEEPSEEK_INCOMPLETE_REPORT: t.aiOutput,
          DEEPSEEK_TIMEOUT: t.aiTimeout,
        };
        setAnalysisError(errors[data.error ?? ''] ?? t.aiFailed);
        trackEvent('analysis_failed', { reason: (data.error || 'invalid_report').slice(0, 36) });
        setAnalysisState('error'); return;
      }
      setResumeNeedsReview(false); setAnalysis(data.analysis); setAnalysisState('idle'); setSampleReference(typeof data.sampleReference === 'string' ? data.sampleReference : ''); setSampleDeleted(false); setScreen('results');
      trackEvent('analysis_completed', { grade: data.analysis.grade, score_band: `${Math.floor(data.analysis.overall / 10) * 10}s`, suggestion_count: data.analysis.suggestions.length });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      const reason = error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network_error';
      setAnalysisError(reason === 'timeout' ? t.aiTimeout : t.aiFailed); setAnalysisState('error');
      trackEvent('analysis_failed', { reason });
    } finally { window.clearTimeout(timeout); }
  }

  async function deleteSavedSample() {
    if (!sampleReference) return;
    const response = await fetch(`/api/samples/${encodeURIComponent(sampleReference)}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    if (!response.ok) return;
    setSampleReference('');
    setSampleDeleted(true);
  }

  return (
    <main className="workspace-shell">
      <nav className="workspace-nav">
        <Link href="/" className="back-link"><span aria-hidden="true">←</span>{t.back}</Link>
        <span className="wordmark-mini">ResumeProof Match</span>
        <button type="button" className="language-button" onClick={toggleLanguage}>{language === 'zh' ? 'EN' : '中文'}</button>
      </nav>

      {screen === 'materials' ? (
        <section className="workspace-main" aria-labelledby="workspace-title">
          <header className="workspace-header">
            <div><h1 id="workspace-title">{t.workspaceTitle}</h1><p>{t.workspaceBody}</p></div>
            <div className="material-status" aria-label={language === 'zh' ? '材料状态' : 'Material status'}>
              <span className={resumeReady ? 'is-ready' : ''}>{resumeReady ? t.resumeReady : t.resumeWaiting}</span>
              <span className={jdReady ? 'is-ready' : ''}>{jdReady ? t.jdReady : t.jdWaiting}</span>
            </div>
          </header>

          <div className="materials-grid">
            <article className="material-card">
              <header><div><h2>{t.resumeTitle}</h2><p>{t.resumeBody}</p></div><span className={resumeReady ? 'material-check is-ready' : 'material-check'}>{resumeReady ? '✓' : '-'}</span></header>
              <div className="material-tabs" role="group" aria-label={t.resumeTitle}>
                <button type="button" className={resumeMode === 'upload' ? 'is-active' : ''} onClick={() => setResumeMode('upload')}>{t.upload}</button>
                <button type="button" className={resumeMode === 'paste' ? 'is-active' : ''} onClick={() => setResumeMode('paste')}>{t.paste}</button>
              </div>
              {resumeMode === 'upload' ? (
                <>
                  <label className={`compact-upload${resumeState === 'ready' ? ' is-success' : ''}`}>
                    <input type="file" accept={RESUME_FILE_ACCEPT} onChange={handleResumeFile} />
                    <span className="file-type" aria-hidden="true">{resumeFile ? resumeFileTag(resumeFile) : '＋'}</span>
                    <span className="file-copy"><b>{resumeState === 'working' ? t.reading : resumeState === 'ready' ? t.uploaded : t.chooseFile}</b><small>{resumeFile ? `${resumeName} · ${(resumeFile.size / 1024 / 1024).toFixed(2)} MB` : t.fileHint}</small></span>
                    {resumeState === 'ready' && <em>{t.replace}</em>}
                  </label>
                  {resumeError && <p className="inline-error" role="alert">{resumeError}</p>}
                  {resumeState === 'ready' && <p className={resumeReady ? 'inline-note is-success' : 'inline-note'}>{resumeReady ? t.parsed : t.pendingOcr}</p>}
                  {resumeText && <details className="parsed-review" open={resumeNeedsReview}><summary>{resumeFile ? t.reviewResume : t.restoredResume}<span>{resumeText.length.toLocaleString()} {t.characters}</span></summary><textarea value={resumeText} rows={12} onChange={(event) => changeResumeText(event.target.value)} /></details>}
                </>
              ) : <label className="material-textarea"><textarea value={resumeText} rows={15} placeholder={t.resumePlaceholder} onChange={(event) => changeResumeText(event.target.value)} /><small>{resumeText.length.toLocaleString()} {t.characters}</small></label>}
            </article>

            <article className="material-card">
              <header><div><h2>{t.jdTitle}</h2><p>{t.jdBody}</p></div><span className={jdReady ? 'material-check is-ready' : 'material-check'}>{jdReady ? '✓' : '-'}</span></header>
              <label className="universal-jd"><textarea value={jdEntry} rows={11} placeholder={t.jdPlaceholder} onChange={(event) => handleJdEntry(event.target.value)} />{!looksLikeUrl && <small>{jdEntry.length.toLocaleString()} {t.characters}</small>}</label>
              {looksLikeUrl && <button type="button" className="parse-link-button" disabled={jdState === 'working'} onClick={parseJobLink}>{jdState === 'working' ? t.parsingLink : t.parseLink}<span aria-hidden="true">→</span></button>}
              {jdSource && <p className="source-detected"><span>{t.detected}</span><b>{jdSource}</b></p>}
              {jdMessage && <p className={jdState === 'error' ? 'inline-error' : 'inline-note'} role="status">{jdMessage}</p>}
              {looksLikeUrl && jdText && <details className="parsed-review"><summary>{t.reviewJd}<span>{jdText.length.toLocaleString()} {t.characters}</span></summary><textarea value={jdText} rows={12} onChange={(event) => changeParsedJd(event.target.value)} /></details>}
              {jobTitle && <p className="job-summary">{[jobTitle, jobCompany, jobLocation].filter(Boolean).join(' · ')}</p>}
            </article>
          </div>

          {analysisError && <p className="analysis-error" role="alert">{analysisError}</p>}
          <footer className="workspace-action">
            <div><p>{t.startHint}</p><label className="sample-consent"><input type="checkbox" checked={sampleConsent} onChange={(event) => setSampleConsent(event.target.checked)} /><span>{t.sampleConsent}</span><Link href="/privacy" target="_blank">{t.samplePrivacy}</Link></label></div>
            <button type="button" disabled={!resumeReady || !jdReady || analysisState === 'working'} onClick={runAiAnalysis}>{analysisState === 'working' ? `${t.analyzing} ${analysisSeconds}s` : resumeNeedsReview ? t.confirmAndAnalyze : t.start}<span aria-hidden="true">→</span></button>
          </footer>
        </section>
      ) : screen === 'results' && analysis ? (
        <section className="match-workbench" aria-labelledby="match-workbench-title">
          <div className="results-toolbar"><button type="button" onClick={() => setScreen('materials')}><span aria-hidden="true">←</span>{t.resultBack}</button><small>{t.localRules}</small></div>
          <header className="workbench-heading"><div><h1 id="match-workbench-title">{t.matchTitle}</h1><p>{t.matchBody}</p><blockquote className="analysis-summary">{analysis.summary}</blockquote></div></header>
          {(sampleReference || sampleDeleted) && <div className="sample-receipt"><span>{sampleDeleted ? t.sampleDeleted : `${t.sampleSaved} · ${sampleReference.slice(0, 8)}`}</span>{sampleReference && <button type="button" onClick={deleteSavedSample}>{t.sampleDelete}</button>}</div>}
          <div className="diagnostic-grid">
            <article className={`score-panel grade-${analysis.grade.toLowerCase()}`}><span>{t.scoreLabel}</span><small className="score-method">{t.scoreMethod}</small><strong>{analysis.overall}<small>/100</small></strong><p>{gradeCopy}</p></article>
            <div className="dimension-panel">{[
              { label: t.mustCoverage, value: analysis.scoring.mustCoverage, note: t.mustNote },
              { label: t.importantCoverage, value: analysis.scoring.importantCoverage, note: t.importantNote },
              { label: t.verifiedCoverage, value: analysis.scoring.verifiedEvidence, note: `${t.verifiedNote} · ${analysis.scoring.totalRequirements}` },
            ].map((dimension) => <article key={dimension.label}><header><span>{dimension.label}</span><b>{dimension.value === null ? '-' : `${dimension.value}%`}</b></header><p className="dimension-reason">{dimension.note}</p></article>)}</div>
          </div>
          <div className="signal-grid"><section><h2>{t.coveredTitle}</h2><div className="term-cloud">{analysis.coveredTerms.map((term) => <span key={term}>{term}</span>)}</div></section><section className="missing-signals"><h2>{t.missingTitle}</h2><div className="term-cloud">{analysis.missingTerms.map((term) => <span key={term}>{term}</span>)}</div><p>{t.missingAdvice}</p></section></div>
          <details className="evidence-section"><summary><div><h2>{t.evidenceTitle}</h2><p>{t.evidenceBody}</p></div><span>{analysis.evidence.length}</span></summary><div className="evidence-list">{analysis.evidence.map((item, index) => <article key={`${item.requirement}-${index}`}><div className="evidence-topline"><span className={`evidence-status status-${item.status}`}>{statusCopy[item.status]}</span><small>{item.importance}</small></div><p className="evidence-requirement">{item.requirement}</p>{item.resumeEvidence.length ? <blockquote><span>{t.evidenceQuote}</span>{item.resumeEvidence.join(' / ')}</blockquote> : <small>{t.noMatchedTerms}</small>}<p className="evidence-rationale"><span>{t.whyMatch}</span>{item.rationale}</p></article>)}</div></details>
          <OptimizationReview analysis={analysis} language={language} decisions={suggestionDecisions} notes={suggestionNotes} onDecision={(id, decision) => { setSuggestionDecisions((current) => ({ ...current, [id]: decision })); trackEvent('suggestion_reviewed', { decision }); }} onNote={(id, note) => setSuggestionNotes((current) => ({ ...current, [id]: note }))} onBack={() => setScreen('materials')} onBuildDraft={buildTextReview} />
        </section>
      ) : screen === 'review' && analysis ? (
        <section className="text-review-shell" aria-labelledby="text-review-title">
          <header className="text-review-header"><span>{t.reviewEyebrow}</span><h1 id="text-review-title">{t.reviewTitle}</h1><p>{t.reviewBody}</p></header>
          <div className="review-template-bar">
            <div className="review-template-options" role="radiogroup" aria-label={t.templateEyebrow}>
              {templateOptions.map((option) => <button key={option.id} type="button" role="radio" aria-checked={selectedTemplate === option.id} className={selectedTemplate === option.id ? 'is-selected' : ''} onClick={() => setSelectedTemplate(option.id)}>{option.name}</button>)}
            </div>
            <p className={draftConfirmed ? 'draft-status is-confirmed' : 'draft-status'}>{draftConfirmed ? `${t.confirmedEyebrow} · ${new Date(confirmedAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false })}` : t.reviewWarning}</p>
          </div>
          <div className="text-review-grid">
            <aside className="adopted-change-list"><header><h2>{t.reviewChanges}</h2><span>{adoptedSuggestions.length}</span></header>{adoptedSuggestions.length ? adoptedSuggestions.map((suggestion, index) => <details key={suggestion.id}><summary><span>{String(index + 1).padStart(2, '0')}</span>{suggestion.targetSection}</summary><div><small>{t.reviewOriginal}</small><p>{suggestion.originalText}</p><small>{t.reviewFinal}</small><p>{suggestionNotes[suggestion.id] ?? suggestion.revisedText}</p></div></details>) : <p className="adopted-change-empty">{t.reviewNoChanges}</p>}</aside>
            <section className="review-stage" aria-label={t.reviewCanvas}>
              <div className="review-toolbar">
                <div className="review-view-switch" role="group" aria-label={t.reviewCanvas}>
                  <button type="button" className={reviewMode === 'preview' ? 'is-active' : ''} aria-pressed={reviewMode === 'preview'} onClick={() => setReviewMode('preview')}>{t.reviewPreview}</button>
                  <button type="button" className={reviewMode === 'edit' ? 'is-active' : ''} aria-pressed={reviewMode === 'edit'} onClick={() => setReviewMode('edit')}>{t.reviewEdit}</button>
                </div>
                <small>{reviewDraft.length.toLocaleString()} {t.reviewCharacters}</small>
              </div>
              {reviewMode === 'preview' ? <>
                <p className="review-preview-hint">{t.reviewPreviewHint}</p>
                <ResumeDocument blocks={reviewPreviewBlocks} template={selectedTemplate} className="export-document" />
              </> : <label className="full-draft-editor"><span>{t.reviewFinal}</span><textarea value={reviewDraft} rows={36} onChange={(event) => editReviewDraft(event.target.value)} /></label>}
            </section>
          </div>
          <div className="text-review-actions">
            <button type="button" onClick={() => setScreen('results')}><span aria-hidden="true">←</span>{t.reviewBack}</button>
            <div className="review-export-actions">
              {!draftConfirmed && <button type="button" disabled={reviewDraft.trim().length < 80} onClick={confirmTextDraft}>{t.reviewNext}<span aria-hidden="true">→</span></button>}
              <button type="button" disabled={!draftConfirmed} onClick={downloadResumeHtml}>{t.exportDownload}</button>
              <button type="button" disabled={!draftConfirmed} onClick={printResume}>{t.exportPrint}</button>
            </div>
          </div>
          <p className="export-print-hint">{t.exportPrintHint}</p>
        </section>
      ) : null}
      <SiteFooter />
    </main>
  );
}
