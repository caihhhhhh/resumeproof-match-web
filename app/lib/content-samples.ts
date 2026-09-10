import { env } from 'cloudflare:workers';
import { contentSamplesExpiryIndex, contentSamplesSchema } from '../../db/schema';

const RETENTION_MS = 30 * 24 * 60 * 60_000;

export type ContentSampleRow = {
  id: number;
  public_id: string;
  occurred_at_ms: number;
  expires_at_ms: number;
  language: 'zh' | 'en';
  resume_text: string;
  jd_text: string;
  score: number;
  grade: 'A' | 'B' | 'C';
  summary: string;
};

let schemaReady: Promise<void> | null = null;

function database() {
  return (env as unknown as { DB?: D1Database }).DB;
}

async function ensureSchema(db: D1Database) {
  schemaReady ??= db.batch([
    db.prepare(contentSamplesSchema),
    db.prepare(contentSamplesExpiryIndex),
  ]).then(() => undefined).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

function redactMaterial(value: string) {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const contactSignal = /(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d\s()\-.]{7,}\d|https?:\/\/|linkedin\.com|github\.com)/i.test(lines.slice(0, 8).join('\n'));
  if (contactSignal) {
    const firstContentLine = lines.findIndex((line) => line.trim().length > 1);
    if (firstContentLine >= 0 && lines[firstContentLine].trim().length <= 60) lines[firstContentLine] = '[姓名已隐藏 / name hidden]';
  }
  return lines.join('\n')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[邮箱已隐藏 / email hidden]')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '[链接已隐藏 / link hidden]')
    .replace(/\b(?:linkedin\.com|github\.com)\/\S*/gi, '[链接已隐藏 / link hidden]')
    .replace(/\b\d{17}[\dXx]\b/g, '[证件号已隐藏 / ID hidden]')
    .replace(/(?<!\d)(?:\+?\d[\d\s()\-.]{7,}\d)(?!\d)/g, (match) => {
      const digitCount = match.replace(/\D/g, '').length;
      return digitCount >= 10 && digitCount <= 15 ? '[电话已隐藏 / phone hidden]' : match;
    })
    .trim();
}

export async function saveConsentedSample(input: {
  resumeText: string;
  jdText: string;
  language: 'zh' | 'en';
  score: number;
  grade: 'A' | 'B' | 'C';
  summary: string;
}) {
  const db = database();
  if (!db) return null;
  try {
    await ensureSchema(db);
    const now = Date.now();
    const publicId = crypto.randomUUID();
    await db.batch([
      db.prepare('DELETE FROM content_samples WHERE expires_at_ms <= ?').bind(now),
      db.prepare(`
        INSERT INTO content_samples
          (public_id, occurred_at_ms, expires_at_ms, language, resume_text, jd_text, score, grade, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        publicId, now, now + RETENTION_MS, input.language,
        redactMaterial(input.resumeText), redactMaterial(input.jdText),
        input.score, input.grade, redactMaterial(input.summary).slice(0, 1_000),
      ),
    ]);
    return publicId;
  } catch (error) {
    console.error('Consented sample write failed', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}

export async function readContentSamples(limit = 50) {
  const db = database();
  if (!db) return [] as ContentSampleRow[];
  try {
    await ensureSchema(db);
    const now = Date.now();
    await db.prepare('DELETE FROM content_samples WHERE expires_at_ms <= ?').bind(now).run();
    const result = await db.prepare(`
      SELECT id, public_id, occurred_at_ms, expires_at_ms, language, resume_text, jd_text, score, grade, summary
      FROM content_samples
      WHERE expires_at_ms > ?
      ORDER BY occurred_at_ms DESC
      LIMIT ?
    `).bind(now, limit).all<ContentSampleRow>();
    return result.results ?? [];
  } catch (error) {
    console.error('Consented sample read failed', error instanceof Error ? error.message : 'unknown');
    return [] as ContentSampleRow[];
  }
}

export async function deleteContentSample(publicId: string) {
  const db = database();
  if (!db) return false;
  try {
    await ensureSchema(db);
    const result = await db.prepare('DELETE FROM content_samples WHERE public_id = ?').bind(publicId).run();
    return Number(result.meta.changes ?? 0) > 0;
  } catch (error) {
    console.error('Consented sample delete failed', error instanceof Error ? error.message : 'unknown');
    return false;
  }
}
