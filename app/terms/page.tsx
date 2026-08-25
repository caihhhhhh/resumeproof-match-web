import type { Metadata } from 'next';
import { InfoPage } from '../components/info-page';

export const metadata: Metadata = {
  title: 'Terms — ResumeProof Match',
  description: 'The service boundaries and responsible-use terms for ResumeProof Match.',
};

export default function TermsPage() { return <InfoPage kind="terms" />; }
