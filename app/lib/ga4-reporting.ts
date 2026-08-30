type Ga4MetricRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type Ga4Report = { rows?: Ga4MetricRow[] };
type Ga4BatchResponse = { reports?: Ga4Report[] };

export type Ga4RangeSnapshot = {
  activeUsers: number;
  sessions: number;
  views: number;
  engagementRate: number | null;
};

export type Ga4ReportingData = {
  configured: boolean;
  status: 'ready' | 'not_configured' | 'error';
  propertyId: string;
  updatedAt: number | null;
  message: string;
  ranges: Record<'24h' | '7d' | '30d', Ga4RangeSnapshot>;
  channels: Array<{
    key: string;
    source: string;
    medium: string;
    campaign: string;
    sessions: number;
    activeUsers: number;
    engagementRate: number | null;
  }>;
};

const emptyRange = (): Ga4RangeSnapshot => ({ activeUsers: 0, sessions: 0, views: 0, engagementRate: null });

function base64Url(value: Uint8Array | string) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function privateKeyBytes(pem: string) {
  const body = pem.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function serviceAccountToken(email: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1_000);
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3_300,
  }))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${base64Url(new Uint8Array(signature))}`,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`token_${response.status}`);
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error('token_missing');
  return payload.access_token;
}

function numberAt(row: Ga4MetricRow | undefined, index: number) {
  const value = Number(row?.metricValues?.[index]?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function summary(report: Ga4Report | undefined): Ga4RangeSnapshot {
  const row = report?.rows?.[0];
  return {
    activeUsers: numberAt(row, 0),
    sessions: numberAt(row, 1),
    views: numberAt(row, 2),
    engagementRate: row ? numberAt(row, 3) * 100 : null,
  };
}

function emptyData(status: Ga4ReportingData['status'], propertyId: string, message: string): Ga4ReportingData {
  return {
    configured: status !== 'not_configured',
    status,
    propertyId,
    updatedAt: null,
    message,
    ranges: { '24h': emptyRange(), '7d': emptyRange(), '30d': emptyRange() },
    channels: [],
  };
}

let cache: { key: string; expiresAt: number; value: Promise<Ga4ReportingData> } | null = null;

async function fetchGa4Report(propertyId: string, email: string, privateKey: string): Promise<Ga4ReportingData> {
  try {
    const token = await serviceAccountToken(email, privateKey);
    const metricRequest = (startDate: string) => ({
      dateRanges: [{ startDate, endDate: 'today' }],
      metrics: ['activeUsers', 'sessions', 'screenPageViews', 'engagementRate'].map((name) => ({ name })),
    });
    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          metricRequest('today'),
          metricRequest('7daysAgo'),
          metricRequest('30daysAgo'),
          {
            dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
            dimensions: ['sessionSource', 'sessionMedium', 'sessionCampaignName'].map((name) => ({ name })),
            metrics: ['sessions', 'activeUsers', 'engagementRate'].map((name) => ({ name })),
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: '12',
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`report_${response.status}`);
    const payload = await response.json() as Ga4BatchResponse;
    const reports = payload.reports ?? [];
    if (reports.length < 4) throw new Error('report_incomplete');
    const channels = (reports[3].rows ?? []).map((row, index) => ({
      key: `${index}-${row.dimensionValues?.map((item) => item.value).join('-') ?? 'unknown'}`,
      source: row.dimensionValues?.[0]?.value || '(direct)',
      medium: row.dimensionValues?.[1]?.value || '(none)',
      campaign: row.dimensionValues?.[2]?.value || '(not set)',
      sessions: numberAt(row, 0),
      activeUsers: numberAt(row, 1),
      engagementRate: numberAt(row, 2) * 100,
    }));
    return {
      configured: true,
      status: 'ready',
      propertyId,
      updatedAt: Date.now(),
      message: '已连接 Google Analytics Data API',
      ranges: { '24h': summary(reports[0]), '7d': summary(reports[1]), '30d': summary(reports[2]) },
      channels,
    };
  } catch (error) {
    console.error('GA4 reporting failed', error instanceof Error ? error.message : 'unknown');
    return emptyData('error', propertyId, '暂时无法读取 GA4。请检查 Property ID、Data API 和服务账号权限。');
  }
}

export function getGa4ReportingData() {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim() ?? '';
  const email = process.env.GA4_SERVICE_ACCOUNT_EMAIL?.trim() ?? '';
  const privateKey = process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() ?? '';
  if (!/^\d+$/.test(propertyId) || !email || !privateKey) {
    return Promise.resolve(emptyData('not_configured', propertyId, '还需配置数字 Property ID 和只读服务账号。'));
  }
  const key = `${propertyId}:${email}`;
  if (!cache || cache.key !== key || cache.expiresAt < Date.now()) {
    cache = { key, expiresAt: Date.now() + 5 * 60_000, value: fetchGa4Report(propertyId, email, privateKey) };
  }
  return cache.value;
}
