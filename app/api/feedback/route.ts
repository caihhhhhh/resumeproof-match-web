import { FEEDBACK_REASONS, recordFeedback } from '../../lib/feedback-events';
import { guardApiRequest, privateJson } from '../../lib/request-guard';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const blocked = guardApiRequest(request, { bucket: 'feedback', limit: 20, maxBytes: 2 * 1024 });
  if (blocked) return blocked;
  let body: { helpful?: unknown; reason?: unknown; grade?: unknown; scoreBand?: unknown };
  try { body = await request.json(); } catch { return privateJson({ error: 'INVALID_JSON' }, { status: 400 }); }
  if (typeof body.helpful !== 'boolean' || typeof body.reason !== 'string' || !FEEDBACK_REASONS.has(body.reason)) {
    return privateJson({ error: 'INVALID_FEEDBACK' }, { status: 400 });
  }
  if (body.helpful && body.reason !== 'helpful') return privateJson({ error: 'INVALID_REASON' }, { status: 400 });
  if (!body.helpful && body.reason === 'helpful') return privateJson({ error: 'INVALID_REASON' }, { status: 400 });
  const stored = await recordFeedback({
    helpful: body.helpful,
    reason: body.reason,
    grade: typeof body.grade === 'string' ? body.grade : '',
    scoreBand: typeof body.scoreBand === 'string' ? body.scoreBand : '',
  });
  return privateJson({ accepted: stored }, { status: stored ? 202 : 503 });
}
