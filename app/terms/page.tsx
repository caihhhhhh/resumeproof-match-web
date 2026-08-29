import type { Metadata } from 'next';
import { InfoPage } from '../components/info-page';

export const metadata: Metadata = {
  title: 'Terms — ResumeProof Match',
  description: 'The service boundaries and responsible-use terms for ResumeProof Match.',
  alternates: { canonical: '/terms' },
  openGraph: {
    type: 'website', url: '/terms', title: 'Terms — ResumeProof Match',
    description: 'The service boundaries and responsible-use terms for ResumeProof Match.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeProof Match evidence-first job matching' }],
  },
};

export default function TermsPage() { return <InfoPage kind="terms" />; }
