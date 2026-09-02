import type { Metadata } from 'next';
import { JsonLd } from '../../components/json-ld';
import { guideFaqs, SeoGuide } from '../../components/seo-guide';
import { SITE_ORIGIN } from '../../lib/site';

export const metadata: Metadata = {
  title: 'How to match a resume to a job description | ResumeProof Match',
  description: 'A six-step, evidence-first method for separating role fit, resume evidence, and writing quality without relying on keyword overlap alone.',
  alternates: { canonical: '/en/guide', languages: { 'zh-CN': '/guide', en: '/en/guide', 'x-default': '/guide' } },
  openGraph: {
    type: 'article', url: '/en/guide', title: 'How to match a resume to a job description',
    description: 'Use verifiable resume evidence to separate role fit, evidence coverage, and resume expression.',
    publishedTime: '2026-09-02T00:00:00Z', modifiedTime: '2026-09-02T00:00:00Z',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeProof Match evidence-first resume and JD matching' }],
  },
};

export default function EnglishGuidePage() {
  return <><JsonLd data={{
    '@context': 'https://schema.org', '@graph': [
      {
        '@type': 'Article', headline: 'How do you tell whether a resume actually matches a job description?',
        description: 'Build an auditable evidence match between job requirements and resume excerpts.',
        datePublished: '2026-09-02', dateModified: '2026-09-02', inLanguage: 'en',
        mainEntityOfPage: `${SITE_ORIGIN}/en/guide`, author: { '@type': 'Organization', name: 'ResumeProof Match contributors' },
        image: `${SITE_ORIGIN}/og.png`,
      },
      {
        '@type': 'FAQPage', mainEntity: guideFaqs.en.map(([question, answer]) => ({
          '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ],
  }} /><SeoGuide language="en" /></>;
}
