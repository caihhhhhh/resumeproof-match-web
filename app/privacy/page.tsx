import type { Metadata } from 'next';
import { InfoPage } from '../components/info-page';

export const metadata: Metadata = {
  title: 'Privacy — ResumeProof Match',
  description: 'How ResumeProof Match reads, processes, and temporarily stores resume and job description data.',
};

export default function PrivacyPage() { return <InfoPage kind="privacy" />; }
