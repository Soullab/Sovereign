/**
 * Change what a Work is becoming, later (founder 2026-11-20: "Yes, add it here"). The form is the writer's own word
 * (`living_works.form`), set through the member's own Work route. `null` clears it, and the Studio then speaks neutrally.
 * Returns false when it could not be saved: say so; never guess.
 */
import { apiFetch } from '@/lib/http/apiBase';

export async function setWorkFormClient(workId: string, form: string | null): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/sovereign/living-works/${encodeURIComponent(workId)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ form }),
    });
    return res.ok;
  } catch { return false; }
}
