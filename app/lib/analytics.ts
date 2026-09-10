'use client';

type AnalyticsValue = string | number | boolean;

type Acquisition = {
  journey_id: string;
  acquisition_source: string;
  acquisition_medium: string;
  acquisition_campaign?: string;
};

const ACQUISITION_KEY = 'resumeproof-acquisition-v1';
let volatileAcquisition: Acquisition | null = null;
let matchContext: { match_id: string; is_demo: boolean } | null = null;

export function beginMatch(isDemo = false) {
  matchContext = { match_id: newJourneyId(), is_demo: isDemo };
  try { window.sessionStorage.setItem('resumeproof-match-event-v1', JSON.stringify(matchContext)); } catch { /* In-memory context remains available. */ }
}

function currentMatch() {
  if (!matchContext) {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem('resumeproof-match-event-v1') || 'null');
      if (saved && typeof saved.match_id === 'string' && typeof saved.is_demo === 'boolean') matchContext = saved;
    } catch { /* Storage is optional. */ }
    if (!matchContext) beginMatch();
  }
  return matchContext!;
}

function newJourneyId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `journey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function safeLabel(value: string | null, fallback: string) {
  const clean = value?.trim().toLowerCase().replace(/[^\p{L}\p{N}._+-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 48);
  return clean || fallback;
}

function referrerSource() {
  if (!document.referrer) return { source: 'direct', medium: 'none' };
  try {
    const hostname = new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === window.location.hostname) return { source: 'direct', medium: 'none' };
    const known: Array<[RegExp, string, string]> = [
      [/reddit\.com$/, 'reddit', 'social'], [/linkedin\.com$/, 'linkedin', 'social'],
      [/(?:x|twitter)\.com$/, 'x', 'social'], [/(?:xiaohongshu|xhslink)\.com$/, 'xiaohongshu', 'social'],
      [/v2ex\.com$/, 'v2ex', 'community'], [/github\.com$/, 'github', 'referral'],
      [/(?:^|\.)google\.|(?:^|\.)bing\.com$|(?:^|\.)baidu\.com$/, 'search', 'organic'],
    ];
    const match = known.find(([pattern]) => pattern.test(hostname));
    return match ? { source: match[1], medium: match[2] } : { source: 'referral', medium: 'referral' };
  } catch {
    return { source: 'direct', medium: 'none' };
  }
}

function acquisition(): Acquisition {
  if (volatileAcquisition) return volatileAcquisition;
  try {
    const saved = window.sessionStorage.getItem(ACQUISITION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<Acquisition>;
      if (typeof parsed.journey_id === 'string' && typeof parsed.acquisition_source === 'string' && typeof parsed.acquisition_medium === 'string') {
        volatileAcquisition = parsed as Acquisition;
        return volatileAcquisition;
      }
    }
    const params = new URLSearchParams(window.location.search);
    const referrer = referrerSource();
    const result: Acquisition = {
      journey_id: newJourneyId(),
      acquisition_source: safeLabel(params.get('utm_source'), referrer.source),
      acquisition_medium: safeLabel(params.get('utm_medium'), referrer.medium),
    };
    const campaign = safeLabel(params.get('utm_campaign'), '');
    if (campaign) result.acquisition_campaign = campaign;
    window.sessionStorage.setItem(ACQUISITION_KEY, JSON.stringify(result));
    volatileAcquisition = result;
    return result;
  } catch {
    volatileAcquisition = { journey_id: newJourneyId(), acquisition_source: 'direct', acquisition_medium: 'none' };
    return volatileAcquisition;
  }
}

export function trackEvent(name: string, parameters: Record<string, AnalyticsValue> = {}) {
  if (typeof window === 'undefined') return;
  const eventParameters = { ...acquisition(), ...currentMatch(), ...parameters };
  void fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventName: name, pagePath: window.location.pathname, properties: eventParameters }),
    keepalive: true,
  }).catch(() => undefined);
  window.gtag?.('event', name, eventParameters);
}

export function fileSizeBucket(bytes: number) {
  if (bytes < 500_000) return 'under_500kb';
  if (bytes < 2_000_000) return '500kb_to_2mb';
  if (bytes < 5_000_000) return '2mb_to_5mb';
  return '5mb_to_8mb';
}
