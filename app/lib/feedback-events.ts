import { env } from 'cloudflare:workers';
import { feedbackEventsSchema, feedbackEventsTimeIndex } from '../../db/schema';

export const FEEDBACK_REASONS = new Set([
  'helpful', 'score_unfair', 'evidence_missed', 'suggestions_weak', 'unclear', 'other',
]);

export type FeedbackEventRow = {
  id: number;
  occurred_at_ms: number;
  helpful: number;
  reason: string;
  stage: string;
  grade: string;
  score_band: string;
};

let schemaReady: Promise<void> | null = null;

function database() {
  return (env as unknown as { DB?: D1Database }).DB;
}

async function ensureSchema(db: D1Database) {
  schemaReady ??= db.batch([
    db.prepare(feedbackEventsSchema),
    db.prepare(feedbackEventsTimeIndex),
  ]).then(() => undefined).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export async function recordFeedback(input: {
  helpful: boolean;
  reason: string;
  grade: string;
  scoreBand: string;
}) {
  const db = database();
  if (!db || !FEEDBACK_REASONS.has(input.reason)) return false;
  const grade = ['A', 'B', 'C'].includes(input.grade) ? input.grade : 'unknown';
  const scoreBand = /^(?:[0-9]0s|100s)$/.test(input.scoreBand) ? input.scoreBand : 'unknown';
  try {
    await ensureSchema(db);
    await db.prepare(`
      INSERT INTO feedback_events (occurred_at_ms, helpful, reason, stage, grade, score_band)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(Date.now(), input.helpful ? 1 : 0, input.reason, 'results', grade, scoreBand).run();
    return true;
  } catch (error) {
    console.error('Feedback write failed', error instanceof Error ? error.message : 'unknown');
    return false;
  }
}

export async function readFeedbackEvents(sinceMs: number, limit = 10_000) {
  const db = database();
  if (!db) return [] as FeedbackEventRow[];
  try {
    await ensureSchema(db);
    const result = await db.prepare(`
      SELECT id, occurred_at_ms, helpful, reason, stage, grade, score_band
      FROM feedback_events
      WHERE occurred_at_ms >= ?
      ORDER BY occurred_at_ms DESC
      LIMIT ?
    `).bind(sinceMs, limit).all<FeedbackEventRow>();
    return result.results ?? [];
  } catch (error) {
    console.error('Feedback read failed', error instanceof Error ? error.message : 'unknown');
    return [] as FeedbackEventRow[];
  }
}
