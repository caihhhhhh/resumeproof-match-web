import type { Metadata } from 'next';
import { InfoPage } from '../components/info-page';

export const metadata: Metadata = {
  title: 'Privacy — ResumeProof Match',
  description: 'How ResumeProof Match reads, processes, and temporarily stores resume and job description data.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    type: 'website', url: '/privacy', title: 'Privacy — ResumeProof Match',
    description: 'How ResumeProof Match reads, processes, and temporarily stores resume and job description data.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeProof Match evidence-first job matching' }],
  },
};

export default function PrivacyPage() { return <InfoPage kind="privacy" />; }
