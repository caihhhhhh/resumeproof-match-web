import type { Metadata } from 'next';
import { InfoPage } from '../components/info-page';

export const metadata: Metadata = {
  title: '使用条款 | ResumeProof Match',
  description: 'ResumeProof Match 的服务范围、AI 匹配局限、用户责任和可接受使用边界。',
  alternates: { canonical: '/terms' },
  openGraph: {
    type: 'website', url: '/terms', title: '使用条款 | ResumeProof Match',
    description: '了解服务范围、AI 局限、用户责任与安全边界。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeProof Match evidence-first job matching' }],
  },
};

export default function TermsPage() { return <InfoPage kind="terms" />; }
