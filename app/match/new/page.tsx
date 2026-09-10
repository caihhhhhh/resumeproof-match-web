'use client';

import Link from 'next/link';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { OptimizationReview, SuggestionDecision } from '../../components/optimization-review';
import { ResumeDocument, ResumeTemplate, ReviewBlock, resumeEntry } from '../../components/resume-document';
import { ResumeStructuredEditor } from '../../components/resume-structured-editor';
import { SiteFooter } from '../../components/site-footer';
import { useLanguage } from '../../components/language-context';
import { getDemoMaterials } from '../../lib/demo-materials';
import { auditFactChanges, FactChangeCategory } from '../../lib/fact-audit';
import { EvidenceStatus, HardRequirementStatus, isMatchAnalysis, MatchAnalysis } from '../../lib/match-analysis';
import { identifyJobSource, sourceLabels } from '../../lib/job-source';
import { beginMatch, fileSizeBucket, trackEvent } from '../../lib/analytics';

type Screen = 'materials' | 'results' | 'review';
type InputMode = 'upload' | 'paste';
type ParseState = 'idle' | 'working' | 'ready' | 'paste_required' | 'error';
type FeedbackReason = 'helpful' | 'score_unfair' | 'evidence_missed' | 'suggestions_weak' | 'unclear' | 'other';

const ACCEPTED_RESUME_EXTENSIONS = new Set([
  'pdf', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp',
]);

const RESUME_FILE_ACCEPT = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg,image/webp';
const JD_FILE_ACCEPT = RESUME_FILE_ACCEPT;
const BASE_RESUME_KEY = 'resumeproof-base-resume-v1';

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
  reviewBaseline?: string;
  reviewBlocks?: ReviewBlock[];
  factConfirmations?: Record<string, boolean>;
  confirmedDraft?: string;
  confirmedAt?: string;
  selectedTemplate?: ResumeTemplate;
  sampleReference?: string;
  step?: number;
};

type StoredBaseResume = {
  text: string;
  savedAt: string;
};

const copy = {
  zh: {
    back: '返回首页', workspaceTitle: '添加简历与目标岗位', workspaceBody: '上传简历，再添加目标岗位。分析时会将文字发送至 AI 服务；扫描文件需要视觉识别。',
    resumeReady: '简历已就绪', resumeWaiting: '等待简历', jdReady: 'JD 已就绪', jdWaiting: '等待 JD', localOnly: 'AI 语义分析',
    resumeTitle: '基础简历', resumeBody: '上传文件，或直接粘贴简历文字。可选保存一份本机基础版本。', upload: '上传文件', paste: '粘贴文字', chooseFile: '选择一份简历文件',
    fileHint: '最大 8 MB · PDF、DOCX、TXT、MD、PNG、JPG 或 WebP', reading: '正在读取并识别内容…', uploaded: '上传成功', parsed: '内容已读取，请先核对文字再开始匹配',
    pendingOcr: '文件已上传，但没有识别到足够文字。请重新上传或粘贴文字。', replace: '重新选择', unsupported: '暂不支持此格式，请上传 PDF、DOCX、TXT、MD、PNG、JPG 或 WebP。', tooLarge: '文件超过 8 MB。',
    ocrNotConfigured: '视觉识别服务尚未配置，请联系网站管理员。', ocrAuth: '视觉识别服务授权异常，请联系网站管理员。', ocrRate: '视觉识别请求过于频繁，请稍后重试。', ocrTimeout: '视觉识别超时，请重新上传。', ocrPageLimit: '扫描 PDF 最多支持 6 页，请上传精简版简历。', ocrFailed: '没有可靠识别出简历文字，请重新上传清晰文件或粘贴文字。',
    resumePlaceholder: '粘贴完整简历内容……', reviewResume: '查看或编辑读取到的简历文字', restoredResume: '已恢复当前标签页中的简历文字',
    jdTitle: '目标岗位', jdBody: '粘贴文字或链接，也可以上传 JD 文件与截图。', jdPlaceholder: '粘贴职位链接，或直接粘贴职责与任职要求……',
    jdUpload: '上传 JD 文件或截图', jdUploadHint: 'PDF、DOCX、TXT、MD、PNG、JPG 或 WebP', jdUploaded: 'JD 内容已读取，请核对文字。', jdReading: '正在读取 JD…',
    parseLink: '读取职位链接', parsingLink: '正在读取…', detected: '已识别来源', linkParsed: '职位内容已读取，请检查原文。', pasteRequired: '该页面无法可靠自动读取，请把完整 JD 粘贴到输入框。', detailLinkRequired: '请粘贴具体职位详情页链接，而不是搜索结果或职位列表页。',
    invalidUrl: '请输入有效的 HTTPS 招聘链接。', reviewJd: '查看或编辑读取到的 JD 文字', characters: '字符', start: '开始 AI 分析', confirmAndAnalyze: '确认识别文字并分析', analyzing: 'AI 正在分析…', startHint: '点击后，已核对的简历与 JD 文字将发送给 DeepSeek 做语义分析；图片或扫描 PDF 仅在识别时发送给智谱。', sampleConsent: '允许保存自动脱敏后的简历与 JD 30 天，用于改进匹配质量（可选）', samplePrivacy: '了解数据处理', sampleSaved: '脱敏样本已保存 30 天', sampleDelete: '立即删除', sampleDeleted: '样本已删除',
    aiNotConfigured: '分析服务尚未配置，请联系网站管理员。', aiFailed: '分析服务暂时不可用，请稍后重试。', aiAuth: '分析服务授权异常，请联系网站管理员。', aiBalance: '分析服务额度不足，请联系网站管理员。', aiRate: '分析服务请求过于频繁，请稍后重试。', siteRate: '当前设备请求较频繁，请稍后再试。', aiOutput: '完整报告未生成成功，请重新分析。系统不会展示缺少评分、证据或建议的半成品。', aiTimeout: '分析超过 60 秒仍未响应，请重新分析。',
    resultBack: '返回修改材料', matchTitle: '证据先于分数。', matchBody: 'AI 会识别同义表达和可迁移经验，但每项匹配都必须引用真实的简历原句。结果不代表招聘决定。',
    decisionLabel: '投递建议', decisionApply: '可以直接投递', decisionReview: '确认后再投递', decisionSkip: '暂不建议投递', decisionApplyNote: '硬条件已核对，核心能力有充分证据。', decisionReviewNote: '存在尚未确认的硬条件或需要补强的核心证据。', decisionSkipNote: '存在明确硬条件冲突或关键能力证据不足。', scoreLabel: '证据匹配度', gradeA: '值得投递', gradeB: '有条件投递', gradeC: '证据不足', scoreMethod: '系统先核对硬条件，再按 3、2、1 权重计算必须项、重要项和加分项；分数只作为辅助，不会覆盖未确认或不满足的硬条件。', mustCoverage: '必须项覆盖', importantCoverage: '重要项覆盖', bonusCoverage: '加分项覆盖', verifiedCoverage: '引用覆盖率', mustNote: '对最终判断影响最大', importantNote: '影响岗位胜任度', bonusNote: '不满足通常不构成淘汰', verifiedNote: '分析要求中附有原句的比例，不代表语义核验通过率',
    hardTitle: '先核对硬条件', hardBody: '地点、身份、学历、年限、语言和行业门槛不会被综合分数掩盖。', hardEmpty: 'JD 中没有识别到明确的硬性门槛。', hardMet: '已满足', hardUnverified: '待确认', hardNotMet: '不满足', hardEvidence: '核对原句',
    factTitle: '导出前核对事实变化', factBody: '对照原始简历，核对新增或改写的数字、职责与成果。已采用的 AI 建议也需要核对；这些提示不代表内容一定有误。', factClear: '自动检查未标记事实变化，请核对全文后导出。', factProgress: '项已确认', factConfirm: '我确认这项内容真实且准确', factIdentity: '姓名', factHeadline: '目标方向', factContact: '联系方式', factExperience: '公司、职位或经历时间', factDate: '日期', factNumber: '数字或指标', factProperNoun: '平台或专有名词', factBlocked: '请先确认全部事实变化，再导出文件。',
    evidenceTitle: 'JD 要求与简历证据', evidenceBody: '先看原句，再看简历中是否有语义对应且可核对的证据。', nextFocusTitle: '先处理这些关键差距', nextFocusEmpty: '当前没有高优先级证据缺口，可以直接审核改写建议。',
    statusStrong: '已证实', statusPartial: '部分证据', statusGap: '尚无证据', noMatchedTerms: '暂无可核对原句', coveredTitle: '已有优势', missingTitle: '优先补证',
    missingAdvice: '只补充真实做过的项目、动作或结果；没有经历就保留为差距。', metricSignals: '份量化结果已识别', localRules: 'AI 语义诊断 · 原句证据校验', evidenceQuote: '简历证据', whyMatch: '判断依据',
    feedbackTitle: '这份分析对你有帮助吗？', feedbackBody: '只记录选择，不记录简历或 JD 内容。', feedbackYes: '有帮助', feedbackNo: '不太准', feedbackWhy: '主要问题是', feedbackThanks: '收到，感谢你的反馈。', feedbackError: '暂时无法提交，请稍后再试。', feedbackScore: '评分不合理', feedbackEvidence: '漏掉已有经历', feedbackSuggestions: '建议不实用', feedbackUnclear: '解释不清楚', feedbackOther: '其他',
    reviewEyebrow: '完整文字审核稿', reviewTitle: '编辑与导出', reviewBody: '这里只合并你明确采用的建议。核对全文并选择版式后，可直接确认并保存 PDF 或 DOCX。', reviewChanges: '本轮已采用修改', reviewOriginal: '原文', reviewFinal: '审核稿', reviewCharacters: '字符', reviewWarning: '导出前请重点核对公司、职位、日期、数字和专有名词。', reviewBack: '返回建议审核', reviewNext: '确认文字稿', reviewPreview: '排版预览', reviewEdit: '编辑文字', reviewPreviewHint: '预览只调整视觉层级与空白，不改变审核稿内容。', reviewNoChanges: '本轮没有采用 AI 改写，当前显示原始简历全文。', reviewCanvas: '文字排版预览', reviewPage: '页', reviewPagesApprox: '预计', reviewIncomplete: '项待填写', reviewLong: '内容可能超过两页，建议切换紧凑版或精简次要信息。',
    confirmedEyebrow: '文字审核已完成', confirmedTitle: '这份文字稿已锁定。', confirmedBody: '系统保存了当前全文快照。返回修改任何文字后，本次确认会自动失效；此操作不会生成 HTML、PDF 或其他文件。', confirmedSnapshot: '已确认全文', confirmedChanges: '采用修改', confirmedTime: '确认时间', confirmedEdit: '返回继续编辑', confirmedNext: '选择简历模板', confirmedNextHint: '先选择版式，不会立即生成文件。',
    templateEyebrow: '选择版式', templateTitle: '内容不变，只调整阅读节奏。', templateBody: '三个模板共用已确认文字。切换模板不会重写内容，也不会影响匹配报告。', templateBalanced: '经典单栏', templateBalancedBody: '沿用 Will 的简历骨架：蓝灰标题、清晰时间轴与舒适行距。', templateCompact: '紧凑单栏', templateCompactBody: '保持同一视觉体系，压缩段间距以容纳更长经历。', templateMinimal: '极简单栏', templateMinimalBody: '保留版式节奏，降低色彩强调，让成果更突出。', templateSelected: '已选择', templateBack: '返回确认记录', templateContinue: '进入最终预览',
    exportEyebrow: '最终预览', exportTitle: '下载前，再看一遍成品。', exportBody: '这里展示最终版式。', exportBack: '返回选择模板', exportDownload: '下载 HTML', exportPrint: '确认并下载 PDF', exportDocx: '下载 DOCX', exportMore: '更多格式', exportAnother: '用当前简历匹配新岗位', exportPrintHint: '确认全文后下载。PDF 为实际 A4 分页；网页页数仅供参考，DOCX 可继续编辑。', exportTemplate: '当前模板', exportReady: '文字与版式已准备完成', pdfCheckTitle: '导出格式说明', pdfCheckBody: 'A4 单栏、固定页边距、可选择文字、受控分页；中文简历按需嵌入字体。', pdfGenerating: '正在生成 PDF…', pdfError: 'PDF 生成失败，请检查网络后重试，或先下载 DOCX。',
    demoAction: '使用示例材料完整体验', demoLoaded: '示例材料与完整报告已载入', saveBaseResume: '保存为本机基础简历', updateBaseResume: '更新本机基础简历', useBaseResume: '使用已保存版本', baseResumeSaved: '本机基础版本已保存', clearBaseResume: '清除本机版本', baseResumeHint: '只保存在这台设备的浏览器中，不会上传；清除浏览器数据后会消失。',
  },
  en: {
    back: 'Back home', workspaceTitle: 'Add your resume and target role', workspaceBody: 'Add your resume and target role. Analysis sends the text to an AI service; scanned files use visual recognition.',
    resumeReady: 'Resume ready', resumeWaiting: 'Resume needed', jdReady: 'JD ready', jdWaiting: 'JD needed', localOnly: 'AI semantic analysis',
    resumeTitle: 'Base resume', resumeBody: 'Upload a file or paste the complete resume. You can optionally keep one local base version.', upload: 'Upload file', paste: 'Paste text', chooseFile: 'Choose a resume file',
    fileHint: 'Up to 8 MB · PDF, DOCX, TXT, MD, PNG, JPG, or WebP', reading: 'Reading and recognizing content…', uploaded: 'Upload successful', parsed: 'Content extracted. Review the text before matching.',
    pendingOcr: 'The file uploaded, but not enough text was recognized. Upload it again or paste the text.', replace: 'Choose another', unsupported: 'Upload a PDF, DOCX, TXT, MD, PNG, JPG, or WebP file.', tooLarge: 'The file is larger than 8 MB.',
    ocrNotConfigured: 'Visual recognition is not configured. Contact the site administrator.', ocrAuth: 'Visual recognition has an authorization issue. Contact the site administrator.', ocrRate: 'Visual recognition is rate-limited. Try again shortly.', ocrTimeout: 'Visual recognition timed out. Upload the file again.', ocrPageLimit: 'Scanned PDFs can contain up to 6 pages. Upload a shorter resume.', ocrFailed: 'The resume text could not be read reliably. Upload a clearer file or paste the text.',
    resumePlaceholder: 'Paste the complete resume here…', reviewResume: 'Review or edit the extracted resume text', restoredResume: 'Restored text from this browser tab',
    jdTitle: 'Target role', jdBody: 'Paste text or a link, or upload a JD file or screenshot.', jdPlaceholder: 'Paste a job link or the complete responsibilities and requirements…',
    jdUpload: 'Upload a JD file or screenshot', jdUploadHint: 'PDF, DOCX, TXT, MD, PNG, JPG, or WebP', jdUploaded: 'JD content extracted. Review the text.', jdReading: 'Reading the JD…',
    parseLink: 'Read job link', parsingLink: 'Reading…', detected: 'Detected source', linkParsed: 'Job content extracted. Review the source text.', pasteRequired: 'This page cannot be read reliably. Paste the complete JD into the field.', detailLinkRequired: 'Paste a specific job-detail URL rather than a search or job-listing page.',
    invalidUrl: 'Enter a valid HTTPS job posting URL.', reviewJd: 'Review or edit the extracted JD text', characters: 'characters', start: 'Start AI analysis', confirmAndAnalyze: 'Confirm extracted text and analyze', analyzing: 'AI is analyzing…', startHint: 'After you click, reviewed resume and JD text is sent to DeepSeek for semantic analysis. Images or scanned PDFs are sent to Zhipu only for recognition.', sampleConsent: 'Save an automatically redacted resume and JD for 30 days to improve matching (optional)', samplePrivacy: 'How data is handled', sampleSaved: 'Redacted sample saved for 30 days', sampleDelete: 'Delete now', sampleDeleted: 'Sample deleted',
    aiNotConfigured: 'The analysis service is not configured. Contact the site administrator.', aiFailed: 'The analysis service is temporarily unavailable. Please try again.', aiAuth: 'The analysis service has an authorization issue. Contact the site administrator.', aiBalance: 'The analysis service has insufficient quota. Contact the site administrator.', aiRate: 'The analysis service is rate-limiting requests. Try again shortly.', siteRate: 'This device has made too many requests. Please try again shortly.', aiOutput: 'The complete report could not be generated. Please retry; incomplete scores, evidence, or suggestions will never be shown.', aiTimeout: 'Analysis did not finish within 60 seconds. Please run it again.',
    resultBack: 'Back to materials', matchTitle: 'Evidence before scores.', matchBody: 'AI can recognize equivalent wording and transferable experience, but every match must cite a real resume excerpt. Results are not hiring decisions.',
    decisionLabel: 'Application recommendation', decisionApply: 'Apply now', decisionReview: 'Confirm before applying', decisionSkip: 'Do not apply yet', decisionApplyNote: 'Eligibility gates are verified and core capabilities have strong evidence.', decisionReviewNote: 'An eligibility gate is still unverified or a core capability needs stronger evidence.', decisionSkipNote: 'There is an explicit eligibility conflict or a critical evidence gap.', scoreLabel: 'Evidence match', gradeA: 'Pursue', gradeB: 'Conditional fit', gradeC: 'Evidence gap', scoreMethod: 'Eligibility gates are checked first. Must-have, important, and bonus capabilities then use 3:2:1 weights; the score cannot override an unverified or unmet gate.', mustCoverage: 'Must-have coverage', importantCoverage: 'Important coverage', bonusCoverage: 'Bonus coverage', verifiedCoverage: 'Citation coverage', mustNote: 'Largest impact on the final score', importantNote: 'Material to role readiness', bonusNote: 'Usually not disqualifying', verifiedNote: 'Share of requirements with source excerpts; not a semantic accuracy score',
    hardTitle: 'Verify eligibility gates first', hardBody: 'Location, authorization, education, experience, language, and industry gates cannot be hidden by an overall score.', hardEmpty: 'No explicit eligibility gate was found in this JD.', hardMet: 'Verified', hardUnverified: 'Confirm', hardNotMet: 'Not met', hardEvidence: 'Source evidence',
    factTitle: 'Verify factual changes before export', factBody: 'Compare changed metrics, responsibilities and outcomes with your original resume, including accepted AI suggestions. A flag means a check is needed, not that the statement is false.', factClear: 'No factual changes were flagged automatically. Review the full text before exporting.', factProgress: 'confirmed', factConfirm: 'I confirm this information is true and accurate', factIdentity: 'Name', factHeadline: 'Target direction', factContact: 'Contact information', factExperience: 'Company, title, or experience dates', factDate: 'Date', factNumber: 'Number or metric', factProperNoun: 'Platform or proper noun', factBlocked: 'Confirm every factual change before exporting.',
    evidenceTitle: 'JD requirements and resume evidence', evidenceBody: 'Start from each requirement, then verify whether the resume contains semantically relevant source evidence.', nextFocusTitle: 'Fix these evidence gaps first', nextFocusEmpty: 'No high-priority evidence gap was found. You can review the rewrite suggestions next.',
    statusStrong: 'Supported', statusPartial: 'Partial evidence', statusGap: 'No evidence yet', noMatchedTerms: 'No verified excerpt yet', coveredTitle: 'Current strengths', missingTitle: 'Evidence to add first',
    missingAdvice: 'Add only projects, actions, or outcomes you actually have. If the experience does not exist, keep it as a gap.', metricSignals: 'quantified results detected', localRules: 'AI semantic diagnostic · source evidence verified', evidenceQuote: 'Resume evidence', whyMatch: 'Reasoning',
    feedbackTitle: 'Was this analysis useful?', feedbackBody: 'Only your selection is stored. Resume and JD content are not included.', feedbackYes: 'Useful', feedbackNo: 'Not accurate', feedbackWhy: 'Main issue', feedbackThanks: 'Thanks, your feedback was received.', feedbackError: 'Feedback could not be submitted. Try again later.', feedbackScore: 'Score feels wrong', feedbackEvidence: 'Missed existing evidence', feedbackSuggestions: 'Suggestions are weak', feedbackUnclear: 'Explanation is unclear', feedbackOther: 'Other',
    reviewEyebrow: 'Full text review', reviewTitle: 'Edit and export', reviewBody: 'Only suggestions you explicitly adopted are merged here. Verify the full draft, choose a layout, then confirm and save PDF or DOCX.', reviewChanges: 'Adopted changes', reviewOriginal: 'Original', reviewFinal: 'Review draft', reviewCharacters: 'characters', reviewWarning: 'Before export, verify company names, titles, dates, metrics, and proper nouns.', reviewBack: 'Back to suggestions', reviewNext: 'Confirm draft', reviewPreview: 'Layout preview', reviewEdit: 'Edit text', reviewPreviewHint: 'The preview changes hierarchy and spacing only. Draft content stays unchanged.', reviewNoChanges: 'No AI rewrite was adopted. The original resume is shown in full.', reviewCanvas: 'Text layout preview', reviewPage: 'page', reviewPagesApprox: 'About', reviewIncomplete: 'fields to complete', reviewLong: 'This may run beyond two pages. Try the compact layout or trim lower-priority details.',
    confirmedEyebrow: 'Text review complete', confirmedTitle: 'This draft is now locked.', confirmedBody: 'The complete text snapshot has been saved. Editing any text will invalidate this confirmation. No HTML, PDF, or other file is created here.', confirmedSnapshot: 'Confirmed text', confirmedChanges: 'adopted changes', confirmedTime: 'Confirmed at', confirmedEdit: 'Return to edit', confirmedNext: 'Choose a template', confirmedNextHint: 'Choose the layout first. No file is generated yet.',
    templateEyebrow: 'Choose a layout', templateTitle: 'Keep the content. Change the reading rhythm.', templateBody: 'All three templates use the confirmed text. Switching layouts does not rewrite the resume or change the match report.', templateBalanced: 'Classic', templateBalancedBody: "Will's resume structure with blue-grey hierarchy, a clear timeline, and comfortable spacing.", templateCompact: 'Compact', templateCompactBody: 'The same visual system with tighter spacing for longer experience.', templateMinimal: 'Minimal', templateMinimalBody: 'The same reading rhythm with quieter color and more focus on outcomes.', templateSelected: 'Selected', templateBack: 'Back to confirmation', templateContinue: 'Open final preview',
    exportEyebrow: 'Final preview', exportTitle: 'One last look before download.', exportBody: 'This is the final layout.', exportBack: 'Back to templates', exportDownload: 'Download HTML', exportPrint: 'Confirm and download PDF', exportDocx: 'Download DOCX', exportMore: 'More formats', exportAnother: 'Match this resume to another job', exportPrintHint: 'Confirm the full text before downloading. PDF uses A4 pagination; web page counts are approximate. DOCX is editable.', exportTemplate: 'Current template', exportReady: 'Text and layout are ready', pdfCheckTitle: 'Export format', pdfCheckBody: 'A4 single column, fixed margins, selectable text, and controlled pagination. CJK fonts load only when needed.', pdfGenerating: 'Generating PDF…', pdfError: 'PDF generation failed. Check your connection and retry, or download DOCX.',
    demoAction: 'Try the complete example', demoLoaded: 'Example materials and full report loaded', saveBaseResume: 'Save as local base resume', updateBaseResume: 'Update local base resume', useBaseResume: 'Use saved version', baseResumeSaved: 'Local base version saved', clearBaseResume: 'Clear local version', baseResumeHint: 'Stored only in this browser on this device. It is not uploaded and disappears if browser data is cleared.',
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
    .replace(/^[^\n]{1,80}\s+International Growth Marketing\s*[·|]?\s*GTM Execution$/gim, '\n')
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
    else if (index === 1 && !currentSection && line.length < 140) kind = 'headline';
    else if (/^(正式工作经历|实习经历|工作经历|professional experience|work experience|experience|internships?)$/i.test(currentSection)) kind = 'bullet';

    const previous = blocks.at(-1);
    if (kind === 'body' && previous?.kind === 'body' && !/[。！？.!?]$/.test(previous.text)) previous.text = joinPreviewText(previous.text, line);
    else blocks.push({ kind, text: line });
  }
  return blocks;
}

function serializeReviewBlocks(blocks: ReviewBlock[]) {
  return blocks.map((block) => block.kind === 'bullet' && !block.text.replace(/^(?:[•·▪◦]|[-*]\s)\s*/, '').trim() ? '' : block.text.trim()).filter(Boolean).join('\n');
}

function isBlankReviewBlock(block: ReviewBlock) {
  const value = block.kind === 'bullet' ? block.text.replace(/^(?:[•·▪◦]|[-*]\s)\s*/, '') : block.text;
  return !value.trim();
}

function sameReviewBlocks(left: ReviewBlock[], right: ReviewBlock[]) {
  return left.length === right.length && left.every((block, index) => block.kind === right[index]?.kind && block.text === right[index]?.text);
}

function isReviewBlockArray(value: unknown): value is ReviewBlock[] {
  const kinds = new Set(['name', 'headline', 'contact', 'section', 'entry', 'bullet', 'body']);
  return Array.isArray(value) && value.every((item) => item && typeof item === 'object' && kinds.has(String((item as ReviewBlock).kind)) && typeof (item as ReviewBlock).text === 'string' && (!item.fields || ['organization', 'role', 'date'].every((key) => typeof item.fields[key] === 'string')));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}

function standaloneResumeHtml(blocks: ReviewBlock[], template: ResumeTemplate, language: 'zh' | 'en') {
  const body = blocks.map((block) => {
    const normalized = block.kind === 'bullet' ? block.text.replace(/^(?:[•·▪◦]|[-*]\s)\s*/, '') : block.text;
    if (!normalized.trim()) return '';
    const text = escapeHtml(normalized.replace(/[:：]$/, ''));
    if (block.kind === 'name') return `<h1>${text}</h1>`;
    if (block.kind === 'section') return `<h2>${text}</h2>`;
    if (block.kind === 'entry') {
      const entry = resumeEntry(block);
      return `<div class="resume-entry"><h3>${escapeHtml(entry.title)}</h3>${entry.date ? `<span>${escapeHtml(entry.date)}</span>` : ''}</div>`;
    }
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
body { margin: 0; background: #edf0f2; color: #18212b; font-family: Arial, "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 10.4pt; line-height: 1.6; }
.resume { width: 210mm; min-height: 297mm; margin: 16px auto 30px; padding: 15mm 17mm 14mm; background: #fff; box-shadow: 0 3px 18px rgba(30,42,53,.12); }
h1 { margin: 0; color: #18212b; font-size: 23pt; line-height: 1.18; letter-spacing: .2px; }
h1 + .resume-headline { margin-top: 4px; color: #315f78; font-size: 11.3pt; font-weight: 700; letter-spacing: .3px; }
h2 { margin: 5.5mm 0 3.2mm; color: #315f78; font-size: 12.2pt; line-height: 1.3; letter-spacing: 1.3px; }
h3 { margin: 4.3mm 0 1.3mm; color: #18212b; font-size: 10.8pt; line-height: 1.4; }
.resume-entry { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: baseline; gap: 16px; margin: 16px 0 6px; break-after: avoid; break-inside: avoid-page; }
.resume-entry h3 { margin: 0; }
.resume-entry span { color: #66717d; font-size: 9.2pt; white-space: nowrap; }
h2 + h3 { margin-top: 12px; }
p { margin: 0 0 2.8mm; }
.resume-contact { margin: 6px 0 0; padding-bottom: 6mm; border-bottom: 1.5px solid #315f78; color: #66717d; font-size: 9.7pt; }
.resume-bullet { display: grid; grid-template-columns: 5mm minmax(0,1fr); margin-bottom: 1.25mm; line-height: 1.6; }
.resume-bullet::before { content: "•"; color: #315f78; padding-left: .7mm; }
.template-compact { padding: 13mm 16mm 11mm; font-size: 9.5pt; line-height: 1.46; }
.template-compact h2 { margin-top: 4mm; }
.template-compact .resume-entry { margin: 11px 0 4px; }
.template-compact p { margin-bottom: 1mm; }
.template-minimal h2 { color: #18212b; letter-spacing: .7px; }
.template-minimal .resume-contact { border-color: #9aa4ae; }
.template-minimal h3 { font-size: 12px; }
.template-minimal .resume-bullet::before { color: #66717d; }
@media print { body { background: white; } .resume { margin: 0; box-shadow: none; } }
</style>
</head>
<body><main class="resume template-${template}">${body}</main></body>
</html>`;
}

async function resumeDocxBlob(blocks: ReviewBlock[], language: 'zh' | 'en', template: ResumeTemplate) {
  const {
    AlignmentType, Document, HeadingLevel, Packer, Paragraph, TabStopType, TextRun,
  } = await import('docx');
  const font = language === 'zh' ? 'Microsoft YaHei' : 'Arial';
  const accent = template === 'minimal' ? '18212B' : '315F78';
  const line = template === 'compact' ? 270 : 310;
  const bodySize = template === 'compact' ? 19 : 20;
  const children = blocks.flatMap((block) => {
    const text = block.text.replace(/^(?:[•·▪◦]|[-*]\s)\s*/, '').trim();
    if (!text) return [];
    if (block.kind === 'name') return [new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 55 }, children: [new TextRun({ text, bold: true, font, size: 46, color: '18212B' })] })];
    if (block.kind === 'headline') return [new Paragraph({ spacing: { after: 55 }, children: [new TextRun({ text, bold: true, font, size: 23, color: accent })] })];
    if (block.kind === 'contact') return [new Paragraph({ spacing: { after: 190 }, border: { bottom: { color: accent, size: 12, style: 'single' } }, children: [new TextRun({ text, font, size: bodySize, color: '66717D' })] })];
    if (block.kind === 'section') return [new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 260, after: 105 }, children: [new TextRun({ text: text.replace(/[:：]$/, ''), bold: true, font, size: 24, color: accent })] })];
    if (block.kind === 'entry') {
      const entry = resumeEntry(block);
      return [new Paragraph({
        keepNext: true, spacing: { before: 100, after: 55 },
        tabStops: [{ type: TabStopType.RIGHT, position: template === 'compact' ? 10_092 : 9_978 }],
        children: [new TextRun({ text: entry.title, bold: true, font, size: 21, color: '18212B' }), ...(entry.date ? [new TextRun({ text: `\t${entry.date}`, font, size: 18, color: '66717D' })] : [])],
      })];
    }
    if (block.kind === 'bullet') return [new Paragraph({ bullet: { level: 0 }, spacing: { after: 45, line }, children: [new TextRun({ text, font, size: bodySize })] })];
    return [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 65, line }, children: [new TextRun({ text, font, size: bodySize })] })];
  });
  const document = new Document({
    styles: { default: { document: { run: { font, size: bodySize }, paragraph: { spacing: { line } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: template === 'compact' ? { top: 737, right: 907, bottom: 624, left: 907 } : { top: 850, right: 964, bottom: 794, left: 964 } } }, children }],
  });
  return Packer.toBlob(document);
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => { timeoutId = setTimeout(() => reject(new Error('READ_TIMEOUT')), milliseconds); })]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function readDocumentFile(file: File): Promise<string> {
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

async function recognizeDocumentFile(file: File, language: 'zh' | 'en', documentType: 'resume' | 'jd'): Promise<string> {
  const images = await withTimeout(prepareOcrImages(file), 30_000);
  if (!images.length) return '';
  const response = await fetch('/api/resume/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images, filename: file.name, language, documentType }),
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
  const [baseResume, setBaseResume] = useState<StoredBaseResume | null>(null);
  const [resumeNeedsReview, setResumeNeedsReview] = useState(false);
  const [resumeState, setResumeState] = useState<ParseState>('idle');
  const [resumeError, setResumeError] = useState('');
  const [jdEntry, setJdEntry] = useState('');
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdFileName, setJdFileName] = useState('');
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
  const [reviewBaseline, setReviewBaseline] = useState('');
  const [reviewBlocks, setReviewBlocks] = useState<ReviewBlock[]>([]);
  const [factConfirmations, setFactConfirmations] = useState<Record<string, boolean>>({});
  const [canUndoReview, setCanUndoReview] = useState(false);
  const [canRedoReview, setCanRedoReview] = useState(false);
  const [confirmedDraft, setConfirmedDraft] = useState('');
  const [confirmedAt, setConfirmedAt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ResumeTemplate>('balanced');
  const [sampleConsent, setSampleConsent] = useState(false);
  const [sampleReference, setSampleReference] = useState('');
  const [sampleDeleted, setSampleDeleted] = useState(false);
  const [feedbackIntent, setFeedbackIntent] = useState<'idle' | 'negative'>('idle');
  const [feedbackState, setFeedbackState] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [pdfExportState, setPdfExportState] = useState<'idle' | 'working' | 'error'>('idle');
  const [previewPages, setPreviewPages] = useState(1);
  const [reviewView, setReviewView] = useState<'edit' | 'preview'>('edit');
  const [baseMessage, setBaseMessage] = useState('');
  const resumeReadyTracked = useRef(false);
  const jdReadyTracked = useRef(false);
  const reviewUndoRef = useRef<ReviewBlock[][]>([]);
  const reviewRedoRef = useRef<ReviewBlock[][]>([]);
  const reviewMergeAtRef = useRef(0);
  const previewMeasureRef = useRef<HTMLDivElement>(null);
  const demoAutoLoadedRef = useRef(false);
  const exportReadyTrackedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(BASE_RESUME_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<StoredBaseResume>;
        if (typeof saved.text === 'string' && saved.text.trim().length >= 80 && typeof saved.savedAt === 'string') {
          setBaseResume({ text: saved.text, savedAt: saved.savedAt });
        } else {
          window.localStorage.removeItem(BASE_RESUME_KEY);
        }
      } catch {
        try { window.localStorage.removeItem(BASE_RESUME_KEY); } catch { /* Ignore unavailable browser storage. */ }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
          if (savedResumeText.length >= 80) { setResumeState('ready'); resumeReadyTracked.current = true; }
          const savedJdEntry = typeof draft.jdEntry === 'string'
            ? draft.jdEntry
            : typeof draft.jdUrl === 'string' && draft.jdUrl
              ? draft.jdUrl
              : savedJdText;
          setJdEntry(savedJdEntry);
          setJdText(savedJdText);
          if (savedJdText.length >= 80) jdReadyTracked.current = true;
          setJdSource(typeof draft.jdSource === 'string' ? draft.jdSource : '');
          setJobTitle(typeof draft.jobTitle === 'string' ? draft.jobTitle : '');
          setJobCompany(typeof draft.jobCompany === 'string' ? draft.jobCompany : '');
          setJobLocation(typeof draft.jobLocation === 'string' ? draft.jobLocation : '');
          if (isMatchAnalysis(draft.analysis)) {
            setAnalysis(draft.analysis);
            if (draft.suggestionDecisions && typeof draft.suggestionDecisions === 'object') setSuggestionDecisions(draft.suggestionDecisions);
            if (draft.suggestionNotes && typeof draft.suggestionNotes === 'object') setSuggestionNotes(draft.suggestionNotes);
            if (typeof draft.reviewDraft === 'string') {
              setReviewDraft(draft.reviewDraft);
              setReviewBlocks(isReviewBlockArray(draft.reviewBlocks) ? draft.reviewBlocks : parseReviewBlocks(draft.reviewDraft));
              setReviewBaseline(savedResumeText);
              if (draft.factConfirmations && typeof draft.factConfirmations === 'object') setFactConfirmations(draft.factConfirmations);
            }
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
    const draft: StoredDraft = { screen, resumeMode, resumeText, jdEntry, jdText, jdSource, jobTitle, jobCompany, jobLocation, analysis: analysis ?? undefined, suggestionDecisions, suggestionNotes, reviewDraft, reviewBaseline, reviewBlocks, factConfirmations, confirmedDraft, confirmedAt, selectedTemplate, sampleReference };
    try { window.sessionStorage.setItem('resumematch-current-draft', JSON.stringify(draft)); } catch { /* Keep the current tab usable if browser storage is unavailable. */ }
  }, [draftRestored, screen, resumeMode, resumeText, jdEntry, jdText, jdSource, jobTitle, jobCompany, jobLocation, analysis, suggestionDecisions, suggestionNotes, reviewDraft, reviewBaseline, reviewBlocks, factConfirmations, confirmedDraft, confirmedAt, selectedTemplate, sampleReference]);

  useEffect(() => {
    if (screen !== 'review') return;
    const paper = previewMeasureRef.current?.querySelector<HTMLElement>('.resume-paper');
    if (!paper) return;
    const measure = () => {
      if (!paper.clientWidth) return;
      const pageHeight = Math.max(1, paper.clientWidth * (297 / 210));
      setPreviewPages(Math.max(1, Math.ceil(paper.scrollHeight / pageHeight - 0.15)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [screen, reviewBlocks, reviewDraft, selectedTemplate]);

  useEffect(() => {
    if (analysisState !== 'working') return;
    const timer = window.setInterval(() => setAnalysisSeconds((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [analysisState]);

  const activateDemo = useCallback(() => {
    beginMatch(true);
    const demo = getDemoMaterials(language);
    setResumeMode('paste'); setResumeFile(null); setResumeName(''); setResumeText(demo.resume); setResumeNeedsReview(false); setResumeState('ready'); setResumeError('');
    setJdFile(null); setJdFileName(''); setJdEntry(demo.jd); setJdText(demo.jd); setJdSource(language === 'zh' ? '公开脱敏示例' : 'Public demo'); setJdState('ready'); setJdMessage('');
    setJobTitle(language === 'zh' ? '增长营销经理' : 'Growth Marketing Manager'); setJobCompany('Example Labs'); setJobLocation('');
    setAnalysis(demo.analysis); setAnalysisState('idle'); setAnalysisError(''); setSuggestionDecisions({}); setSuggestionNotes({}); setReviewDraft(''); setReviewBaseline(''); setReviewBlocks([]); setFactConfirmations({}); setConfirmedDraft(''); setConfirmedAt(''); setSampleReference(''); setSampleDeleted(false); setFeedbackIntent('idle'); setFeedbackState('idle');
    resumeReadyTracked.current = true; jdReadyTracked.current = true; reviewUndoRef.current = []; reviewRedoRef.current = []; setCanUndoReview(false); setCanRedoReview(false);
    setScreen('results');
    trackEvent('demo_started', { language });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [language]);

  useEffect(() => {
    if (!draftRestored || demoAutoLoadedRef.current) return;
    if (new URLSearchParams(window.location.search).get('demo') !== '1') return;
    demoAutoLoadedRef.current = true;
    const timer = window.setTimeout(activateDemo, 0);
    return () => window.clearTimeout(timer);
  }, [activateDemo, draftRestored]);

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
    setResumeFile(file); setResumeName(file.name); setResumeText(''); setResumeState('working'); setAnalysis(null); setSuggestionDecisions({}); setSuggestionNotes({}); setReviewDraft(''); setReviewBaseline(''); setReviewBlocks([]); setFactConfirmations({}); setConfirmedDraft(''); setConfirmedAt(''); resumeReadyTracked.current = false;
    trackEvent('resume_upload_started', { file_type: fileExtension(file.name), file_size: fileSizeBucket(file.size) });
    try {
      const localText = await readDocumentFile(file).catch(() => '');
      const usedOcr = localText.length < 80;
      const text = usedOcr ? await recognizeDocumentFile(file, language, 'resume') : localText;
      setResumeText(text.length >= 80 ? text : '');
      setResumeNeedsReview(usedOcr && text.length >= 80);
      if (text.length >= 80) {
        setResumeState('ready');
        trackEvent('resume_upload_completed', { file_type: fileExtension(file.name), extraction: usedOcr ? 'ocr' : 'local' });
        trackEvent('resume_input_ready', { method: usedOcr ? 'ocr' : 'upload' });
        resumeReadyTracked.current = true;
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

  async function handleJdFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = fileExtension(file.name);
    if (!ACCEPTED_RESUME_EXTENSIONS.has(extension)) {
      setJdFile(null); setJdFileName(''); setJdState('error'); setJdMessage(t.unsupported); event.target.value = ''; return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setJdFile(null); setJdFileName(''); setJdState('error'); setJdMessage(t.tooLarge); event.target.value = ''; return;
    }
    setJdFile(file); setJdFileName(file.name); setJdEntry(''); setJdText(''); setJdState('working'); setJdMessage(''); setJdSource(''); setJobTitle(''); setJobCompany(''); setJobLocation(''); setAnalysis(null); setSuggestionDecisions({}); setSuggestionNotes({}); setReviewDraft(''); setReviewBaseline(''); setReviewBlocks([]); setFactConfirmations({}); setConfirmedDraft(''); setConfirmedAt(''); jdReadyTracked.current = false;
    trackEvent('jd_file_upload_started', { file_type: extension, file_size: fileSizeBucket(file.size) });
    try {
      const localText = await readDocumentFile(file).catch(() => '');
      const usedOcr = localText.length < 80;
      const text = usedOcr ? await recognizeDocumentFile(file, language, 'jd') : localText;
      if (text.length < 80) throw new Error('OCR_FAILED');
      setJdEntry(text); setJdText(text); setJdState('ready'); setJdMessage(t.jdUploaded); setJdSource(language === 'zh' ? '上传文件' : 'Uploaded file');
      trackEvent('jd_file_upload_completed', { file_type: extension, extraction: usedOcr ? 'ocr' : 'local' });
      trackEvent('jd_input_ready', { method: usedOcr ? 'file_ocr' : 'file' });
      jdReadyTracked.current = true;
    } catch (error) {
      const code = error instanceof Error ? error.message : 'OCR_FAILED';
      const message = code === 'OCR_NOT_CONFIGURED' ? t.ocrNotConfigured
        : code === 'OCR_AUTH' ? t.ocrAuth
          : code === 'OCR_RATE_LIMIT' ? t.ocrRate
            : code === 'SITE_RATE_LIMIT' ? t.siteRate
              : code === 'OCR_TIMEOUT' || code === 'READ_TIMEOUT' ? t.ocrTimeout
                : code === 'OCR_PAGE_LIMIT' ? t.ocrPageLimit
                  : t.ocrFailed;
      setJdEntry(''); setJdText(''); setJdState('error'); setJdMessage(message);
      trackEvent('jd_file_upload_failed', { reason: code.slice(0, 36), file_type: extension });
    }
  }

  function handleJdEntry(value: string) {
    setJdFile(null); setJdFileName(''); setJdEntry(value); setJdMessage(''); setJdSource(''); setJobTitle(''); setJobCompany(''); setJobLocation(''); setAnalysis(null); setSuggestionDecisions({}); setSuggestionNotes({}); setReviewDraft(''); setReviewBaseline(''); setReviewBlocks([]); setFactConfirmations({}); setConfirmedDraft(''); setConfirmedAt('');
    if (/^https?:\/\//i.test(value.trim())) { setJdText(''); setJdState('idle'); jdReadyTracked.current = false; }
    else {
      const ready = value.trim().length >= 80;
      setJdText(value); setJdState(ready ? 'ready' : 'idle');
      if (ready && !jdReadyTracked.current) trackEvent('jd_input_ready', { method: 'paste' });
      jdReadyTracked.current = ready;
    }
  }

  function changeResumeText(value: string) {
    setResumeText(value); setAnalysis(null); setSuggestionDecisions({}); setSuggestionNotes({}); setReviewDraft(''); setReviewBaseline(''); setReviewBlocks([]); setFactConfirmations({}); setConfirmedDraft(''); setConfirmedAt('');
    const ready = value.trim().length >= 80;
    if (ready && !resumeReadyTracked.current) trackEvent('resume_input_ready', { method: resumeMode === 'paste' ? 'paste' : 'edit' });
    resumeReadyTracked.current = ready;
  }

  function saveBaseResume() {
    const text = resumeText.trim();
    if (text.length < 80) return;
    const next: StoredBaseResume = { text, savedAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(BASE_RESUME_KEY, JSON.stringify(next));
      setBaseResume(next);
      setBaseMessage(language === 'zh' ? '已保存在当前浏览器，可下次继续使用。' : 'Saved in this browser for your next visit.');
      trackEvent('base_resume_saved', { action: baseResume ? 'updated' : 'created' });
    } catch {
      setBaseMessage(language === 'zh' ? '保存失败，请检查浏览器存储设置。当前文字仍在页面中。' : 'Could not save. Check browser storage settings; your current text is still here.');
    }
  }

  function clearBaseResume() {
    try { window.localStorage.removeItem(BASE_RESUME_KEY); } catch { setBaseMessage(language === 'zh' ? '未能清除，请检查浏览器存储设置。' : 'Could not clear browser storage.'); return; }
    setBaseResume(null);
    setBaseMessage(language === 'zh' ? '本机基础版本已清除，当前编辑内容保留。' : 'Local base version cleared. Current edits are retained.');
    trackEvent('base_resume_cleared');
  }

  function useSavedBaseResume() {
    if (!baseResume) return;
    setResumeMode('paste');
    setResumeFile(null);
    setResumeName('');
    setResumeNeedsReview(false);
    setResumeState('ready');
    setResumeError('');
    changeResumeText(baseResume.text);
    trackEvent('base_resume_loaded');
  }

  function changeParsedJd(value: string) {
    setJdText(value); setAnalysis(null); setSuggestionDecisions({}); setSuggestionNotes({}); setReviewDraft(''); setReviewBaseline(''); setReviewBlocks([]); setFactConfirmations({}); setConfirmedDraft(''); setConfirmedAt('');
    const ready = value.trim().length >= 80;
    if (ready && !jdReadyTracked.current) trackEvent('jd_input_ready', { method: 'edit' });
    jdReadyTracked.current = ready;
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
        if (!jdReadyTracked.current) trackEvent('jd_input_ready', { method: 'url' });
        jdReadyTracked.current = true;
      } else if ((data.error || data.code) === 'SITE_RATE_LIMIT') { setJdState('error'); setJdMessage(t.siteRate); }
      else if (data.code === 'JOB_DETAIL_REQUIRED') { setJdState('paste_required'); setJdMessage(t.detailLinkRequired); trackEvent('jd_link_parse_failed', { reason: data.code, source }); }
      else { setJdState('paste_required'); setJdMessage(t.pasteRequired); trackEvent('jd_link_parse_failed', { reason: data.error || data.code || 'paste_required', source }); }
    } catch { setJdState('paste_required'); setJdMessage(t.pasteRequired); trackEvent('jd_link_parse_failed', { reason: 'network_error', source }); }
  }

  const resumeReady = resumeText.trim().length >= 80;
  const jdReady = jdText.trim().length >= 80;
  const looksLikeUrl = /^https?:\/\//i.test(jdEntry.trim());
  const statusCopy: Record<EvidenceStatus, string> = { strong: t.statusStrong, partial: t.statusPartial, gap: t.statusGap };
  const decisionCopy = analysis ? { apply: t.decisionApply, review_first: t.decisionReview, skip: t.decisionSkip }[analysis.decision] : '';
  const decisionNote = analysis ? { apply: t.decisionApplyNote, review_first: t.decisionReviewNote, skip: t.decisionSkipNote }[analysis.decision] : '';
  const hardStatusCopy: Record<HardRequirementStatus, string> = { met: t.hardMet, unverified: t.hardUnverified, not_met: t.hardNotMet };
  const hardCategoryCopy: Record<MatchAnalysis['hardRequirements'][number]['category'], string> = language === 'zh'
    ? { location: '地点', work_authorization: '身份与签证', education: '学历', experience: '年限', language: '语言', industry: '行业', certification: '证书', other: '其他门槛' }
    : { location: 'Location', work_authorization: 'Work authorization', education: 'Education', experience: 'Experience', language: 'Language', industry: 'Industry', certification: 'Certification', other: 'Other gate' };
  const priorityEvidence = analysis?.evidence
    .filter((item) => item.status !== 'strong' && item.importance !== 'bonus')
    .sort((a, b) => (a.importance === 'must' ? 0 : 1) - (b.importance === 'must' ? 0 : 1))
    .slice(0, 3) ?? [];
  const adoptedSuggestions = analysis?.suggestions.filter((item) => suggestionDecisions[item.id] === 'accepted') ?? [];
  const reviewPreviewBlocks = reviewBlocks.length ? reviewBlocks : parseReviewBlocks(reviewDraft);
  const reviewBaselineBlocks = reviewBaseline ? parseReviewBlocks(reviewBaseline) : [];
  const factChanges = reviewBaseline ? auditFactChanges(reviewBaseline, reviewDraft, reviewBaselineBlocks, reviewPreviewBlocks) : [];
  const confirmedFactChanges = factChanges.filter((item) => factConfirmations[item.id]).length;
  const factReviewReady = factChanges.every((item) => factConfirmations[item.id] === true);
  const incompleteReviewBlocks = reviewPreviewBlocks.filter(isBlankReviewBlock).length;
  const reviewReady = reviewDraft.trim().length >= 80 && incompleteReviewBlocks === 0;
  const exportReady = reviewReady && factReviewReady;
  const baseResumeMatches = Boolean(baseResume && resumeText.trim() && compactComparableText(baseResume.text) === compactComparableText(resumeText));
  const factCategoryCopy: Record<FactChangeCategory, string> = {
    identity: t.factIdentity,
    headline: t.factHeadline,
    contact: t.factContact,
    experience: t.factExperience,
    date: t.factDate,
    number: t.factNumber,
    proper_noun: t.factProperNoun,
    claim: language === 'zh' ? '成果或职责变化' : 'Changed outcome or responsibility',
  };
  const templateOptions: Array<{ id: ResumeTemplate; name: string; description: string }> = [
    { id: 'balanced', name: t.templateBalanced, description: t.templateBalancedBody },
    { id: 'compact', name: t.templateCompact, description: t.templateCompactBody },
    { id: 'minimal', name: t.templateMinimal, description: t.templateMinimalBody },
  ];
  const draftConfirmed = confirmedDraft.length >= 80 && confirmedDraft === reviewDraft;

  useEffect(() => {
    if (screen !== 'review' || !exportReady || exportReadyTrackedRef.current) return;
    exportReadyTrackedRef.current = true;
    trackEvent('export_ready_viewed', { template: selectedTemplate });
  }, [exportReady, screen, selectedTemplate]);

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
    setReviewBaseline(resumeText);
    setReviewBlocks(parseReviewBlocks(merged));
    setFactConfirmations({});
    reviewUndoRef.current = [];
    reviewRedoRef.current = [];
    setCanUndoReview(false);
    setCanRedoReview(false);
    exportReadyTrackedRef.current = false;
    reviewMergeAtRef.current = 0;
    setConfirmedDraft('');
    setConfirmedAt('');
    setScreen('review');
    trackEvent('review_draft_built', { adopted_suggestions: adoptedSuggestions.length, template: selectedTemplate });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function confirmDraftForExport() {
    if (!exportReady) return false;
    if (!draftConfirmed) {
      setConfirmedDraft(reviewDraft);
      setConfirmedAt(new Date().toISOString());
      trackEvent('review_draft_confirmed', { adopted_suggestions: adoptedSuggestions.length, template: selectedTemplate });
    }
    return true;
  }

  function editReviewDraft(value: string) {
    applyReviewBlocks(parseReviewBlocks(value), 'merge', value);
  }

  function toggleFactConfirmation(id: string, category: FactChangeCategory, checked: boolean) {
    const next = { ...factConfirmations, [id]: checked };
    setFactConfirmations(next);
    trackEvent('fact_change_reviewed', { fact_category: category, decision: checked ? 'confirmed' : 'unconfirmed' });
    if (checked && factChanges.every((item) => item.id === id || next[item.id])) {
      trackEvent('fact_review_completed', { fact_change_count: factChanges.length });
    }
  }

  function applyReviewBlocks(value: ReviewBlock[], mode: 'merge' | 'checkpoint' = 'merge', draft = serializeReviewBlocks(value)) {
    if (sameReviewBlocks(value, reviewBlocks) && JSON.stringify(value) === JSON.stringify(reviewBlocks)) return;
    const now = Date.now();
    const shouldCheckpoint = mode === 'checkpoint' || now - reviewMergeAtRef.current > 750 || reviewUndoRef.current.length === 0;
    if (shouldCheckpoint && reviewBlocks.length) {
      reviewUndoRef.current = [...reviewUndoRef.current.slice(-39), reviewBlocks.map((block) => ({ ...block }))];
    }
    reviewMergeAtRef.current = mode === 'merge' ? now : 0;
    reviewRedoRef.current = [];
    setCanUndoReview(reviewUndoRef.current.length > 0);
    setCanRedoReview(false);
    setReviewBlocks(value);
    setReviewDraft(draft);
    setConfirmedDraft('');
    setConfirmedAt('');
  }

  function editReviewBlocks(value: ReviewBlock[], mode: 'merge' | 'checkpoint' = 'merge') {
    applyReviewBlocks(value, mode);
  }

  function undoReviewEdit() {
    const previous = reviewUndoRef.current.at(-1);
    if (!previous) return;
    reviewUndoRef.current = reviewUndoRef.current.slice(0, -1);
    reviewRedoRef.current = [...reviewRedoRef.current.slice(-39), reviewBlocks.map((block) => ({ ...block }))];
    setCanUndoReview(reviewUndoRef.current.length > 0);
    setCanRedoReview(true);
    setReviewBlocks(previous);
    setReviewDraft(serializeReviewBlocks(previous));
    setConfirmedDraft('');
    setConfirmedAt('');
    reviewMergeAtRef.current = 0;
  }

  function redoReviewEdit() {
    const next = reviewRedoRef.current.at(-1);
    if (!next) return;
    reviewRedoRef.current = reviewRedoRef.current.slice(0, -1);
    reviewUndoRef.current = [...reviewUndoRef.current.slice(-39), reviewBlocks.map((block) => ({ ...block }))];
    setCanUndoReview(true);
    setCanRedoReview(reviewRedoRef.current.length > 0);
    setReviewBlocks(next);
    setReviewDraft(serializeReviewBlocks(next));
    setConfirmedDraft('');
    setConfirmedAt('');
    reviewMergeAtRef.current = 0;
  }

  function resumeFileBase() {
    const preferred = [jobCompany, jobTitle].filter(Boolean).join('_') || 'optimized_resume';
    return preferred.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').replace(/\s+/g, '_').slice(0, 90);
  }

  function downloadResumeHtml() {
    if (!confirmDraftForExport()) return;
    const html = standaloneResumeHtml(reviewPreviewBlocks, selectedTemplate, language);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${resumeFileBase()}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    trackEvent('resume_export_started', { format: 'html', template: selectedTemplate });
    trackEvent('resume_exported', { format: 'html', template: selectedTemplate });
  }

  async function downloadResumeDocx() {
    if (!confirmDraftForExport()) return;
    trackEvent('resume_export_started', { format: 'docx', template: selectedTemplate });
    const blob = await resumeDocxBlob(reviewPreviewBlocks, language, selectedTemplate);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${resumeFileBase()}.docx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    trackEvent('resume_exported', { format: 'docx', template: selectedTemplate });
  }

  async function downloadResumePdf() {
    if (!confirmDraftForExport() || pdfExportState === 'working') return;
    setPdfExportState('working');
    trackEvent('resume_export_started', { format: 'pdf', template: selectedTemplate });
    try {
      const { createResumePdfBlob } = await import('../../lib/resume-pdf');
      const blob = await createResumePdfBlob(reviewPreviewBlocks, selectedTemplate, language);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${resumeFileBase()}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setPdfExportState('idle');
      trackEvent('resume_exported', { format: 'pdf', template: selectedTemplate });
    } catch (error) {
      console.error('PDF generation failed', error instanceof Error ? error.message : 'unknown');
      setPdfExportState('error');
      trackEvent('resume_export_failed', { format: 'pdf', reason: 'generation_failed', template: selectedTemplate });
    }
  }

  function startAnotherMatch() {
    beginMatch();
    const nextResume = confirmedDraft || reviewDraft || resumeText;
    setResumeMode('paste');
    setResumeFile(null);
    setResumeName('');
    setResumeText(nextResume);
    setResumeState(nextResume.trim().length >= 80 ? 'ready' : 'idle');
    setJdFile(null);
    setJdFileName('');
    setJdEntry('');
    setJdText('');
    setJdSource('');
    setJdState('idle');
    setJdMessage('');
    setJobTitle('');
    setJobCompany('');
    setJobLocation('');
    setAnalysis(null);
    setSuggestionDecisions({});
    setSuggestionNotes({});
    setReviewDraft('');
    setReviewBaseline('');
    setReviewBlocks([]);
    setFactConfirmations({});
    setConfirmedDraft('');
    setConfirmedAt('');
    reviewUndoRef.current = [];
    reviewRedoRef.current = [];
    setCanUndoReview(false);
    setCanRedoReview(false);
    resumeReadyTracked.current = nextResume.trim().length >= 80;
    jdReadyTracked.current = false;
    setScreen('materials');
    trackEvent('new_match_started', { resume_source: 'confirmed_draft' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function runAiAnalysis() {
    if (!resumeReady || !jdReady || analysisState === 'working') return;
    beginMatch();
    setAnalysisSeconds(0); setAnalysisState('working'); setAnalysisError(''); setSuggestionDecisions({}); setSuggestionNotes({}); setReviewDraft(''); setReviewBaseline(''); setReviewBlocks([]); setFactConfirmations({}); setConfirmedDraft(''); setConfirmedAt('');
    trackEvent('analysis_started', { resume_method: resumeMode, jd_method: jdFile ? 'file' : looksLikeUrl ? 'url' : 'paste', language });
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
      setResumeNeedsReview(false); setAnalysis(data.analysis); setAnalysisState('idle'); setSampleReference(typeof data.sampleReference === 'string' ? data.sampleReference : ''); setSampleDeleted(false); setFeedbackIntent('idle'); setFeedbackState('idle'); setScreen('results');
      trackEvent('analysis_completed', {
        grade: data.analysis.grade,
        decision: data.analysis.decision,
        score_band: `${Math.floor(data.analysis.overall / 10) * 10}s`,
        suggestion_count: data.analysis.suggestions.length,
        hard_gate_count: data.analysis.hardRequirements.length,
        unverified_gate_count: data.analysis.hardRequirements.filter((item) => item.status === 'unverified').length,
        unmet_gate_count: data.analysis.hardRequirements.filter((item) => item.status === 'not_met').length,
      });
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

  async function submitFeedback(helpful: boolean, reason: FeedbackReason) {
    if (!analysis || feedbackState === 'submitting' || feedbackState === 'submitted') return;
    setFeedbackState('submitting');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          helpful,
          reason,
          grade: analysis.grade,
          scoreBand: `${Math.floor(analysis.overall / 10) * 10}s`,
        }),
      });
      if (!response.ok) throw new Error('feedback_failed');
      setFeedbackState('submitted');
      trackEvent('result_feedback_submitted', { helpful, feedback_reason: reason });
    } catch {
      setFeedbackState('error');
    }
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
            <div className="workspace-header-actions">
              <div className="material-status" aria-label={language === 'zh' ? '材料状态' : 'Material status'}>
                <span className={resumeReady ? 'is-ready' : ''}>{resumeReady ? t.resumeReady : t.resumeWaiting}</span>
                <span className={jdReady ? 'is-ready' : ''}>{jdReady ? t.jdReady : t.jdWaiting}</span>
              </div>
              {!resumeReady && !jdReady && <button type="button" className="demo-material-button" onClick={activateDemo}>{t.demoAction}<span aria-hidden="true">↗</span></button>}
            </div>
          </header>

          <div className="materials-grid">
            <article className="material-card">
              <header><div><h2>{t.resumeTitle}</h2><p>{t.resumeBody}</p></div><span className={resumeReady ? 'material-check is-ready' : 'material-check'}>{resumeReady ? '✓' : '-'}</span></header>
              {baseResume && <div className="base-resume-tools" aria-label={t.baseResumeSaved}>
                <div><b>{t.baseResumeSaved}</b><small>{t.baseResumeHint}</small></div>
                <div className="base-resume-actions">
                  <button type="button" onClick={useSavedBaseResume}>{t.useBaseResume}</button>
                  <button type="button" className="base-resume-clear" onClick={clearBaseResume}>{t.clearBaseResume}</button>
                </div>
              </div>}
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
                  {resumeText && <details className="parsed-review" open={resumeNeedsReview}><summary>{resumeFile ? t.reviewResume : t.restoredResume}<span>{resumeText.length.toLocaleString()} {t.characters}</span></summary><textarea aria-label={t.resumeTitle} value={resumeText} rows={12} onChange={(event) => changeResumeText(event.target.value)} /></details>}
                </>
              ) : <label className="material-textarea"><textarea aria-label={t.resumeTitle} value={resumeText} rows={15} placeholder={t.resumePlaceholder} onChange={(event) => changeResumeText(event.target.value)} /><small>{resumeText.length.toLocaleString()} {t.characters}</small></label>}
              {resumeReady && !baseResumeMatches && <button type="button" className="base-resume-save" onClick={saveBaseResume}>{baseResume ? t.updateBaseResume : t.saveBaseResume}<span aria-hidden="true">＋</span></button>}
              {resumeReady && !baseResume && <p className="local-save-hint">{t.baseResumeHint}</p>}
              {baseMessage && <p className="inline-note" role="status">{baseMessage}</p>}
            </article>

            <article className="material-card">
              <header><div><h2>{t.jdTitle}</h2><p>{t.jdBody}</p></div><span className={jdReady ? 'material-check is-ready' : 'material-check'}>{jdReady ? '✓' : '-'}</span></header>
              <label className={`jd-file-upload${jdState === 'ready' && jdFile ? ' is-success' : ''}`}>
                <input type="file" accept={JD_FILE_ACCEPT} onChange={handleJdFile} />
                <span className="file-type" aria-hidden="true">{jdFile ? resumeFileTag(jdFile) : '＋'}</span>
                <span><b>{jdState === 'working' ? t.jdReading : jdFile ? jdFileName : t.jdUpload}</b><small>{jdFile ? `${(jdFile.size / 1024 / 1024).toFixed(2)} MB` : t.jdUploadHint}</small></span>
              </label>
              <div className="material-or"><span>{language === 'zh' ? '或粘贴' : 'or paste'}</span></div>
              <label className="universal-jd"><textarea aria-label={t.jdTitle} value={jdEntry} rows={11} placeholder={t.jdPlaceholder} onChange={(event) => handleJdEntry(event.target.value)} />{!looksLikeUrl && <small>{jdEntry.length.toLocaleString()} {t.characters}</small>}</label>
              {looksLikeUrl && <button type="button" className="parse-link-button" disabled={jdState === 'working'} onClick={parseJobLink}>{jdState === 'working' ? t.parsingLink : t.parseLink}<span aria-hidden="true">→</span></button>}
              {jdSource && <p className="source-detected"><span>{t.detected}</span><b>{jdSource}</b></p>}
              {jdMessage && <p className={jdState === 'error' ? 'inline-error' : 'inline-note'} role="status">{jdMessage}</p>}
              {looksLikeUrl && jdText && <details className="parsed-review"><summary>{t.reviewJd}<span>{jdText.length.toLocaleString()} {t.characters}</span></summary><textarea aria-label={t.jdTitle} value={jdText} rows={12} onChange={(event) => changeParsedJd(event.target.value)} /></details>}
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
          <header className="workbench-heading"><div><h1 id="match-workbench-title">{t.matchTitle}</h1><p>{t.matchBody}</p></div></header>
          {(sampleReference || sampleDeleted) && <div className="sample-receipt"><span>{sampleDeleted ? t.sampleDeleted : `${t.sampleSaved} · ${sampleReference.slice(0, 8)}`}</span>{sampleReference && <button type="button" onClick={deleteSavedSample}>{t.sampleDelete}</button>}</div>}
          <div className="result-decision-grid">
            <article className={`result-verdict decision-${analysis.decision}`}><div className="decision-primary"><span>{t.decisionLabel}</span><strong>{decisionCopy}</strong><b>{decisionNote}</b></div><div className="decision-summary"><blockquote>{analysis.summary}</blockquote><p><span>{t.scoreLabel}</span><b>{analysis.overall}<small>/100</small></b></p></div><small>{t.scoreMethod}</small></article>
            <article className="result-priorities"><h2>{t.nextFocusTitle}</h2>{priorityEvidence.length ? <ol>{priorityEvidence.map((item) => <li key={item.requirement}><span>{item.importance}</span><p>{item.requirement}</p></li>)}</ol> : <p className="priority-empty">{t.nextFocusEmpty}</p>}</article>
          </div>
          <div className="result-dimensions">{[
              { label: t.mustCoverage, value: analysis.scoring.mustCoverage, note: t.mustNote },
              { label: t.importantCoverage, value: analysis.scoring.importantCoverage, note: t.importantNote },
              { label: t.verifiedCoverage, value: analysis.scoring.verifiedEvidence, note: `${t.verifiedNote} · ${analysis.scoring.totalRequirements}` },
            ].map((dimension) => <article key={dimension.label}><header><span>{dimension.label}</span><b>{dimension.value === null ? '-' : `${dimension.value}%`}</b></header><p>{dimension.note}</p></article>)}</div>
          <section className="hard-requirements" aria-labelledby="hard-requirements-title"><header><div><h2 id="hard-requirements-title">{t.hardTitle}</h2><p>{t.hardBody}</p></div><span>{analysis.hardRequirements.length}</span></header>{analysis.hardRequirements.length ? <div>{analysis.hardRequirements.map((item, index) => <article key={`${item.requirement}-${index}`}><div><span className={`hard-status status-${item.status}`}>{hardStatusCopy[item.status]}</span><small>{hardCategoryCopy[item.category]}</small></div><h3>{item.requirement}</h3><p>{item.rationale}</p>{item.resumeEvidence.length > 0 && <blockquote><span>{t.hardEvidence}</span>{item.resumeEvidence.join(' / ')}</blockquote>}</article>)}</div> : <p className="hard-empty">{t.hardEmpty}</p>}</section>
          <div className="signal-grid"><section><h2>{t.coveredTitle}</h2><div className="term-cloud">{analysis.coveredTerms.map((term) => <span key={term}>{term}</span>)}</div></section><section className="missing-signals"><h2>{t.missingTitle}</h2><div className="term-cloud">{analysis.missingTerms.map((term) => <span key={term}>{term}</span>)}</div><p>{t.missingAdvice}</p></section></div>
          <details className="evidence-section"><summary><div><h2>{t.evidenceTitle}</h2><p>{t.evidenceBody}</p></div><span>{analysis.evidence.length}</span></summary><div className="evidence-list">{analysis.evidence.map((item, index) => <article key={`${item.requirement}-${index}`}><div className="evidence-topline"><span className={`evidence-status status-${item.status}`}>{statusCopy[item.status]}</span><small>{item.importance}</small></div><p className="evidence-requirement">{item.requirement}</p>{item.resumeEvidence.length ? <blockquote><span>{t.evidenceQuote}</span>{item.resumeEvidence.join(' / ')}</blockquote> : <small>{t.noMatchedTerms}</small>}<p className="evidence-rationale"><span>{t.whyMatch}</span>{item.rationale}</p></article>)}</div></details>
          <section className="result-feedback" aria-labelledby="result-feedback-title">
            <div><h2 id="result-feedback-title">{t.feedbackTitle}</h2><p>{t.feedbackBody}</p></div>
            {feedbackState === 'submitted' ? <p className="feedback-thanks" role="status">{t.feedbackThanks}</p> : <div className="feedback-control">
              <div className="feedback-primary"><button type="button" disabled={feedbackState === 'submitting'} onClick={() => submitFeedback(true, 'helpful')}>{t.feedbackYes}</button><button type="button" aria-expanded={feedbackIntent === 'negative'} disabled={feedbackState === 'submitting'} onClick={() => { setFeedbackIntent('negative'); setFeedbackState('idle'); }}>{t.feedbackNo}</button></div>
              {feedbackIntent === 'negative' && <div className="feedback-reasons"><span>{t.feedbackWhy}</span>{([
                ['score_unfair', t.feedbackScore], ['evidence_missed', t.feedbackEvidence], ['suggestions_weak', t.feedbackSuggestions], ['unclear', t.feedbackUnclear], ['other', t.feedbackOther],
              ] as Array<[FeedbackReason, string]>).map(([reason, label]) => <button key={reason} type="button" disabled={feedbackState === 'submitting'} onClick={() => submitFeedback(false, reason)}>{label}</button>)}</div>}
              {feedbackState === 'error' && <p className="feedback-error" role="alert">{t.feedbackError}</p>}
            </div>}
          </section>
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
          <section className={`fact-audit${factChanges.length ? '' : ' is-clear'}`} aria-labelledby="fact-audit-title">
            <header>
              <div><h2 id="fact-audit-title">{t.factTitle}</h2><p>{t.factBody}</p></div>
              {factChanges.length > 0 && <span>{confirmedFactChanges}/{factChanges.length} {t.factProgress}</span>}
            </header>
            {factChanges.length > 0 ? (
              <div className="fact-change-list">
                {factChanges.map((item) => (
                  <label key={item.id} className={factConfirmations[item.id] ? 'is-confirmed' : ''}>
                    <input type="checkbox" checked={Boolean(factConfirmations[item.id])} onChange={(event) => toggleFactConfirmation(item.id, item.category, event.target.checked)} />
                    <span><small>{factCategoryCopy[item.category]}</small><b>{item.value}</b><em>{t.factConfirm}</em></span>
                  </label>
                ))}
              </div>
            ) : <p className="fact-audit-clear"><span aria-hidden="true">✓</span>{t.factClear}</p>}
          </section>
          <div className="review-view-switch" role="group" aria-label={t.reviewCanvas}><button type="button" aria-pressed={reviewView === 'edit'} onClick={() => setReviewView('edit')}>{t.reviewEdit}</button><button type="button" aria-pressed={reviewView === 'preview'} onClick={() => setReviewView('preview')}>{t.reviewPreview}</button></div>
          <div className={`text-review-grid view-${reviewView}`}>
            <section className="review-editor-column" aria-label={t.reviewEdit}>
              <details className="adopted-change-list"><summary><strong>{t.reviewChanges}</strong><span>{adoptedSuggestions.length}</span></summary><div>{adoptedSuggestions.length ? adoptedSuggestions.map((suggestion, index) => <details key={suggestion.id}><summary><span>{String(index + 1).padStart(2, '0')}</span>{suggestion.targetSection}</summary><div><small>{t.reviewOriginal}</small><p>{suggestion.originalText}</p><small>{t.reviewFinal}</small><p>{suggestionNotes[suggestion.id] ?? suggestion.revisedText}</p></div></details>) : <p className="adopted-change-empty">{t.reviewNoChanges}</p>}</div></details>
              <ResumeStructuredEditor blocks={reviewPreviewBlocks} language={language} onChange={editReviewBlocks} rawValue={reviewDraft} onRawChange={editReviewDraft} canUndo={canUndoReview} canRedo={canRedoReview} onUndo={undoReviewEdit} onRedo={redoReviewEdit} />
            </section>
            <aside className="review-preview-column" aria-label={t.reviewCanvas}>
              <div className="review-toolbar"><div><strong>{t.reviewPreview}</strong><small>{t.reviewPreviewHint}</small></div><span>{t.reviewPagesApprox} {previewPages} {language === 'en' && previewPages !== 1 ? 'pages' : t.reviewPage} · {reviewDraft.length.toLocaleString()} {t.reviewCharacters}</span></div>
              {(incompleteReviewBlocks > 0 || previewPages > 2) && <div className={incompleteReviewBlocks > 0 ? 'review-quality-status is-warning' : 'review-quality-status'} role="status">{incompleteReviewBlocks > 0 ? `${incompleteReviewBlocks} ${t.reviewIncomplete}` : t.reviewLong}</div>}
              <div className="review-stage" ref={previewMeasureRef}><ResumeDocument blocks={reviewPreviewBlocks} template={selectedTemplate} className="export-document" /></div>
            </aside>
          </div>
          {reviewReady && !factReviewReady && <p className="fact-export-block" role="status">{t.factBlocked}</p>}
          <div className="pdf-readiness" role="status"><span aria-hidden="true">PDF</span><div><strong>{t.pdfCheckTitle}</strong><p>{t.pdfCheckBody}</p></div></div>
          {pdfExportState === 'error' && <p className="analysis-error" role="alert">{t.pdfError}</p>}
          <div className="text-review-actions">
            <button type="button" onClick={() => setScreen('results')}><span aria-hidden="true">←</span>{t.reviewBack}</button>
            <div className="review-export-actions">
              <button type="button" disabled={!exportReady || pdfExportState === 'working'} onClick={downloadResumePdf}>{pdfExportState === 'working' ? t.pdfGenerating : t.exportPrint}<span aria-hidden="true">→</span></button>
              <button type="button" disabled={!exportReady} onClick={downloadResumeDocx}>{t.exportDocx}</button>
              <details className="export-more"><summary>{t.exportMore}</summary><button type="button" disabled={!exportReady} onClick={downloadResumeHtml}>{t.exportDownload}</button></details>
              {draftConfirmed && <button type="button" className="is-secondary" onClick={startAnotherMatch}>{t.exportAnother}</button>}
            </div>
          </div>
          <p className="export-print-hint">{t.exportPrintHint}</p>
        </section>
      ) : null}
      <SiteFooter />
    </main>
  );
}
