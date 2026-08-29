import type { Metadata } from 'next';
import { InfoPage } from '../components/info-page';

export const metadata: Metadata = {
  title: 'About — ResumeProof Match',
  description: 'Why ResumeProof Match uses verified resume evidence before rewriting.',
  alternates: { canonical: '/about' },
  openGraph: {
    type: 'website', url: '/about', title: 'About — ResumeProof Match',
    description: 'Why ResumeProof Match uses verified resume evidence before rewriting.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeProof Match evidence-first job matching' }],
  },
};

export default function AboutPage() { return <InfoPage kind="about" />; }
