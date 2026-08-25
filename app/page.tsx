'use client';

import Link from 'next/link';
import { useLanguage } from './components/language-context';
import { SiteFooter } from './components/site-footer';
import { trackEvent } from './lib/analytics';

const copy = {
  zh: {
    navHow: '工作方式',
    navPrivacy: '隐私原则',
    kicker: '证据优先的岗位匹配',
    titleOne: '先看清是否适合，',
    titleTwo: '再证明为什么。',
    intro: '不是给简历打一个模糊分数，而是逐条核对岗位要求、真实经历和简历表达，再决定值不值得申请。',
    primary: '开始一次匹配',
    secondary: '查看完整示例',
    example: '示例结果',
    lab: 'Alignment Lab',
    ready: '示例校准完成',
    resumeSignal: '简历证据',
    matchLens: '匹配关系',
    jdSignal: '岗位要求',
    resumeSignals: ['独立负责 Campaign', 'GA4 转化追踪', 'Web3 增长项目'],
    jobSignals: ['端到端 Campaign', '效果数据分析', '合作伙伴增长'],
    found: '条证据成立',
    confirm: '项需要确认',
    methodKicker: '三个判断，不是一个总分',
    methodTitle: '适合 ≠ 有证据 ≠ 写清楚',
    dimensions: [
      ['岗位适配', '能不能做'],
      ['证据覆盖', '能不能证明'],
      ['简历表达', '有没有说清楚'],
    ],
    flowKicker: '三步完成一次校准',
    flowTitle: '材料确认后，才开始判断。',
    steps: ['添加材料', '审核匹配与建议', '确认文字并导出'],
    privacyKicker: '一条写作底线',
    privacyTitle: '没有证据，就不写进简历。',
    privacyBody: '文件优先在浏览器读取，草稿仅在当前标签页临时保留，关闭标签页后自动清除。开始分析后，简历与 JD 文字会发送至 AI 服务；扫描文件可能发送至视觉识别服务。所有修改仍需由你确认后才能导出。',
    finalAction: '开始匹配',
  },
  en: {
    navHow: 'How it works',
    navPrivacy: 'Privacy',
    kicker: 'Evidence-first job matching',
    titleOne: 'See if you fit.',
    titleTwo: 'Then prove why.',
    intro: 'Not another vague resume score. Verify every requirement against real experience and resume evidence before deciding whether to apply.',
    primary: 'Start a match',
    secondary: 'View a full example',
    example: 'Example result',
    lab: 'Alignment Lab',
    ready: 'Example calibrated',
    resumeSignal: 'Resume evidence',
    matchLens: 'Match lens',
    jdSignal: 'JD requirement',
    resumeSignals: ['Campaign ownership', 'GA4 conversion tracking', 'Web3 growth projects'],
    jobSignals: ['End-to-end campaigns', 'Performance analysis', 'Partner activation'],
    found: 'signals supported',
    confirm: 'item to confirm',
    methodKicker: 'Three decisions, not one score',
    methodTitle: 'Fit ≠ evidence ≠ expression',
    dimensions: [
      ['Role fit', 'Can you do it?'],
      ['Evidence', 'Can you prove it?'],
      ['Expression', 'Does the resume say it?'],
    ],
    flowKicker: 'Three steps to one alignment',
    flowTitle: 'The decision starts after source review.',
    steps: ['Add both sources', 'Review match and edits', 'Confirm text and export'],
    privacyKicker: 'One writing rule',
    privacyTitle: 'No evidence. No claim.',
    privacyBody: 'Files are read in your browser, and drafts stay only in the current tab until it is closed. Once analysis starts, resume and JD text is sent to an AI service; scanned files may use a visual recognition service. Nothing exports until you confirm the final text.',
    finalAction: 'Start matching',
  },
} as const;

export default function Home() {
  const { language, toggleLanguage } = useLanguage();
  const t = copy[language];

  return (
    <main className="site-shell">
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="ResumeProof Match home">
          <span className="wordmark-mark" aria-hidden="true">R/</span>
          <span>ResumeProof Match</span>
        </a>
        <div className="nav-links">
          <a href="#how">{t.navHow}</a>
          <a href="#privacy">{t.navPrivacy}</a>
          <button type="button" className="language-button" onClick={toggleLanguage} aria-label={language === 'zh' ? 'Switch to English' : '切换到中文'}>
            {language === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
      </nav>

      <section id="top" className="hero-section" aria-labelledby="hero-title">
        <div className="hero-content">
          <p className="hero-kicker">{t.kicker}</p>
          <h1 id="hero-title">
            <span className="hero-line">{t.titleOne}</span>
            <span className="hero-line hero-line-accent">{t.titleTwo}</span>
          </h1>
          <p className="hero-copy">{t.intro}</p>
          <div className="hero-actions">
            <Link className="primary-link" href="/match/new" onClick={() => trackEvent('match_started', { source: 'homepage' })}>{t.primary}<span aria-hidden="true">→</span></Link>
            <a className="text-link" href="#example">{t.secondary}<span aria-hidden="true">↘</span></a>
          </div>
        </div>

        <div id="example" className="lab-panel" aria-label={t.example}>
          <div className="example-flag">{t.example}</div>
          <div className="lab-header">
            <span>{t.lab}</span>
            <span className="lab-status"><i aria-hidden="true" />{t.ready}</span>
          </div>
          <div className="lab-columns" aria-hidden="true">
            <span>{t.resumeSignal}</span><span>{t.matchLens}</span><span>{t.jdSignal}</span>
          </div>
          <div className="signal-list">
            {t.resumeSignals.map((resume, index) => (
              <div className="signal-row" key={resume}>
                <span className="signal-source">{resume}</span>
                <span className={`signal-track signal-track-${index + 1}`} aria-hidden="true">
                  <i className="signal-node signal-node-left" /><i className="signal-line" /><i className="signal-node signal-node-right" />
                </span>
                <span className="signal-target">{t.jobSignals[index]}</span>
              </div>
            ))}
          </div>
          <div className="lab-summary">
            <span><b>3</b> {t.found}</span><span><b>1</b> {t.confirm}</span>
          </div>
        </div>
      </section>

      <section id="how" className="method-section">
        <p className="section-eyebrow">{t.methodKicker}</p>
        <h2 className="equation-title">{t.methodTitle}</h2>
        <div className="dimension-line">
          {t.dimensions.map(([title, body]) => (
            <div key={title}><b>{title}</b><span>{body}</span></div>
          ))}
        </div>
      </section>

      <section className="flow-section">
        <p className="section-eyebrow">{t.flowKicker}</p>
        <div className="flow-topline"><h2>{t.flowTitle}</h2><span aria-hidden="true">→</span></div>
        <ol className="flow-track">
          {t.steps.map((title, index) => <li key={title}><span>0{index + 1}</span><b>{title}</b></li>)}
        </ol>
      </section>

      <section id="privacy" className="privacy-section final-cta">
        <p className="section-eyebrow">{t.privacyKicker}</p>
        <h2>{t.privacyTitle}</h2>
        <p>{t.privacyBody}</p>
        <Link className="primary-link primary-link-light" href="/match/new">{t.finalAction}<span aria-hidden="true">→</span></Link>
      </section>
      <SiteFooter />
    </main>
  );
}
