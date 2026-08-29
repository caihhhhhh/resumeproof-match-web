'use client';

type AnalyticsValue = string | number | boolean;

export function trackEvent(name: string, parameters: Record<string, AnalyticsValue> = {}) {
  if (typeof window === 'undefined') return;
  void fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventName: name, pagePath: window.location.pathname, properties: parameters }),
    keepalive: true,
  }).catch(() => undefined);
  window.gtag?.('event', name, parameters);
}

export function fileSizeBucket(bytes: number) {
  if (bytes < 500_000) return 'under_500kb';
  if (bytes < 2_000_000) return '500kb_to_2mb';
  if (bytes < 5_000_000) return '2mb_to_5mb';
  return '5mb_to_8mb';
}
