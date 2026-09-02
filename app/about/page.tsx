import type { Metadata } from 'next';
import { InfoPage } from '../components/info-page';

export const metadata: Metadata = {
  title: '关于证据优先的 AI 简历匹配 | ResumeProof Match',
  description: '了解 ResumeProof Match 为什么先核对 JD 要求与简历原句，再给出可审核的修改建议。',
  alternates: { canonical: '/about' },
  openGraph: {
    type: 'website', url: '/about', title: '关于证据优先的 AI 简历匹配',
    description: '先核对真实证据，再修改简历表达。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeProof Match evidence-first job matching' }],
  },
};

export default function AboutPage() { return <InfoPage kind="about" />; }
