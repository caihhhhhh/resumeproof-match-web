type Ga4MetricRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type Ga4Report = { rows?: Ga4MetricRow[] };
type Ga4BatchResponse = { reports?: Ga4Report[] };

export type Ga4RangeKey = '24h' | '7d' | '30d';

export type Ga4RangeSnapshot = {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  views: number;
  engagementRate: number | null;
  bounceRate: number | null;
  averageSessionDuration: number;
  eventCount: number;
  keyEvents: number;
};

type Ga4Details = {
  channels: Array<{
    key: string;
    source: string;
    medium: string;
    campaign: string;
    sessions: number;
    activeUsers: number;
    engagementRate: number | null;
    keyEvents: number;
  }>;
  pages: Array<{ key: string; path: string; title: string; views: number; activeUsers: number; engagementSeconds: number }>;
  events: Array<{ key: string; name: string; count: number; users: number }>;
  devices: Array<{ key: string; device: string; activeUsers: number; sessions: number; engagementRate: number | null }>;
  countries: Array<{ key: string; country: string; activeUsers: number; sessions: number }>;
};

export type Ga4RangeData = Ga4Details & {
  label: string;
  current: Ga4RangeSnapshot;
  previous: Ga4RangeSnapshot;
};

export type Ga4ReportingData = {
  configured: boolean;
  status: 'ready' | 'not_configured' | 'error';
  propertyId: string;
  updatedAt: number | null;
  message: string;
  ranges: Record<Ga4RangeKey, Ga4RangeData>;
};

const rangeDefinitions: Record<Ga4RangeKey, {
  label: string;
  current: { startDate: string; endDate: string };
  previous: { startDate: string; endDate: string };
}> = {
  '24h': {
    label: '今日（媒体资源时区）',
    current: { startDate: 'today', endDate: 'today' },
    previous: { startDate: 'yesterday', endDate: 'yesterday' },
  },
  '7d': {
    label: '最近 7 天',
    current: { startDate: '6daysAgo', endDate: 'today' },
    previous: { startDate: '13daysAgo', endDate: '7daysAgo' },
  },
  '30d': {
    label: '最近 30 天',
    current: { startDate: '29daysAgo', endDate: 'today' },
    previous: { startDate: '59daysAgo', endDate: '30daysAgo' },
  },
};

const emptyRange = (): Ga4RangeSnapshot => ({
  activeUsers: 0, newUsers: 0, sessions: 0, views: 0, engagementRate: null,
  bounceRate: null, averageSessionDuration: 0, eventCount: 0, keyEvents: 0,
});

const emptyDetails = (): Ga4Details => ({ channels: [], pages: [], events: [], devices: [], countries: [] });

function emptyRangeData(key: Ga4RangeKey): Ga4RangeData {
  return { label: rangeDefinitions[key].label, current: emptyRange(), previous: emptyRange(), ...emptyDetails() };
}

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
    'pkcs8', privateKeyBytes(privateKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
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
    newUsers: numberAt(row, 1),
    sessions: numberAt(row, 2),
    views: numberAt(row, 3),
    engagementRate: row ? numberAt(row, 4) * 100 : null,
    bounceRate: row ? numberAt(row, 5) * 100 : null,
    averageSessionDuration: numberAt(row, 6),
    eventCount: numberAt(row, 7),
    keyEvents: numberAt(row, 8),
  };
}

function emptyData(status: Ga4ReportingData['status'], propertyId: string, message: string): Ga4ReportingData {
  return {
    configured: status !== 'not_configured', status, propertyId, updatedAt: null, message,
    ranges: { '24h': emptyRangeData('24h'), '7d': emptyRangeData('7d'), '30d': emptyRangeData('30d') },
  };
}

function detailRequests(key: Ga4RangeKey) {
  const dateRanges = [rangeDefinitions[key].current];
  return [
    {
      dateRanges,
      dimensions: ['sessionSource', 'sessionMedium', 'sessionCampaignName'].map((name) => ({ name })),
      metrics: ['sessions', 'activeUsers', 'engagementRate', 'keyEvents'].map((name) => ({ name })),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: '12',
    },
    {
      dateRanges,
      dimensions: ['pagePathPlusQueryString', 'pageTitle'].map((name) => ({ name })),
      metrics: ['screenPageViews', 'activeUsers', 'userEngagementDuration'].map((name) => ({ name })),
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: '10',
    },
    {
      dateRanges,
      dimensions: [{ name: 'eventName' }], metrics: ['eventCount', 'totalUsers'].map((name) => ({ name })),
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: '12',
    },
    {
      dateRanges,
      dimensions: [{ name: 'deviceCategory' }], metrics: ['activeUsers', 'sessions', 'engagementRate'].map((name) => ({ name })),
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: '8',
    },
    {
      dateRanges,
      dimensions: [{ name: 'country' }], metrics: ['activeUsers', 'sessions'].map((name) => ({ name })),
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: '10',
    },
  ];
}

function parseDetails(reports: Ga4Report[]): Ga4Details {
  return {
    channels: (reports[0]?.rows ?? []).map((row, index) => ({
      key: `${index}-${row.dimensionValues?.map((item) => item.value).join('-') ?? 'unknown'}`,
      source: row.dimensionValues?.[0]?.value || '(direct)', medium: row.dimensionValues?.[1]?.value || '(none)',
      campaign: row.dimensionValues?.[2]?.value || '(not set)', sessions: numberAt(row, 0), activeUsers: numberAt(row, 1),
      engagementRate: numberAt(row, 2) * 100, keyEvents: numberAt(row, 3),
    })),
    pages: (reports[1]?.rows ?? []).map((row, index) => ({
      key: `page-${index}-${row.dimensionValues?.[0]?.value ?? 'unknown'}`,
      path: row.dimensionValues?.[0]?.value || '/', title: row.dimensionValues?.[1]?.value || '未命名页面',
      views: numberAt(row, 0), activeUsers: numberAt(row, 1), engagementSeconds: numberAt(row, 2),
    })),
    events: (reports[2]?.rows ?? []).map((row, index) => ({
      key: `event-${index}-${row.dimensionValues?.[0]?.value ?? 'unknown'}`,
      name: row.dimensionValues?.[0]?.value || 'unknown', count: numberAt(row, 0), users: numberAt(row, 1),
    })),
    devices: (reports[3]?.rows ?? []).map((row, index) => ({
      key: `device-${index}-${row.dimensionValues?.[0]?.value ?? 'unknown'}`,
      device: row.dimensionValues?.[0]?.value || 'unknown', activeUsers: numberAt(row, 0), sessions: numberAt(row, 1),
      engagementRate: numberAt(row, 2) * 100,
    })),
    countries: (reports[4]?.rows ?? []).map((row, index) => ({
      key: `country-${index}-${row.dimensionValues?.[0]?.value ?? 'unknown'}`,
      country: row.dimensionValues?.[0]?.value || 'unknown', activeUsers: numberAt(row, 0), sessions: numberAt(row, 1),
    })),
  };
}

let cache: { key: string; expiresAt: number; value: Promise<Ga4ReportingData> } | null = null;

async function fetchGa4Report(propertyId: string, email: string, privateKey: string): Promise<Ga4ReportingData> {
  try {
    const token = await serviceAccountToken(email, privateKey);
    const summaryMetrics = [
      'activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'engagementRate',
      'bounceRate', 'averageSessionDuration', 'eventCount', 'keyEvents',
    ];
    const metricRequest = (dateRange: { startDate: string; endDate: string }) => ({
      dateRanges: [dateRange], metrics: summaryMetrics.map((name) => ({ name })),
    });
    const summaryRequests = (Object.keys(rangeDefinitions) as Ga4RangeKey[])
      .flatMap((key) => [metricRequest(rangeDefinitions[key].current), metricRequest(rangeDefinitions[key].previous)]);
    const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const postBatch = (requests: Array<Record<string, unknown>>) => fetch(endpoint, {
      method: 'POST', headers, body: JSON.stringify({ requests }), signal: AbortSignal.timeout(12_000),
    });
    const responses = await Promise.all([
      postBatch(summaryRequests.slice(0, 5)), postBatch(summaryRequests.slice(5)),
      postBatch(detailRequests('24h')), postBatch(detailRequests('7d')), postBatch(detailRequests('30d')),
    ]);
    if (responses.some((response) => !response.ok)) {
      throw new Error(`report_${responses.map((response) => response.status).join('_')}`);
    }
    const [summaryPayloadA, summaryPayloadB, details24Payload, details7Payload, details30Payload] = await Promise.all(
      responses.map((response) => response.json() as Promise<Ga4BatchResponse>),
    );
    const summaryReports = [...(summaryPayloadA.reports ?? []), ...(summaryPayloadB.reports ?? [])];
    const detailReports = {
      '24h': details24Payload.reports ?? [], '7d': details7Payload.reports ?? [], '30d': details30Payload.reports ?? [],
    } satisfies Record<Ga4RangeKey, Ga4Report[]>;
    if (summaryReports.length < 6 || Object.values(detailReports).some((reports) => reports.length < 5)) {
      throw new Error('report_incomplete');
    }
    const keys = Object.keys(rangeDefinitions) as Ga4RangeKey[];
    const ranges = Object.fromEntries(keys.map((key, index) => [key, {
      label: rangeDefinitions[key].label,
      current: summary(summaryReports[index * 2]), previous: summary(summaryReports[index * 2 + 1]),
      ...parseDetails(detailReports[key]),
    }])) as Record<Ga4RangeKey, Ga4RangeData>;
    return {
      configured: true, status: 'ready', propertyId, updatedAt: Date.now(),
      message: '已连接 Google Analytics Data API', ranges,
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
