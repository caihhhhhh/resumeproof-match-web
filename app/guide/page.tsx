import type { Metadata } from 'next';
import { JsonLd } from '../components/json-ld';
import { guideFaqs, SeoGuide } from '../components/seo-guide';
import { SITE_ORIGIN } from '../lib/site';

export const metadata: Metadata = {
  title: '如何判断简历与 JD 匹配度 | ResumeProof Match',
  description: '不只看关键词和总分：用六步方法拆解 JD、核对简历原句、区分真实经验缺口与表达问题。',
  alternates: { canonical: '/guide', languages: { 'zh-CN': '/guide', en: '/en/guide', 'x-default': '/guide' } },
  openGraph: {
    type: 'article', url: '/guide', title: '如何判断简历与 JD 匹配度',
    description: '用可核对的简历证据，分开判断岗位适配、证据覆盖和简历表达。',
    publishedTime: '2026-09-02T00:00:00Z', modifiedTime: '2026-09-02T00:00:00Z',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeProof Match 简历与 JD 证据匹配' }],
  },
};

export default function GuidePage() {
  return <><JsonLd data={{
    '@context': 'https://schema.org', '@graph': [
      {
        '@type': 'Article', headline: '如何判断简历与 JD 是否真正匹配？',
        description: '用岗位要求与简历原句建立可核对的证据匹配。',
        datePublished: '2026-09-02', dateModified: '2026-09-02', inLanguage: 'zh-CN',
        mainEntityOfPage: `${SITE_ORIGIN}/guide`, author: { '@type': 'Organization', name: 'ResumeProof Match contributors' },
        image: `${SITE_ORIGIN}/og.png`,
      },
      {
        '@type': 'FAQPage', mainEntity: guideFaqs.zh.map(([question, answer]) => ({
          '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ],
  }} /><SeoGuide language="zh" /></>;
}
