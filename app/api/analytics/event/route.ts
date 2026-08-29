import { PRODUCT_EVENT_NAMES, recordProductEvent } from '../../../lib/product-events';
import { guardApiRequest, privateJson } from '../../../lib/request-guard';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const blocked = guardApiRequest(request, { bucket: 'product-event', limit: 180, maxBytes: 8 * 1024 });
  if (blocked) return blocked;
  let body: { eventName?: unknown; pagePath?: unknown; properties?: unknown };
  try { body = await request.json(); } catch { return privateJson({ error: 'INVALID_JSON' }, { status: 400 }); }
  const eventName = typeof body.eventName === 'string' ? body.eventName : '';
  if (!PRODUCT_EVENT_NAMES.has(eventName)) return privateJson({ error: 'INVALID_EVENT' }, { status: 400 });
  await recordProductEvent({ eventName, pagePath: body.pagePath, properties: body.properties });
  return privateJson({ accepted: true }, { status: 202 });
}
