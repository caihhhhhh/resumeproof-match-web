import { identifyJobSource, sourceLabels, type JobSource } from '../../../lib/job-source';
import { guardApiRequest, privateJson } from '../../../lib/request-guard';
import { trackRuntimeResponse } from '../../../lib/runtime-telemetry';

const FETCHABLE_ROOTS = [
  'zhipin.com',
  'liepin.com',
  'linkedin.com',
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
] as const;

const TRACKING_PARAMS = new Set([
  'alternateChannel', 'eBP', 'refId', 'trackingId', 'trk', 'trkInfo',
  'originalSubdomain', 'lipi', 'midToken', 'midSig', 'mscid', 'from',
]);

const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;
const MAX_JD_LENGTH = 29_000;

function response(data: unknown, status = 200) {
  return privateJson(data, { status });
}

function isFetchableHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return FETCHABLE_ROOTS.some((root) => host === root || host.endsWith(`.${root}`));
}

function canonicalize(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('HTTPS_ONLY');
  if (!isFetchableHost(url.hostname)) throw new Error('HOST_NOT_ALLOWED');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key)) url.searchParams.delete(key);
  }
  return url;
}

function isJobDetailUrl(url: URL, source: JobSource) {
  if (source === 'linkedin') return /\/jobs\/view\//i.test(url.pathname);
  if (source === 'liepin') return /\/job\/\d+\.shtml$/i.test(url.pathname);
  if (source === 'boss') return /\/job_detail\/[^/]+\.html$/i.test(url.pathname);
  if (source === 'greenhouse') return /\/[^/]+\/jobs\/\d+\/?$/i.test(url.pathname);
  if (source === 'lever') return /^\/[^/]+\/[a-f0-9-]{20,}\/?$/i.test(url.pathname);
  if (source === 'ashby') return /^\/[^/]+\/[^/]+\/?$/i.test(url.pathname);
  return true;
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = record['@type'];
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return record;

  for (const child of Object.values(record)) {
    const found = findJobPosting(child);
    if (found) return found;
  }
  return null;
}

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
  };

  return value
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => entities[entity] ?? entity)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function organizationName(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  return stringValue((value as Record<string, unknown>).name);
}

function locationName(value: unknown): string {
  if (Array.isArray(value)) return value.map(locationName).filter(Boolean).join(' / ');
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const address = record.address;
  if (!address || typeof address !== 'object') return stringValue(record.name);
  const parts = ['addressLocality', 'addressRegion', 'addressCountry']
    .map((key) => stringValue((address as Record<string, unknown>)[key]))
    .filter(Boolean);
  return parts.join(', ');
}

function extractStructuredPosting(html: string) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const posting = findJobPosting(JSON.parse(script[1].trim()));
      if (posting) return posting;
    } catch {
      // Recruitment pages often contain more than one JSON-LD block.
    }
  }
  return null;
}

function directCandidates(url: URL, source: JobSource) {
  const candidates = [url];
  if (source === 'liepin' || source === 'boss') {
    const mobile = new URL(url);
    mobile.hostname = `m.${source === 'liepin' ? 'liepin.com' : 'zhipin.com'}`;
    if (mobile.toString() !== url.toString()) candidates.push(mobile);
  }
  return candidates;
}

async function fetchPublicPage(startUrl: URL) {
  let current = startUrl;

  for (let redirectCount = 0; redirectCount < 4; redirectCount += 1) {
    if (!isFetchableHost(current.hostname)) throw new Error('HOST_NOT_ALLOWED');

    const result = await fetch(current, {
      redirect: 'manual',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
      },
      signal: AbortSignal.timeout(9_000),
    });

    if (result.status >= 300 && result.status < 400) {
      const location = result.headers.get('location');
      if (!location) throw new Error('INVALID_REDIRECT');
      current = canonicalize(new URL(location, current).toString());
      continue;
    }

    if (!result.ok) throw new Error(`UPSTREAM_${result.status}`);
    const declaredSize = Number(result.headers.get('content-length') ?? 0);
    if (declaredSize > MAX_RESPONSE_SIZE) throw new Error('RESPONSE_TOO_LARGE');

    const html = await result.text();
    if (html.length > MAX_RESPONSE_SIZE) throw new Error('RESPONSE_TOO_LARGE');
    return { html, finalUrl: current.toString() };
  }

  throw new Error('TOO_MANY_REDIRECTS');
}

type ReaderPayload = {
  data?: {
    title?: unknown;
    description?: unknown;
    content?: unknown;
  };
};

type ZhipuReaderPayload = {
  reader_result?: {
    title?: unknown;
    description?: unknown;
    content?: unknown;
  };
};

type ReaderResult = {
  title: string;
  description: string;
  content: string;
};

type AtsResult = ReaderResult & {
  company: string;
  location: string;
};

type GreenhousePayload = {
  title?: unknown;
  company_name?: unknown;
  content?: unknown;
  location?: { name?: unknown };
};

type LeverPayload = {
  text?: unknown;
  descriptionPlain?: unknown;
  description?: unknown;
  openingPlain?: unknown;
  opening?: unknown;
  additionalPlain?: unknown;
  additional?: unknown;
  lists?: Array<{ text?: unknown; content?: unknown }>;
  categories?: { location?: unknown; allLocations?: unknown };
};

async function readBoundedJson<T>(result: Response) {
  const declaredSize = Number(result.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_RESPONSE_SIZE) throw new Error('RESPONSE_TOO_LARGE');
  const raw = await result.text();
  if (raw.length > MAX_RESPONSE_SIZE) throw new Error('RESPONSE_TOO_LARGE');
  return JSON.parse(raw) as T;
}

function greenhouseCoordinates(url: URL) {
  const match = url.pathname.match(/^\/([^/]+)\/jobs\/(\d+)\/?$/i);
  if (!match || !/^[a-z0-9_-]+$/i.test(match[1])) return null;
  return { board: match[1], jobId: match[2] };
}

async function fetchGreenhousePosting(url: URL): Promise<AtsResult> {
  const coordinates = greenhouseCoordinates(url);
  if (!coordinates) throw new Error('JOB_DETAIL_REQUIRED');
  const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(coordinates.board)}/jobs/${coordinates.jobId}`;
  const result = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!result.ok) throw new Error(`GREENHOUSE_${result.status}`);
  const payload = await readBoundedJson<GreenhousePayload>(result);
  const content = stringValue(payload.content);
  const jdText = decodeHtml(decodeHtml(content)).slice(0, MAX_JD_LENGTH);
  if (!looksLikeJobDescription(jdText)) throw new Error('GREENHOUSE_NO_JOB_CONTENT');
  return {
    title: stringValue(payload.title),
    company: stringValue(payload.company_name),
    location: stringValue(payload.location?.name),
    description: '',
    content: jdText,
  };
}

function leverCoordinates(url: URL) {
  const match = url.pathname.match(/^\/([^/]+)\/([a-f0-9-]{20,})\/?$/i);
  if (!match || !/^[a-z0-9_-]+$/i.test(match[1])) return null;
  return { site: match[1], postingId: match[2] };
}

async function fetchLeverPosting(url: URL): Promise<AtsResult> {
  const coordinates = leverCoordinates(url);
  if (!coordinates) throw new Error('JOB_DETAIL_REQUIRED');
  const apiHost = url.hostname.toLowerCase().includes('.eu.lever.co') ? 'api.eu.lever.co' : 'api.lever.co';
  const endpoint = `https://${apiHost}/v0/postings/${encodeURIComponent(coordinates.site)}/${coordinates.postingId}`;
  const result = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!result.ok) throw new Error(`LEVER_${result.status}`);
  const payload = await readBoundedJson<LeverPayload>(result);
  const sections = [
    stringValue(payload.openingPlain) || decodeHtml(stringValue(payload.opening)),
    stringValue(payload.descriptionPlain) || decodeHtml(stringValue(payload.description)),
    ...(payload.lists ?? []).flatMap((list) => [stringValue(list.text), decodeHtml(stringValue(list.content))]),
    stringValue(payload.additionalPlain) || decodeHtml(stringValue(payload.additional)),
  ].filter(Boolean);
  const jdText = sections.join('\n\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_JD_LENGTH);
  if (!looksLikeJobDescription(jdText)) throw new Error('LEVER_NO_JOB_CONTENT');
  const allLocations = Array.isArray(payload.categories?.allLocations)
    ? payload.categories?.allLocations.map(stringValue).filter(Boolean).join(' / ')
    : '';
  return {
    title: stringValue(payload.text),
    company: '',
    location: stringValue(payload.categories?.location) || allLocations,
    description: '',
    content: jdText,
  };
}

function stableErrorCode(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (error.name === 'AbortError' || /abort|timeout/i.test(error.message)) return `${fallback}_TIMEOUT`;
  return /^[A-Z0-9_]+$/.test(error.message) ? error.message : fallback;
}

async function fetchReaderPage(url: URL) {
  const result = await fetch(`https://r.jina.ai/${url.toString()}`, {
    headers: {
      Accept: 'application/json',
      'X-Retain-Images': 'none',
      'X-Token-Budget': '12000',
      'X-Timeout': '12',
      'X-Cache-Tolerance': '300',
      DNT: '1',
    },
    signal: AbortSignal.timeout(16_000),
  });
  if (!result.ok) throw new Error(`READER_${result.status}`);
  const declaredSize = Number(result.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_RESPONSE_SIZE) throw new Error('RESPONSE_TOO_LARGE');
  const raw = await result.text();
  if (raw.length > MAX_RESPONSE_SIZE) throw new Error('RESPONSE_TOO_LARGE');
  const payload = JSON.parse(raw) as ReaderPayload;
  const data = payload.data;
  if (!data) throw new Error('READER_INVALID_OUTPUT');
  return {
    title: stringValue(data.title),
    description: stringValue(data.description),
    content: stringValue(data.content),
  };
}

async function fetchZhipuReaderPage(url: URL, apiKey: string): Promise<ReaderResult> {
  const result = await fetch('https://open.bigmodel.cn/api/paas/v4/reader', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: url.toString(),
      timeout: 20,
      return_format: 'markdown',
      retain_images: false,
      with_images_summary: false,
      with_links_summary: false,
    }),
    signal: AbortSignal.timeout(24_000),
  });
  if (!result.ok) throw new Error(`ZHIPU_READER_${result.status}`);
  const declaredSize = Number(result.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_RESPONSE_SIZE) throw new Error('RESPONSE_TOO_LARGE');
  const raw = await result.text();
  if (raw.length > MAX_RESPONSE_SIZE) throw new Error('RESPONSE_TOO_LARGE');
  const payload = JSON.parse(raw) as ZhipuReaderPayload;
  const data = payload.reader_result;
  if (!data) throw new Error('ZHIPU_READER_INVALID_OUTPUT');
  return {
    title: stringValue(data.title),
    description: stringValue(data.description),
    content: stringValue(data.content),
  };
}

function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*+-]\s+/gm, '• ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function firstIndex(text: string, patterns: RegExp[]) {
  let found = -1;
  for (const pattern of patterns) {
    const index = text.search(pattern);
    if (index >= 0 && (found < 0 || index < found)) found = index;
  }
  return found;
}

function extractLikelyJobText(markdown: string, source: JobSource) {
  let text = markdownToPlainText(markdown);
  const starts = source === 'linkedin'
    ? [/\nAbout the job\s*\n/i, /\n(?::\s*)?职位描述[：:]?\s*\n/, /\n(?::\s*)?岗位职责[：:]?\s*\n/, /\n职责[：:]\s*\n/]
    : [/\n(?::\s*)?职位描述[：:]?\s*\n/, /\n(?::\s*)?岗位职责[：:]?\s*\n/, /\n(?::\s*)?工作内容[：:]?\s*\n/, /\nJob Description[：:]?\s*\n/i, /\nResponsibilities[：:]?\s*\n/i];
  const start = firstIndex(`\n${text}`, starts);
  if (start >= 0) text = `\n${text}`.slice(start + 1);

  const end = firstIndex(text, [
    /\nShow more\s+Show less/i,
    /\nSeniority level\s*\n/i,
    /\nReferrals increase/i,
    /\nSimilar jobs\s*\n/i,
    /\nPeople also viewed\s*\n/i,
    /\nGet notified about new/i,
    /\n相似职位\s*\n/,
    /\n相关推荐\s*\n/,
    /\n安全提示\s*\n/,
  ]);
  if (end > 120) text = text.slice(0, end);

  return text
    .split('\n')
    .filter((line) => !/^(Apply|Save|Sign in|Join now|Clear text|Report this job)$/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_JD_LENGTH);
}

function looksLikeJobDescription(text: string) {
  if (text.length < 180) return false;
  const responsibility = /(职责|工作内容|职位描述|responsibilit|what you(?:'|’)ll do|the role|job description)/i.test(text);
  const requirement = /(要求|任职资格|任职条件|qualifications?|requirements?|what we(?:'|’)re looking for|you have)/i.test(text);
  return responsibility || requirement;
}

function readerMetadata(title: string, source: JobSource) {
  if (source === 'linkedin') {
    const match = title.match(/^(.*?) hiring (.*?) in (.*?) \| LinkedIn$/i);
    if (match) return { company: match[1].trim(), title: match[2].trim(), location: match[3].trim() };
    const alternate = title.match(/^(.*?) at (.*?)\s+[—-]\s+(.*?)$/i);
    if (alternate) return {
      company: alternate[2].trim(),
      title: alternate[1].trim(),
      location: alternate[3].replace(/\s*\|\s*LinkedIn(?: Jobs)?$/i, '').trim(),
    };
  }
  return { company: '', title: title.replace(/\s*[|｜-]\s*(LinkedIn|BOSS直聘|猎聘).*$/i, '').trim(), location: '' };
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let telemetrySource = 'unknown';
  let telemetryProvider: 'local' | 'zhipu' = 'local';
  let telemetryMethod = 'validation';
  const done = (result: Response, status?: 'success' | 'failure' | 'fallback') => trackRuntimeResponse(startedAt, {
    requestType: 'jd_parse', provider: telemetryProvider, model: 'layered-job-parser',
    source: telemetrySource, method: telemetryMethod,
  }, result, status);
  const blocked = guardApiRequest(request, { bucket: 'jd-parse', limit: 30, maxBytes: 4_096 });
  if (blocked) return done(blocked);
  let body: { url?: unknown };
  try {
    body = (await request.json()) as { url?: unknown };
  } catch {
    return done(response({ status: 'error', code: 'INVALID_BODY' }, 400));
  }

  if (typeof body.url !== 'string' || body.url.length > 2048) {
    return done(response({ status: 'error', code: 'INVALID_URL' }, 400));
  }

  let url: URL;
  try {
    url = canonicalize(body.url);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_URL';
    return done(response({ status: code === 'HOST_NOT_ALLOWED' ? 'paste_required' : 'error', code }, code === 'HOST_NOT_ALLOWED' ? 200 : 400), code === 'HOST_NOT_ALLOWED' ? 'fallback' : 'failure');
  }

  const source = identifyJobSource(url.toString());
  telemetrySource = source;
  if (source === 'unknown') {
    return done(response({ status: 'paste_required', source, sourceLabel: sourceLabels[source], canonicalUrl: url.toString(), code: 'UNSUPPORTED_SOURCE' }), 'fallback');
  }
  if (!isJobDetailUrl(url, source)) {
    return done(response({
      status: 'paste_required', source, sourceLabel: sourceLabels[source], canonicalUrl: url.toString(), code: 'JOB_DETAIL_REQUIRED',
    }), 'fallback');
  }

  let lastCode = 'NO_JOB_POSTING_DATA';
  if (source === 'greenhouse' || source === 'lever') {
    telemetryMethod = 'official_ats_api';
    try {
      const posting = source === 'greenhouse'
        ? await fetchGreenhousePosting(url)
        : await fetchLeverPosting(url);
      return done(response({
        status: 'success',
        source,
        sourceLabel: sourceLabels[source],
        canonicalUrl: url.toString(),
        title: posting.title,
        company: posting.company,
        location: posting.location,
        jdText: posting.content,
        extractionMethod: 'official_ats_api',
      }));
    } catch (error) {
      lastCode = stableErrorCode(error, 'ATS_FETCH_FAILED');
    }
  }

  const attemptCodes: string[] = [];
  const attempts: Array<Promise<{
    provider: 'local' | 'zhipu'; method: string; canonicalUrl: string;
    title: string; company: string; location: string; jdText: string;
  }>> = directCandidates(url, source).map(async (candidate) => {
    try {
      const { html, finalUrl } = await fetchPublicPage(candidate);
      const posting = extractStructuredPosting(html);
      if (!posting) throw new Error('NO_JOB_POSTING_DATA');

      const description = decodeHtml(stringValue(posting.description)).slice(0, MAX_JD_LENGTH);
      if (description.length < 80) throw new Error('INCOMPLETE_JOB_POSTING');
      return {
        provider: 'local' as const,
        method: 'structured_data',
        canonicalUrl: finalUrl,
        title: stringValue(posting.title),
        company: organizationName(posting.hiringOrganization),
        location: locationName(posting.jobLocation),
        jdText: description,
      };
    } catch (error) {
      const code = stableErrorCode(error, 'FETCH_FAILED');
      attemptCodes.push(code);
      throw error;
    }
  });

  const zhipuKey = process.env.ZHIPU_API_KEY?.trim();
  const readers: Array<{ method: string; fetch: () => Promise<ReaderResult> }> = [];
  if ((source === 'liepin' || source === 'boss') && zhipuKey) {
    readers.push({ method: 'zhipu_reader', fetch: () => fetchZhipuReaderPage(url, zhipuKey) });
  }
  readers.push({ method: 'reader', fetch: () => fetchReaderPage(url) });
  if (source !== 'liepin' && source !== 'boss' && zhipuKey) {
    readers.push({ method: 'zhipu_reader', fetch: () => fetchZhipuReaderPage(url, zhipuKey) });
  }

  for (const readerSource of readers) {
    attempts.push((async () => {
      try {
        const reader = await readerSource.fetch();
        const jdText = extractLikelyJobText(reader.content || reader.description, source);
        if (!looksLikeJobDescription(jdText)) throw new Error('READER_NO_JOB_CONTENT');
        const metadata = readerMetadata(reader.title, source);
        return {
          provider: readerSource.method === 'zhipu_reader' ? 'zhipu' as const : 'local' as const,
          method: readerSource.method,
          canonicalUrl: url.toString(),
          title: metadata.title,
          company: metadata.company,
          location: metadata.location,
          jdText,
        };
      } catch (error) {
        attemptCodes.push(stableErrorCode(error, 'READER_FAILED'));
        throw error;
      }
    })());
  }

  try {
    const winner = await Promise.any(attempts);
    telemetryProvider = winner.provider;
    telemetryMethod = winner.method;
    return done(response({
      status: 'success',
      source,
      sourceLabel: sourceLabels[source],
      canonicalUrl: winner.canonicalUrl,
      title: winner.title,
      company: winner.company,
      location: winner.location,
      jdText: winner.jdText,
      extractionMethod: winner.method,
    }));
  } catch {
    // Every safe extraction path failed; fall back to user-supplied text or file.
  }

  const readerCode = attemptCodes.find((code) => code === 'READER_NO_JOB_CONTENT')
    ?? attemptCodes.at(-1)
    ?? lastCode;
  return done(response({
    status: 'paste_required',
    source,
    sourceLabel: sourceLabels[source],
    canonicalUrl: url.toString(),
    code: readerCode === 'READER_NO_JOB_CONTENT' ? lastCode : readerCode,
  }), 'fallback');
}
