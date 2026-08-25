import { identifyJobSource, sourceLabels } from '../../../lib/job-source';
import { guardApiRequest, privateJson } from '../../../lib/request-guard';
import { trackRuntimeResponse } from '../../../lib/runtime-telemetry';

const FETCHABLE_HOSTS = new Set([
  'www.liepin.com',
  'liepin.com',
  'job-boards.greenhouse.io',
  'boards.greenhouse.io',
  'jobs.greenhouse.io',
  'jobs.lever.co',
  'jobs.ashbyhq.com',
]);

const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;

function response(data: unknown, status = 200) {
  return privateJson(data, { status });
}

function canonicalize(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('HTTPS_ONLY');
  url.hash = '';
  url.search = '';
  return url;
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
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
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

async function fetchPublicPage(startUrl: URL) {
  let current = startUrl;

  for (let redirectCount = 0; redirectCount < 3; redirectCount += 1) {
    if (!FETCHABLE_HOSTS.has(current.hostname.toLowerCase())) throw new Error('HOST_NOT_ALLOWED');

    const result = await fetch(current, {
      redirect: 'manual',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'ResumeProofMatch/0.1 (+user-submitted single job URL)',
      },
      signal: AbortSignal.timeout(8000),
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

export async function POST(request: Request) {
  const startedAt = Date.now();
  const done = (result: Response, status?: 'success' | 'failure' | 'fallback') => trackRuntimeResponse(startedAt, {
    requestType: 'jd_parse', provider: 'local', model: 'structured-data-parser',
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
    return done(response({ status: 'error', code: error instanceof Error ? error.message : 'INVALID_URL' }, 400));
  }

  const source = identifyJobSource(url.toString());
  if (source === 'linkedin' || source === 'boss') {
    return done(response({
      status: 'paste_required',
      source,
      sourceLabel: sourceLabels[source],
      canonicalUrl: url.toString(),
      code: source === 'linkedin' ? 'PLATFORM_RESTRICTED' : 'PUBLIC_FETCH_UNRELIABLE',
    }), 'fallback');
  }

  if (source === 'unknown' || !FETCHABLE_HOSTS.has(url.hostname.toLowerCase())) {
    return done(response({ status: 'paste_required', source, sourceLabel: sourceLabels[source], canonicalUrl: url.toString(), code: 'UNSUPPORTED_SOURCE' }), 'fallback');
  }

  try {
    const { html, finalUrl } = await fetchPublicPage(url);
    const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    let posting: Record<string, unknown> | null = null;

    for (const script of scripts) {
      try {
        posting = findJobPosting(JSON.parse(script[1].trim()));
        if (posting) break;
      } catch {
        // Ignore invalid structured-data blocks and continue to the next one.
      }
    }

    if (!posting) {
      return done(response({ status: 'paste_required', source, sourceLabel: sourceLabels[source], canonicalUrl: finalUrl, code: 'NO_JOB_POSTING_DATA' }), 'fallback');
    }

    const description = decodeHtml(stringValue(posting.description));
    if (description.length < 80) {
      return done(response({ status: 'paste_required', source, sourceLabel: sourceLabels[source], canonicalUrl: finalUrl, code: 'INCOMPLETE_JOB_POSTING' }), 'fallback');
    }

    return done(response({
      status: 'success',
      source,
      sourceLabel: sourceLabels[source],
      canonicalUrl: finalUrl,
      title: stringValue(posting.title),
      company: organizationName(posting.hiringOrganization),
      location: locationName(posting.jobLocation),
      jdText: description,
    }));
  } catch (error) {
    return done(response({
      status: 'paste_required',
      source,
      sourceLabel: sourceLabels[source],
      canonicalUrl: url.toString(),
      code: error instanceof Error ? error.message : 'FETCH_FAILED',
    }), 'fallback');
  }
}
