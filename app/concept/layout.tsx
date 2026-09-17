import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '首页视觉原型 | ResumeProof Match',
  robots: { index: false, follow: false },
};

export default function ConceptLayout({ children }: { children: React.ReactNode }) {
  return children;
}
