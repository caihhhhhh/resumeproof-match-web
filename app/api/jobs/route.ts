import { getChatGPTUser } from '../../chatgpt-auth';
import {
  SAVED_JOB_SITES,
  countSavedJobs,
  ingestJobs,
  listSavedJobs,
  normalizeJobBatch,
  resolveSyncToken,
} from '../../lib/saved-jobs';
import { guardApiRequest, privateJson } from '../../lib/request-guard';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return privateJson({ error: 'UNAUTHORIZED' }, { status: 401 });
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').slice(0, 80);
  const limit = Number(url.searchParams.get('limit')) || 30;
  const offset = Number(url.searchParams.get('offset')) || 0;
  try {
    const [jobs, total] = await Promise.all([
      listSavedJobs(user.userId, { q, limit, offset }),
      countSavedJobs(user.userId),
    ]);
    return privateJson({ jobs, total });
  } catch (error) {
    console.error('Saved jobs read failed', error instanceof Error ? error.message : 'unknown');
    return privateJson({ error: 'JOBS_UNAVAILABLE' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const blocked = guardApiRequest(request, { bucket: 'jobs-ingest', limit: 60, maxBytes: 2 * 1024 * 1024 });
  if (blocked) return blocked;

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const userId = await resolveSyncToken(token);
  if (!userId) return privateJson({ error: 'INVALID_SYNC_TOKEN' }, { status: 401 });

  let body: { site?: unknown; jobs?: unknown };
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: 'INVALID_JSON' }, { status: 400 });
  }
  if (typeof body.site !== 'string' || !SAVED_JOB_SITES.has(body.site)) {
    return privateJson({ error: 'INVALID_SITE' }, { status: 400 });
  }
  const jobs = normalizeJobBatch(body.jobs);
  if (!jobs) return privateJson({ error: 'INVALID_JOBS' }, { status: 400 });

  try {
    const accepted = await ingestJobs(userId, body.site, jobs);
    return privateJson({ accepted }, { status: 202 });
  } catch (error) {
    console.error('Saved jobs write failed', error instanceof Error ? error.message : 'unknown');
    return privateJson({ error: 'JOBS_UNAVAILABLE' }, { status: 503 });
  }
}
