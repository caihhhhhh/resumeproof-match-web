import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '../components/site-footer';

export const metadata: Metadata = {
  title: 'AI resume and job-description matching | ResumeProof Match',
  description: 'Compare a resume with a job description, verify each match against source evidence, review suggested edits, and export an approved resume.',
  alternates: { canonical: '/en', languages: { 'zh-CN': '/', en: '/en', 'x-default': '/' } },
  openGraph: {
    type: 'website', url: '/en', title: 'AI resume and job-description matching | ResumeProof Match',
    description: 'See whether the role fits, what the resume can prove, and which edits are worth making.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeProof Match evidence-first job matching' }],
  },
};

const sections = [
  {
    title: 'See the evidence behind the match',
    body: 'ResumeProof Match maps each job requirement to a verifiable resume excerpt. Equivalent wording and transferable experience can count, but a conclusion is not treated as supported without source evidence.',
  },
  {
    title: 'Separate fit from writing quality',
    body: 'Role fit, evidence coverage, and resume expression answer different questions. Keeping them separate prevents polished wording from hiding a real qualification gap.',
  },
  {
    title: 'Approve every change',
    body: 'Review the reason, original text, and proposed version for each edit. Only the suggestions you adopt enter the full draft, which must be reviewed again before export.',
  },
] as const;

export default function EnglishLandingPage() {
  return (
    <main className="info-page-shell">
      <nav className="info-nav" aria-label="English navigation">
        <Link href="/en" className="footer-wordmark">ResumeProof Match</Link>
        <Link className="language-button" href="/">中文</Link>
      </nav>
      <article className="info-article guide-article">
        <header className="info-hero">
          <p>Evidence-first job matching</p>
          <h1>See if the role fits. Then prove why.</h1>
          <div>
            <p>Compare a resume with a target job description, inspect requirement-level evidence, review truthful edits, and export only after the complete draft is approved.</p>
            <Link className="primary-link guide-action" href="/match/new">Match a resume to a job<span aria-hidden="true">→</span></Link>
          </div>
        </header>
        <div className="info-sections">
          {sections.map((section, index) => <section key={section.title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div><h2>{section.title}</h2><p>{section.body}</p></div>
          </section>)}
          <section><span>04</span><div><h2>Understand the method</h2><p>Read the evidence-first framework, common matching mistakes, and answers to practical resume questions.</p>
            <Link className="text-link info-external-link" href="/en/guide">Read the resume matching guide<span aria-hidden="true">→</span></Link>
          </div></section>
        </div>
      </article>
      <SiteFooter forceLanguage="en" />
    </main>
  );
}
