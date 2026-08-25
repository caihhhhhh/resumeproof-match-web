'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const VALID_MEASUREMENT_ID = /^G-[A-Z0-9]+$/;

export function GoogleAnalytics({ measurementId }: { measurementId?: string }) {
  const pathname = usePathname();
  const enabled = Boolean(measurementId && VALID_MEASUREMENT_ID.test(measurementId));

  useEffect(() => {
    if (!enabled || !measurementId) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args: unknown[]) { window.dataLayer.push(args); };
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

  return null;
}
