import { getChatGPTUser } from '../../../chatgpt-auth';
import { deleteSavedJob } from '../../../lib/saved-jobs';
import { privateJson } from '../../../lib/request-guard';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return privateJson({ error: 'UNAUTHORIZED' }, { status: 401 });
  const { id } = await context.params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId) || jobId <= 0) return privateJson({ error: 'INVALID_ID' }, { status: 400 });
  try {
    const removed = await deleteSavedJob(user.userId, jobId);
    return privateJson({ removed }, { status: removed ? 200 : 404 });
  } catch (error) {
    console.error('Saved job delete failed', error instanceof Error ? error.message : 'unknown');
    return privateJson({ error: 'JOBS_UNAVAILABLE' }, { status: 503 });
  }
}
