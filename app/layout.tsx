import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { LanguageProvider } from './components/language-context';
import { GoogleAnalytics } from './components/google-analytics';
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
  title: 'ResumeProof Match — Evidence-first job matching',
  description:
    'Match a job description to verified resume evidence before you rewrite or apply.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'ResumeProof Match',
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <LanguageProvider>
          {children}
          <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        </LanguageProvider>
      </body>
    </html>
  );
}
