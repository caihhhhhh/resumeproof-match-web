import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { LanguageProvider } from './components/language-context';
import { GoogleAnalytics } from './components/google-analytics';
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
  title: 'ResumeProof Match — Evidence-first job matching',
  description:
    'Match a job description to verified resume evidence before you rewrite or apply.',
  ...(process.env.SITE_URL?.startsWith('https://') ? {
    metadataBase: new URL(process.env.SITE_URL),
    openGraph: {
      type: 'website',
      title: 'ResumeProof Match — Evidence-first job matching',
      description: 'Match a job description to verified resume evidence before you rewrite or apply.',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeProof Match evidence-first job matching' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'ResumeProof Match — Evidence-first job matching',
      description: 'Match a job description to verified resume evidence before you rewrite or apply.',
      images: ['/og.png'],
    },
  } : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <LanguageProvider>{children}</LanguageProvider>
        <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
      </body>
    </html>
  );
}
