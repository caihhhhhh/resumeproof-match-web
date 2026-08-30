import { env } from 'cloudflare:workers';
import { productEventsNameIndex, productEventsSchema, productEventsTimeIndex } from '../../db/schema';

export const PRODUCT_EVENT_NAMES = new Set([
  'page_view', 'match_started',
  'resume_upload_started', 'resume_upload_completed', 'resume_upload_failed', 'resume_input_ready',
  'jd_link_parse_started', 'jd_link_parse_completed', 'jd_link_parse_failed', 'jd_input_ready',
  'analysis_started', 'analysis_completed', 'analysis_failed',
  'result_feedback_submitted',
  'suggestion_reviewed', 'review_draft_built', 'review_draft_confirmed', 'resume_exported',
]);

const PROPERTY_KEYS = new Set([
  'source', 'file_type', 'file_size', 'extraction', 'reason', 'method',
  'resume_method', 'jd_method', 'language', 'grade', 'score_band',
  'suggestion_count', 'decision', 'adopted_suggestions', 'template', 'format',
  'helpful', 'feedback_reason',
  'journey_id', 'acquisition_source', 'acquisition_medium', 'acquisition_campaign',
]);

const PROPERTY_STRING_PATTERN = /^[\p{L}\p{N} ._+&/-]{1,48}$/u;

export type ProductEventRow = {
  id: number;
  occurred_at_ms: number;
  event_name: string;
  page_path: string;
  properties_json: string;
};

let schemaReady: Promise<void> | null = null;

function database() {
  return (env as unknown as { DB?: D1Database }).DB;
}

async function ensureSchema(db: D1Database) {
  schemaReady ??= db.batch([
    db.prepare(productEventsSchema),
    db.prepare(productEventsTimeIndex),
    db.prepare(productEventsNameIndex),
  ]).then(() => undefined).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

function safePath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.length > 120) return '/';
  return value.split('?')[0].split('#')[0];
}

export function sanitizeProductProperties(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!PROPERTY_KEYS.has(key)) continue;
    if (typeof raw === 'boolean') clean[key] = raw;
    else if (typeof raw === 'number' && Number.isFinite(raw)) clean[key] = Math.max(-1_000_000, Math.min(1_000_000, raw));
    else if (typeof raw === 'string' && PROPERTY_STRING_PATTERN.test(raw)) clean[key] = raw;
  }
  return clean;
}

export async function recordProductEvent(input: { eventName: string; pagePath: unknown; properties: unknown }) {
  const db = database();
  if (!db || !PRODUCT_EVENT_NAMES.has(input.eventName)) return false;
  try {
    await ensureSchema(db);
    const now = Date.now();
    await db.batch([
      db.prepare(`
        INSERT INTO product_events (occurred_at_ms, event_name, page_path, properties_json)
        VALUES (?, ?, ?, ?)
      `).bind(now, input.eventName, safePath(input.pagePath), JSON.stringify(sanitizeProductProperties(input.properties))),
      db.prepare('DELETE FROM product_events WHERE occurred_at_ms < ?').bind(now - 180 * 24 * 60 * 60_000),
    ]);
    return true;
  } catch (error) {
    console.error('Product event write failed', error instanceof Error ? error.message : 'unknown');
    return false;
  }
}

export async function readProductEvents(sinceMs: number, limit = 10_000) {
  const db = database();
  if (!db) return [] as ProductEventRow[];
  try {
    await ensureSchema(db);
    const result = await db.prepare(`
      SELECT id, occurred_at_ms, event_name, page_path, properties_json
      FROM product_events
      WHERE occurred_at_ms >= ?
      ORDER BY occurred_at_ms DESC
      LIMIT ?
    `).bind(sinceMs, limit).all<ProductEventRow>();
    return result.results ?? [];
  } catch (error) {
    console.error('Product event read failed', error instanceof Error ? error.message : 'unknown');
    return [] as ProductEventRow[];
  }
}
