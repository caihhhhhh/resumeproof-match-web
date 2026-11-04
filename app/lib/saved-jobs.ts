import { env } from 'cloudflare:workers';
import {
  savedJobsSchema,
  savedJobsUserIndex,
  syncTokensSchema,
  syncTokensUserIndex,
} from '../../db/schema';

export const SAVED_JOB_SITES = new Set([
  'boss', 'zhaopin', 'liepin',
  'official', 'greenhouse', 'lever', 'ashby', 'workday', 'jobpro',
]);

export type SavedJobInput = {
  title: string;
  company: string;
  salary: string;
  location: string;
  url: string;
  jd: string;
};

export type SavedJobRow = {
  id: number;
  site: string;
  title: string;
  company: string;
  salary: string;
  location: string;
  url: string;
  jd: string;
  captured_at_ms: number;
};

const MAX_JOBS_PER_INGEST = 30;
const MAX_TITLE = 120;
const MAX_COMPANY = 120;
const MAX_SALARY = 80;
const MAX_LOCATION = 120;
const MAX_URL = 600;
const MAX_JD = 24_000;

let schemaReady: Promise<void> | null = null;

function database() {
  return (env as unknown as { DB?: D1Database }).DB;
}

async function ensureSchema(db: D1Database) {
  schemaReady ??= db.batch([
    db.prepare(savedJobsSchema),
    db.prepare(savedJobsUserIndex),
    db.prepare(syncTokensSchema),
    db.prepare(syncTokensUserIndex),
  ]).then(() => undefined).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

function clean(value: unknown, max: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().slice(0, MAX_URL);
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export function normalizeJob(raw: unknown): SavedJobInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const title = clean(record.title, MAX_TITLE);
  const url = safeUrl(record.url);
  if (!title || !url) return null;
  return {
    title,
    company: clean(record.company, MAX_COMPANY),
    salary: clean(record.salary, MAX_SALARY),
    location: clean(record.location, MAX_LOCATION),
    url,
    jd: typeof record.jd === 'string' ? record.jd.trim().slice(0, MAX_JD) : '',
  };
}

export function normalizeJobBatch(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_JOBS_PER_INGEST) return null;
  const jobs: SavedJobInput[] = [];
  for (const item of raw) {
    const job = normalizeJob(item);
    if (!job) return null;
    jobs.push(job);
  }
  return jobs;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function ingestJobs(userId: string, site: string, jobs: SavedJobInput[]) {
  const db = database();
  if (!db) return 0;
  await ensureSchema(db);
  const now = Date.now();
  const statements = [];
  for (const job of jobs) {
    const dedupeHash = await sha256Hex(`${site}|${job.url}`);
    statements.push(db.prepare(`
      INSERT INTO saved_jobs
        (user_id, site, dedupe_hash, title, company, salary, location, url, jd, captured_at_ms, created_at_ms, updated_at_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, dedupe_hash) DO UPDATE SET
        title = excluded.title,
        company = excluded.company,
        salary = excluded.salary,
        location = excluded.location,
        jd = CASE WHEN excluded.jd <> '' THEN excluded.jd ELSE saved_jobs.jd END,
        captured_at_ms = excluded.captured_at_ms,
        updated_at_ms = excluded.updated_at_ms
    `).bind(
      userId, site, dedupeHash, job.title, job.company, job.salary, job.location,
      job.url, job.jd, now, now, now,
    ));
  }
  await db.batch(statements);
  return jobs.length;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function listSavedJobs(userId: string, options: { q?: string; limit?: number; offset?: number } = {}) {
  const db = database();
  if (!db) return [] as SavedJobRow[];
  await ensureSchema(db);
  const limit = Math.min(60, Math.max(1, options.limit ?? 30));
  const offset = Math.max(0, options.offset ?? 0);
  const q = (options.q ?? '').trim().slice(0, 80);
  const columns = 'id, site, title, company, salary, location, url, jd, captured_at_ms';
  if (q) {
    const like = `%${escapeLike(q)}%`;
    const result = await db.prepare(`
      SELECT ${columns} FROM saved_jobs
      WHERE user_id = ? AND (title LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\')
      ORDER BY captured_at_ms DESC
      LIMIT ? OFFSET ?
    `).bind(userId, like, like, limit, offset).all<SavedJobRow>();
    return result.results ?? [];
  }
  const result = await db.prepare(`
    SELECT ${columns} FROM saved_jobs
    WHERE user_id = ?
    ORDER BY captured_at_ms DESC
    LIMIT ? OFFSET ?
  `).bind(userId, limit, offset).all<SavedJobRow>();
  return result.results ?? [];
}

export async function countSavedJobs(userId: string) {
  const db = database();
  if (!db) return 0;
  await ensureSchema(db);
  const row = await db.prepare('SELECT COUNT(*) AS total FROM saved_jobs WHERE user_id = ?')
    .bind(userId).first<{ total: number }>();
  return row?.total ?? 0;
}

export async function deleteSavedJob(userId: string, id: number) {
  const db = database();
  if (!db) return false;
  await ensureSchema(db);
  const result = await db.prepare('DELETE FROM saved_jobs WHERE user_id = ? AND id = ?')
    .bind(userId, id).run();
  return (result.meta?.changes ?? 0) > 0;
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSyncToken(userId: string) {
  const db = database();
  if (!db) return null;
  await ensureSchema(db);
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  await db.prepare(`
    INSERT INTO sync_tokens (token_hash, user_id, created_at_ms)
    VALUES (?, ?, ?)
  `).bind(tokenHash, userId, now).run();
  return token;
}

export async function resolveSyncToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const db = database();
  if (!db) return null;
  await ensureSchema(db);
  const tokenHash = await sha256Hex(token);
  const row = await db.prepare('SELECT user_id FROM sync_tokens WHERE token_hash = ?')
    .bind(tokenHash).first<{ user_id: string }>();
  if (!row?.user_id) return null;
  await db.prepare('UPDATE sync_tokens SET last_used_at_ms = ? WHERE token_hash = ?')
    .bind(Date.now(), tokenHash).run();
  return row.user_id;
}
