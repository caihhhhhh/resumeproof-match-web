import type { Metadata } from 'next';
import { InfoPage } from '../components/info-page';

export const metadata: Metadata = {
  title: '隐私政策 | ResumeProof Match',
  description: '了解 ResumeProof Match 如何读取简历与 JD、使用 AI 服务、保存可选脱敏样本，以及用户可以如何控制数据。',
  alternates: { canonical: '/privacy' },
  openGraph: {
    type: 'website', url: '/privacy', title: '隐私政策 | ResumeProof Match',
    description: '简历、JD、AI 分析、OCR 与可选脱敏样本的数据处理说明。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeProof Match evidence-first job matching' }],
  },
};

export default function PrivacyPage() { return <InfoPage kind="privacy" />; }
