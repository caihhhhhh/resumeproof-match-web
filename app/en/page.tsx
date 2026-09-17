import type { Metadata } from 'next';
import HomeExperience from '../components/home-experience';

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

export default function EnglishLandingPage() { return <HomeExperience initialLanguage="en" />; }
