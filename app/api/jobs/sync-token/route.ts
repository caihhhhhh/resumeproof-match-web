import { getChatGPTUser } from '../../../chatgpt-auth';
import { createSyncToken } from '../../../lib/saved-jobs';
import { guardApiRequest, privateJson } from '../../../lib/request-guard';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const blocked = guardApiRequest(request, { bucket: 'sync-token', limit: 6, maxBytes: 1024 });
  if (blocked) return blocked;
  const user = await getChatGPTUser();
  if (!user) return privateJson({ error: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const token = await createSyncToken(user.userId);
    if (!token) return privateJson({ error: 'JOBS_UNAVAILABLE' }, { status: 503 });
    return privateJson({
      token,
      hint: '在本地运行 node scripts/jobs/bridge.mjs sync --token <token> --site <站点地址>，令牌只显示这一次。',
    }, { status: 201 });
  } catch (error) {
    console.error('Sync token create failed', error instanceof Error ? error.message : 'unknown');
    return privateJson({ error: 'JOBS_UNAVAILABLE' }, { status: 503 });
  }
}
