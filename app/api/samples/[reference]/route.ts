import { deleteContentSample } from '../../../lib/content-samples';
import { guardApiRequest, privateJson } from '../../../lib/request-guard';

export const runtime = 'nodejs';

export async function DELETE(request: Request, context: { params: Promise<{ reference: string }> }) {
  const blocked = guardApiRequest(request, { bucket: 'sample-delete', limit: 10, maxBytes: 1_024 });
  if (blocked) return blocked;
  const { reference } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(reference)) return privateJson({ error: 'INVALID_REFERENCE' }, { status: 400 });
  const deleted = await deleteContentSample(reference);
  return privateJson({ deleted });
}
