import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { LanguageProvider } from './components/language-context';
import { GoogleAnalytics } from './components/google-analytics';
import { JsonLd } from './components/json-ld';
import { SITE_ORIGIN } from './lib/site';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: 'AI 简历匹配与 JD 分析工具 | ResumeProof Match',
  description:
    '上传简历与职位描述，用 AI 逐条对照 JD 要求和简历证据，查看匹配差距、修改原因，审核全文后导出新简历。',
  keywords: ['AI 简历优化', '简历 JD 匹配', '岗位匹配度', '简历分析', 'resume job matching', 'resume optimizer'],
  alternates: {
    canonical: '/',
    languages: { 'zh-CN': '/', en: '/en', 'x-default': '/' },
  },
  category: 'career',
  creator: 'ResumeProof Match contributors',
  publisher: 'ResumeProof Match',
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'ResumeProof Match',
    title: 'AI 简历匹配与 JD 分析工具 | ResumeProof Match',
    description: '逐条核对 JD 要求、简历原句和改写建议，审核后再导出。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeProof Match evidence-first job matching' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI 简历匹配与 JD 分析工具 | ResumeProof Match',
    description: '逐条核对 JD 要求、简历原句和改写建议，审核后再导出。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, url: SITE_ORIGIN,
              name: 'ResumeProof Match',
              description: 'Evidence-first AI resume and job-description matching.',
              inLanguage: ['zh-CN', 'en'],
            },
            {
              '@type': 'WebApplication', '@id': `${SITE_ORIGIN}/#application`,
              name: 'ResumeProof Match', url: `${SITE_ORIGIN}/match/new`,
              applicationCategory: 'BusinessApplication', operatingSystem: 'Any',
              browserRequirements: 'Requires a modern web browser with JavaScript enabled.',
              description: 'Compare a resume with a job description, verify evidence, review edits, and export an approved resume.',
              featureList: [
                'Semantic resume and job-description matching', 'Requirement-level evidence citations',
                'Reviewable rewrite suggestions', 'PDF, DOCX, HTML, text, and image input',
                'HTML, PDF, and DOCX resume export',
              ],
              inLanguage: ['zh-CN', 'en'],
              sameAs: [
                'https://github.com/caihhhhhh/resume-proof-match',
                'https://github.com/caihhhhhh/resumeproof-match-web',
              ],
            },
          ],
        }} />
        <LanguageProvider>
          {children}
          <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        </LanguageProvider>
      </body>
    </html>
  );
}
