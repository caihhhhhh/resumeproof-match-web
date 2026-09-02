import Link from 'next/link';
import { SiteFooter } from './site-footer';

type GuideLanguage = 'zh' | 'en';

const methodSource = 'https://github.com/caihhhhhh/resume-proof-match/blob/main/references/matching.md';

const copy = {
  zh: {
    alternate: 'English', alternateHref: '/en/guide', eyebrow: '简历匹配方法',
    title: '如何判断简历与 JD 是否真正匹配？',
    intro: '简历与 JD 的匹配度不是关键词重合率。更可靠的方法是：先拆解岗位要求，再用简历原句核对每项证据，分开判断“能不能做”“能不能证明”和“有没有写清楚”。',
    updated: '更新日期：2026 年 9 月 2 日',
    dimensionsTitle: '先分开三个问题',
    dimensionsIntro: '一份写得漂亮的简历，不代表候选人真正满足岗位要求。因此需要把三个判断分开：',
    dimensions: [
      ['岗位适配', '候选人的真实经验是否覆盖岗位的必要任务和硬性条件。'],
      ['证据覆盖', '简历是否包含可核对的动作、场景、工具、结果或责任边界。'],
      ['简历表达', '已经存在的真实经验，是否被写成招聘方能快速理解的表达。'],
    ],
    stepsTitle: '六步完成一次可核对的匹配',
    steps: [
      '提取 JD 中的任务、工具、经验、行业背景、语言和地区要求。',
      '标记必须项、重要项和加分项，不让普通关键词稀释硬门槛。',
      '为每条要求寻找简历原句，同时识别同义表达和可迁移经验。',
      '将结果分成“已证实”“部分证据”和“尚无证据”，而不是强行命中。',
      '只改写已有真实证据但表达不清的内容；没有经历就保留为差距。',
      '导出前审核全文，重点核对公司、职位、日期、数字、工具和专有名词。',
    ],
    mistakesTitle: '常见误区',
    mistakes: [
      '把 ATS 关键词数量当成岗位胜任力。',
      '用漂亮排版或空泛动词掩盖关键必须项缺口。',
      '把“熟悉”“参与”直接等同于独立负责和结果所有权。',
      '为了提高分数，加入无法用真实经历证明的工具或指标。',
    ],
    faqTitle: '常见问题',
    faqs: [
      ['简历和 JD 关键词越多越好吗？', '不是。关键词只有在与真实经验、具体动作或结果一致时才有价值。单纯重复 JD 用词会降低可信度。'],
      ['匹配度多少才值得投递？', '不应只看总分。先检查关键必须项是否有证据，再判断差距是否可以通过表达修正，还是确实缺少经验。'],
      ['可以把没做过的内容写进简历吗？', '不可以。改写只能提高已有经验的可见度，不能把缺失的经验变成已经做过。'],
      ['为什么需要审核 AI 修改稿？', 'AI 可能误解日期、指标、责任边界或专有名词。完整文字审核能避免正确的局部建议在合并后产生新错误。'],
    ],
    sourceTitle: '方法与工具',
    sourceBody: '这套方法的匹配规则、证据状态和交付边界已在开源仓库中公开。你可以直接使用网页版，也可以查看方法原文。',
    methodLink: '查看开源匹配模型', action: '用自己的简历与 JD 试一次',
  },
  en: {
    alternate: '中文', alternateHref: '/guide', eyebrow: 'Resume matching method',
    title: 'How do you tell whether a resume actually matches a job description?',
    intro: 'Resume–JD fit is not a keyword-overlap percentage. A more reliable method separates three questions: can the candidate do the work, can the resume prove it with verifiable evidence, and does the document express that evidence clearly enough for a recruiter to understand?',
    updated: 'Last updated: September 2, 2026',
    dimensionsTitle: 'Separate three different decisions',
    dimensionsIntro: 'A polished resume does not prove that a candidate meets the role. Evaluate these signals independently:',
    dimensions: [
      ['Role fit', 'Whether the candidate’s real experience covers the role’s essential work and hard requirements.'],
      ['Evidence coverage', 'Whether the resume contains verifiable actions, contexts, tools, outcomes, or ownership boundaries.'],
      ['Resume expression', 'Whether supported experience is written in language a recruiter can understand quickly.'],
    ],
    stepsTitle: 'Six steps for an auditable match',
    steps: [
      'Extract responsibilities, tools, experience, industry, language, and location requirements from the JD.',
      'Classify must-have, important, and bonus requirements so minor keywords do not dilute hard gates.',
      'Find a resume excerpt for each requirement while recognizing equivalent wording and transferable experience.',
      'Label each mapping supported, partial evidence, or no evidence instead of forcing a match.',
      'Rewrite only supported experience that is expressed poorly; keep missing experience visible as a gap.',
      'Review the complete draft and verify employers, titles, dates, metrics, tools, and proper nouns before export.',
    ],
    mistakesTitle: 'Common mistakes',
    mistakes: [
      'Treating ATS keyword count as evidence of role readiness.',
      'Using polished formatting or vague action verbs to hide a must-have gap.',
      'Treating familiarity or participation as independent ownership and measurable results.',
      'Adding tools or metrics that cannot be supported by real experience just to improve a score.',
    ],
    faqTitle: 'Frequently asked questions',
    faqs: [
      ['Should a resume repeat as many JD keywords as possible?', 'No. A keyword is useful only when it accurately describes real experience, a specific action, or a result. Repeating JD wording without evidence reduces credibility.'],
      ['What match score is high enough to apply?', 'Do not use the total score alone. Check critical must-haves first, then decide whether each gap is an expression problem or a genuine experience gap.'],
      ['Can I add a requirement I have never done?', 'No. Rewriting can make existing experience easier to see; it cannot turn missing experience into completed work.'],
      ['Why review the complete AI-edited draft?', 'AI can misread dates, metrics, ownership boundaries, and proper nouns. Full-text review catches errors created when individually reasonable suggestions are merged.'],
    ],
    sourceTitle: 'Method and tool',
    sourceBody: 'The matching rules, evidence states, and delivery boundaries behind this method are public in the open-source repository. Use the browser workflow directly or inspect the written matching contract.',
    methodLink: 'Read the open-source matching model', action: 'Try it with your own resume and JD',
  },
} as const;

export const guideFaqs = { zh: copy.zh.faqs, en: copy.en.faqs } as const;

export function SeoGuide({ language }: { language: GuideLanguage }) {
  const t = copy[language];
  return (
    <main className="info-page-shell">
      <nav className="info-nav" aria-label={language === 'zh' ? '指南导航' : 'Guide navigation'}>
        <Link href={language === 'zh' ? '/' : '/en'} className="footer-wordmark">ResumeProof Match</Link>
        <Link className="language-button" href={t.alternateHref}>{t.alternate}</Link>
      </nav>
      <article className="info-article guide-article">
        <header className="info-hero">
          <p>{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <div><p>{t.intro}</p><small>{t.updated}</small></div>
        </header>
        <div className="info-sections">
          <section>
            <span>01</span>
            <div><h2>{t.dimensionsTitle}</h2><p>{t.dimensionsIntro}</p><div className="guide-table">
              {t.dimensions.map(([name, description]) => <div key={name}><strong>{name}</strong><p>{description}</p></div>)}
            </div></div>
          </section>
          <section><span>02</span><div><h2>{t.stepsTitle}</h2><ol className="guide-steps">
            {t.steps.map((step) => <li key={step}>{step}</li>)}
          </ol></div></section>
          <section><span>03</span><div><h2>{t.mistakesTitle}</h2><ul>{t.mistakes.map((item) => <li key={item}>{item}</li>)}</ul></div></section>
          <section><span>04</span><div><h2>{t.faqTitle}</h2><div className="guide-faq">
            {t.faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </div></div></section>
          <section><span>05</span><div><h2>{t.sourceTitle}</h2><p>{t.sourceBody}</p>
            <a className="text-link info-external-link" href={methodSource} target="_blank" rel="noreferrer">{t.methodLink}<span aria-hidden="true">↗</span></a>
            <Link className="primary-link guide-action" href="/match/new">{t.action}<span aria-hidden="true">→</span></Link>
          </div></section>
        </div>
      </article>
      <SiteFooter forceLanguage={language} />
    </main>
  );
}
