import { env } from 'cloudflare:workers';
import { runtimeEventsSchema, runtimeEventsStatusIndex, runtimeEventsTimeIndex } from '../../db/schema';

export type RuntimeRequestType = 'match' | 'ocr' | 'jd_parse';
export type RuntimeStatus = 'success' | 'failure' | 'fallback';

export type RuntimeEvent = {
  requestType: RuntimeRequestType;
  status: RuntimeStatus;
  provider: 'deepseek' | 'zhipu' | 'local';
  model?: string | null;
  durationMs: number;
  errorCode?: string | null;
};

export type RuntimeEventRow = {
  id: number;
  occurred_at_ms: number;
  request_type: RuntimeRequestType;
  status: RuntimeStatus;
  provider: string;
  model: string | null;
  duration_ms: number;
  error_code: string | null;
};

let schemaReady: Promise<void> | null = null;

function database() {
  return (env as unknown as { DB?: D1Database }).DB;
}

async function ensureRuntimeSchema(db: D1Database) {
  schemaReady ??= db.batch([
    db.prepare(runtimeEventsSchema),
    db.prepare(runtimeEventsTimeIndex),
    db.prepare(runtimeEventsStatusIndex),
  ]).then(() => undefined).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export async function recordRuntimeEvent(event: RuntimeEvent) {
  const db = database();
  if (!db) return;
  try {
    await ensureRuntimeSchema(db);
    await db.prepare(`
      INSERT INTO runtime_events
        (occurred_at_ms, request_type, status, provider, model, duration_ms, error_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      Date.now(), event.requestType, event.status, event.provider,
      event.model ?? null, Math.max(0, Math.round(event.durationMs)), event.errorCode ?? null,
    ).run();
  } catch (error) {
    console.error('Runtime telemetry write failed', error instanceof Error ? error.message : 'unknown');
  }
}

export async function trackRuntimeResponse(
  startedAt: number,
  event: Omit<RuntimeEvent, 'status' | 'durationMs' | 'errorCode'>,
  response: Response,
  status?: RuntimeStatus,
) {
  const payload = await response.clone().json().catch(() => null) as { error?: unknown; code?: unknown } | null;
  const errorCode = typeof payload?.error === 'string'
    ? payload.error
    : typeof payload?.code === 'string' ? payload.code : null;
  await recordRuntimeEvent({
    ...event,
    status: status ?? (response.ok ? 'success' : 'failure'),
    durationMs: Date.now() - startedAt,
    errorCode,
  });
  return response;
}

export async function readRuntimeEvents(sinceMs: number, limit = 5_000) {
  const db = database();
  if (!db) return [] as RuntimeEventRow[];
  try {
    await ensureRuntimeSchema(db);
    const result = await db.prepare(`
      SELECT id, occurred_at_ms, request_type, status, provider, model, duration_ms, error_code
      FROM runtime_events
      WHERE occurred_at_ms >= ?
      ORDER BY occurred_at_ms DESC
      LIMIT ?
    `).bind(sinceMs, limit).all<RuntimeEventRow>();
    return result.results ?? [];
  } catch (error) {
    console.error('Runtime telemetry read failed', error instanceof Error ? error.message : 'unknown');
    return [] as RuntimeEventRow[];
  }
}
