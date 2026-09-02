'use client';

import Link from 'next/link';
import { useLanguage } from './language-context';
import { openAnalyticsSettings } from './google-analytics';

const copy = {
  zh: {
    about: '关于', guide: '匹配方法', privacy: '隐私政策', terms: '使用条款', analytics: '分析设置', github: 'GitHub', feedback: '反馈',
    principle: '先核对证据，再修改简历。', disclaimer: 'AI 匹配结果仅供求职决策参考，不代表招聘结果。',
  },
  en: {
    about: 'About', guide: 'Matching guide', privacy: 'Privacy', terms: 'Terms', analytics: 'Analytics settings', github: 'GitHub', feedback: 'Feedback',
    principle: 'Verify the evidence before rewriting.', disclaimer: 'AI match results support job-search decisions; they do not predict hiring outcomes.',
  },
} as const;

const repository = 'https://github.com/caihhhhhh/resumeproof-match-web';

export function SiteFooter({ forceLanguage }: { forceLanguage?: 'zh' | 'en' } = {}) {
  const context = useLanguage();
  const language = forceLanguage ?? context.language;
  const t = copy[language];
  const icpNumber = process.env.NEXT_PUBLIC_ICP_NUMBER?.trim();

  return (
    <footer className="site-footer">
      <div className="footer-intro">
        <Link href="/" className="footer-wordmark" aria-label="ResumeProof Match home">ResumeProof Match</Link>
        <p>{t.principle}</p>
      </div>
      <nav className="footer-links" aria-label={language === 'zh' ? '页尾导航' : 'Footer navigation'}>
        <Link href="/about">{t.about}</Link>
        <Link href={language === 'zh' ? '/guide' : '/en/guide'}>{t.guide}</Link>
        <Link href="/privacy">{t.privacy}</Link>
        <Link href="/terms">{t.terms}</Link>
        <button type="button" onClick={openAnalyticsSettings}>{t.analytics}</button>
        <a href={repository} target="_blank" rel="noreferrer">{t.github}</a>
        <a href={`${repository}/issues`} target="_blank" rel="noreferrer">{t.feedback}</a>
      </nav>
      <div className="footer-meta">
        <span>© {new Date().getFullYear()} ResumeProof Match</span>
        <span>{t.disclaimer}</span>
        {icpNumber ? <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">{icpNumber}</a> : null}
      </div>
    </footer>
  );
}
