import type { Metadata } from 'next';
import { InfoPage } from '../components/info-page';

export const metadata: Metadata = {
  title: 'About — ResumeProof Match',
  description: 'Why ResumeProof Match uses verified resume evidence before rewriting.',
};

export default function AboutPage() { return <InfoPage kind="about" />; }
