import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Match a resume to a job — ResumeProof Match',
  description: 'Compare a resume with a target job description using verifiable source evidence and reviewable edits.',
  alternates: { canonical: '/match/new' },
  robots: { index: false, follow: true },
  openGraph: {
    type: 'website',
    url: '/match/new',
    title: 'Match a resume to a job — ResumeProof Match',
    description: 'Compare a resume with a target job description using verifiable source evidence and reviewable edits.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeProof Match evidence-first job matching' }],
  },
};

export default function MatchLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
