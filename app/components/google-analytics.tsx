'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useLanguage } from './language-context';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const VALID_MEASUREMENT_ID = /^G-[A-Z0-9]+$/;
const CONSENT_KEY = 'resumeproof-analytics-consent';
const OPEN_SETTINGS_EVENT = 'resumeproof:open-analytics-settings';
type ConsentChoice = 'granted' | 'denied';

export function openAnalyticsSettings() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}

export function GoogleAnalytics({ measurementId }: { measurementId?: string }) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const enabled = Boolean(measurementId && VALID_MEASUREMENT_ID.test(measurementId) && choice === 'granted');

  useEffect(() => {
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, openSettings);
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(CONSENT_KEY);
      if (saved === 'granted' || saved === 'denied') setChoice(saved);
      else setSettingsOpen(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !measurementId) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args: unknown[]) { window.dataLayer.push(args); };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });

    if (!document.querySelector(`script[data-ga4-id="${measurementId}"]`)) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      script.dataset.ga4Id = measurementId;
      document.head.appendChild(script);
    }
  }, [enabled, measurementId]);

  useEffect(() => {
    if (!enabled || !measurementId || !window.gtag) return;
    window.gtag('event', 'page_view', {
      page_location: window.location.href,
      page_path: pathname,
      page_title: document.title,
      send_to: measurementId,
    });
  }, [enabled, measurementId, pathname]);

  function saveChoice(nextChoice: ConsentChoice) {
    const wasGranted = choice === 'granted';
    window.localStorage.setItem(CONSENT_KEY, nextChoice);
    setChoice(nextChoice);
    setSettingsOpen(false);
    if (wasGranted && nextChoice === 'denied') {
      window.gtag?.('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      window.setTimeout(() => window.location.reload(), 0);
    }
  }

  if (!settingsOpen) return null;

  const text = language === 'zh' ? {
    label: '分析偏好',
    title: '帮助我们了解哪里需要改进',
    body: '允许后，我们会用 Google Analytics 记录匿名页面访问和流程事件。不会发送简历、JD、文件名、职位链接、公司或职位名称。',
    privacy: '查看隐私政策',
    necessary: '仅使用必要功能',
    allow: '允许匿名分析',
  } : {
    label: 'Analytics preferences',
    title: 'Help us understand what needs improvement',
    body: 'If allowed, Google Analytics records anonymous page visits and workflow events. Resume text, JDs, filenames, job links, companies, and role titles are never sent.',
    privacy: 'Read the privacy policy',
    necessary: 'Necessary only',
    allow: 'Allow anonymous analytics',
  };

  return (
    <aside className="analytics-consent" aria-label={text.label}>
      <div>
        <strong>{text.title}</strong>
        <p>{text.body}</p>
        <Link href="/privacy">{text.privacy}<span aria-hidden="true">↗</span></Link>
      </div>
      <div className="analytics-consent-actions">
        <button type="button" onClick={() => saveChoice('denied')}>{text.necessary}</button>
        <button type="button" className="is-primary" onClick={() => saveChoice('granted')}>{text.allow}</button>
      </div>
    </aside>
  );
}
