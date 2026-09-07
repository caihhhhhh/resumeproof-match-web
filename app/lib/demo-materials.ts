import type { MatchAnalysis, OptimizationSuggestion } from './match-analysis';

type DemoMaterials = {
  resume: string;
  jd: string;
  analysis: MatchAnalysis;
};

const zhResume = `林晨
增长营销｜Campaign 运营
demo@example.com

个人总结
3 年增长营销经验，负责付费渠道、内容协同与活动复盘，能够结合转化数据调整素材和预算。

工作经历
Example Labs｜增长营销经理｜2023.06 - 至今
• 独立负责季度广告预算及 Campaign Brief，协调设计、产品与数据团队推进素材上线。
• 通过受众与素材 A/B Test 调整投放组合，使注册成本下降 28%。
• 搭建 GA4 与 UTM 渠道看板，按周分析访问、注册和付费转化，并输出预算调整建议。

项目经历
合作伙伴增长计划
• 联合 12 家内容合作伙伴开展季度活动，跟踪激活与留存表现，推动 4 个高表现合作方进入长期合作。

教育经历
示例大学｜市场营销学士｜2019.09 - 2023.06

技能
Google Ads、Meta Ads、GA4、Excel、A/B Test、Campaign Management`;

const zhJd = `增长营销经理

岗位职责
• 负责 Campaign 从策略、预算、素材上线到效果复盘的完整流程。
• 管理付费渠道并持续优化 CPA、ROAS 与转化漏斗。
• 与产品、设计和数据团队协作，推动落地页与追踪方案优化。
• 发展内容合作伙伴，分析激活和留存表现并扩大有效合作。

任职要求
• 3 年以上增长或效果营销经验。
• 熟悉 Google Ads、Meta Ads、GA4 和 A/B Test。
• 能够独立分析数据并将结论转化为具体优化动作。
• 有合作伙伴或 Affiliate 项目经验优先。
• 英语可作为工作语言。`;

const enResume = `Alex Lin
Growth Marketing | Campaign Operations
demo@example.com

Professional Summary
Growth marketer with 3 years of experience across paid channels, content coordination, and campaign reporting. Uses conversion data to adjust creative and budget decisions.

Professional Experience
Example Labs | Growth Marketing Manager | 2023.06 - Present
• Owned quarterly advertising budgets and campaign briefs, coordinating design, product, and data teams to launch creative.
• Reduced registration cost by 28% through audience and creative A/B tests.
• Built GA4 and UTM dashboards to review traffic, registration, and paid conversion each week and recommend budget changes.

Projects
Partner Growth Program
• Ran quarterly campaigns with 12 content partners, tracked activation and retention, and moved 4 high-performing partners into ongoing programs.

Education
Example University | B.A. Marketing | 2019.09 - 2023.06

Skills
Google Ads, Meta Ads, GA4, Excel, A/B Testing, Campaign Management`;

const enJd = `Growth Marketing Manager

Responsibilities
• Own campaigns from strategy and budget through creative launch and performance review.
• Manage paid channels and continuously improve CPA, ROAS, and funnel conversion.
• Work with product, design, and data teams to improve landing pages and tracking.
• Grow content partners, analyze activation and retention, and scale effective partnerships.

Requirements
• 3+ years of growth or performance marketing experience.
• Working knowledge of Google Ads, Meta Ads, GA4, and A/B testing.
• Able to turn analysis into clear optimization actions.
• Partner or affiliate program experience is a plus.
• Professional working English.`;

function suggestion(source: string, originalText: string, revisedText: string, language: 'zh' | 'en'): OptimizationSuggestion {
  const sourceStart = source.indexOf(originalText);
  return {
    id: 'demo-rewrite-1',
    kind: 'rewrite',
    targetSection: language === 'zh' ? '工作经历' : 'Professional Experience',
    originalText,
    sourceStart,
    sourceEnd: sourceStart + originalText.length,
    revisedText,
    rationale: language === 'zh'
      ? '原文已经有明确结果，但动作与结果之间的关系可以更紧凑，让招聘方更快识别优化能力。'
      : 'The source already contains a clear result, but tightening the action-to-outcome link makes the optimization signal easier to scan.',
    expectedImpact: language === 'zh'
      ? '强化 A/B Test、投放调整和成本改善之间的因果关系。'
      : 'Clarifies the connection between A/B testing, campaign changes, and cost improvement.',
    relatedRequirement: language === 'zh' ? '持续优化 CPA 与转化漏斗' : 'Continuously improve CPA and funnel conversion',
    requiresFact: false,
  };
}

export function getDemoMaterials(language: 'zh' | 'en'): DemoMaterials {
  const resume = language === 'zh' ? zhResume : enResume;
  const jd = language === 'zh' ? zhJd : enJd;
  const original = language === 'zh'
    ? '通过受众与素材 A/B Test 调整投放组合，使注册成本下降 28%。'
    : 'Reduced registration cost by 28% through audience and creative A/B tests.';
  const revised = language === 'zh'
    ? '基于受众与素材 A/B Test 调整投放组合，推动注册成本下降 28%。'
    : 'Adjusted the campaign mix using audience and creative A/B tests, reducing registration cost by 28%.';
  const analysis: MatchAnalysis = {
    mode: 'ai',
    summary: language === 'zh'
      ? '核心 Campaign、渠道分析和跨团队协作要求均有直接证据；合作伙伴经验可以支持岗位，但英语能力仍需由候选人自行确认。'
      : 'The resume directly supports campaign ownership, channel analysis, and cross-functional work. Partner experience is relevant, while working-English ability still needs confirmation.',
    overall: 84,
    grade: 'B',
    decision: 'review_first',
    hardRequirements: language === 'zh' ? [
      { requirement: '3 年以上相关经验', category: 'experience', status: 'met', resumeEvidence: ['3 年增长营销经验'], rationale: '简历明确写出 3 年相关经验。' },
      { requirement: '英语可作为工作语言', category: 'language', status: 'unverified', resumeEvidence: [], rationale: '简历没有可核对的英语使用场景或语言等级，需要候选人确认。' },
    ] : [
      { requirement: '3+ years of relevant experience', category: 'experience', status: 'met', resumeEvidence: ['Growth marketer with 3 years of experience'], rationale: 'The resume explicitly states three years of relevant experience.' },
      { requirement: 'Professional working English', category: 'language', status: 'unverified', resumeEvidence: [], rationale: 'The resume does not provide a verifiable English level or working context, so the candidate must confirm it.' },
    ],
    scoring: {
      mustCoverage: 88,
      importantCoverage: 83,
      bonusCoverage: 70,
      verifiedEvidence: 86,
      totalRequirements: 7,
      strongCount: 5,
      partialCount: 1,
      gapCount: 1,
    },
    coveredTerms: language === 'zh'
      ? ['Campaign 全流程', 'GA4 与 UTM', 'A/B Test', '跨团队协作', '合作伙伴增长']
      : ['Campaign ownership', 'GA4 and UTM', 'A/B testing', 'Cross-functional delivery', 'Partner growth'],
    missingTerms: language === 'zh' ? ['ROAS 直接成果', '英语能力证明'] : ['Direct ROAS outcome', 'English-language evidence'],
    evidence: language === 'zh' ? [
      { requirement: '负责 Campaign 完整流程', importance: 'must', resumeEvidence: ['独立负责季度广告预算及 Campaign Brief，协调设计、产品与数据团队推进素材上线。'], rationale: '预算、Brief、素材上线和协作均有直接对应。', status: 'strong' },
      { requirement: '优化 CPA 与转化漏斗', importance: 'must', resumeEvidence: ['通过受众与素材 A/B Test 调整投放组合，使注册成本下降 28%。'], rationale: '注册成本下降直接支持 CPA 优化，ROAS 暂无证据。', status: 'partial' },
      { requirement: '熟悉 GA4 和数据分析', importance: 'must', resumeEvidence: ['搭建 GA4 与 UTM 渠道看板，按周分析访问、注册和付费转化，并输出预算调整建议。'], rationale: '工具、分析对象和后续动作均可核对。', status: 'strong' },
      { requirement: '跨团队推动落地', importance: 'important', resumeEvidence: ['协调设计、产品与数据团队推进素材上线。'], rationale: '明确列出协作团队与交付结果。', status: 'strong' },
      { requirement: '合作伙伴增长经验', importance: 'bonus', resumeEvidence: ['联合 12 家内容合作伙伴开展季度活动，跟踪激活与留存表现，推动 4 个高表现合作方进入长期合作。'], rationale: '包含合作规模、分析维度与长期转化。', status: 'strong' },
      { requirement: '3 年以上相关经验', importance: 'must', resumeEvidence: ['3 年增长营销经验'], rationale: '年限与岗位门槛直接对应。', status: 'strong' },
      { requirement: '英语可作为工作语言', importance: 'important', resumeEvidence: [], rationale: '简历没有可核对的英语使用场景或语言等级。', status: 'gap' },
    ] : [
      { requirement: 'Own campaigns end to end', importance: 'must', resumeEvidence: ['Owned quarterly advertising budgets and campaign briefs, coordinating design, product, and data teams to launch creative.'], rationale: 'Budget, briefs, launch delivery, and collaboration are directly supported.', status: 'strong' },
      { requirement: 'Improve CPA and funnel conversion', importance: 'must', resumeEvidence: ['Reduced registration cost by 28% through audience and creative A/B tests.'], rationale: 'The cost result supports CPA optimization; direct ROAS evidence is missing.', status: 'partial' },
      { requirement: 'Use GA4 and analyze performance', importance: 'must', resumeEvidence: ['Built GA4 and UTM dashboards to review traffic, registration, and paid conversion each week and recommend budget changes.'], rationale: 'The tool, analysis scope, and resulting action are all verifiable.', status: 'strong' },
      { requirement: 'Work across product, design, and data', importance: 'important', resumeEvidence: ['coordinating design, product, and data teams to launch creative.'], rationale: 'The resume names the teams and delivery outcome.', status: 'strong' },
      { requirement: 'Partner growth experience', importance: 'bonus', resumeEvidence: ['Ran quarterly campaigns with 12 content partners, tracked activation and retention, and moved 4 high-performing partners into ongoing programs.'], rationale: 'Scale, performance analysis, and continued activation are present.', status: 'strong' },
      { requirement: '3+ years of relevant experience', importance: 'must', resumeEvidence: ['Growth marketer with 3 years of experience'], rationale: 'The stated experience meets the threshold.', status: 'strong' },
      { requirement: 'Professional working English', importance: 'important', resumeEvidence: [], rationale: 'No explicit language level or English working context appears in the source.', status: 'gap' },
    ],
    metricSignals: 4,
    suggestions: [suggestion(resume, original, revised, language)],
  };
  return { resume, jd, analysis };
}
