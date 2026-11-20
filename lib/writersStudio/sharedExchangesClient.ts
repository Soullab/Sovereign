import { apiFetch } from '@/lib/http/apiBase';
import { withKeepPosture } from '@/lib/writersStudio/keepPosture';
import type { OwnShare } from './sharedExchangesServer';

const BASE = '/api/sovereign/writers-studio/shared-exchanges';

export async function listMyShares(workId: string): Promise<OwnShare[]> {
  try {
    const r = await apiFetch(`${BASE}?work=${encodeURIComponent(workId)}`);
    const body = await r.json().catch(() => ({}));
    return r.ok && Array.isArray(body?.shares) ? (body.shares as OwnShare[]) : [];
  } catch { return []; }
}

/** Only ever called from the writer's click on "Share this exchange", after they have read what will be shared. */
export async function shareMyExchange(input: { workId: string; threadId: string; maiaTurnIndex: number }): Promise<{ ok: true; share: OwnShare } | { ok: false; refusal: string }> {
  try {
    const r = await apiFetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withKeepPosture({ workId: input.workId, threadId: input.threadId, maiaTurnIndex: input.maiaTurnIndex })),
    });
    const body = await r.json().catch(() => ({}));
    return r.ok && body?.share ? { ok: true, share: body.share as OwnShare } : { ok: false, refusal: String(body?.refusal ?? `http_${r.status}`) };
  } catch { return { ok: false, refusal: 'unreachable' }; }
}

export async function withdrawMyShare(id: string): Promise<boolean> {
  try {
    const r = await apiFetch(`${BASE}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    return r.ok;
  } catch { return false; }
}
