'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useLanguage } from './language-context';
import { trackEvent } from '../lib/analytics';

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
  const enabled = Boolean(measurementId && VALID_MEASUREMENT_ID.test(measurementId));

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
    window.gtag('set', 'ads_data_redaction', true);
    window.gtag('set', 'url_passthrough', false);
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
    if (!enabled || !window.gtag || choice === null) return;
    window.gtag('consent', 'update', {
      analytics_storage: choice,
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }, [choice, enabled]);

  useEffect(() => {
    if (!enabled || !measurementId) return;
    trackEvent('page_view', {
      page_location: window.location.href,
      page_path: pathname,
      page_title: document.title,
      send_to: measurementId,
    });
  }, [enabled, measurementId, pathname]);

  function saveChoice(nextChoice: ConsentChoice) {
    window.localStorage.setItem(CONSENT_KEY, nextChoice);
    setChoice(nextChoice);
    setSettingsOpen(false);
  }

  if (!settingsOpen) return null;

  const text = language === 'zh' ? {
    label: '分析偏好',
    title: '选择分析方式',
    body: '网站始终记录不含 Cookie 的基础访问与流程成功率；允许后，GA4 可使用分析 Cookie 识别同一次访问中的页面与步骤。两种方式都不会向 GA4 发送简历、JD、文件名或职位信息。',
    privacy: '查看隐私政策',
    necessary: '仅基础统计',
    allow: '允许完整分析',
  } : {
    label: 'Analytics preferences',
    title: 'Choose how analytics works',
    body: 'The site always records basic cookieless visits and workflow success rates. If allowed, GA4 may use analytics cookies to connect pages and steps within a visit. Neither mode sends resumes, JDs, filenames, or job details to GA4.',
    privacy: 'Read the privacy policy',
    necessary: 'Basic measurement only',
    allow: 'Allow full analytics',
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
