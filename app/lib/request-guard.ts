type RateBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateBucket>();

type GuardOptions = {
  bucket: string;
  limit: number;
  windowMs?: number;
  maxBytes: number;
};

export function privateJson(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-store, private');
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function clientAddress(request: Request) {
  return request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
}

export function guardApiRequest(request: Request, options: GuardOptions): Response | null {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== requestUrl.origin) return privateJson({ error: 'CROSS_ORIGIN_REQUEST' }, { status: 403 });
    } catch {
      return privateJson({ error: 'INVALID_ORIGIN' }, { status: 403 });
    }
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) return privateJson({ error: 'JSON_REQUIRED' }, { status: 415 });

  const declaredBytes = Number(request.headers.get('content-length') ?? 0);
  if (declaredBytes > options.maxBytes) return privateJson({ error: 'REQUEST_TOO_LARGE' }, { status: 413 });

  const now = Date.now();
  const windowMs = options.windowMs ?? 10 * 60_000;
  const key = `${options.bucket}:${clientAddress(request)}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else if (current.count >= options.limit) {
    return privateJson({ error: 'SITE_RATE_LIMIT' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))) },
    });
  } else {
    current.count += 1;
  }

  if (buckets.size > 2_000) {
    for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
  }
  return null;
}
