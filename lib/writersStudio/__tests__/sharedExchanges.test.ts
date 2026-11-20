/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { SHARE_EXPLAINER, SHARE_RETENTION_DAYS, shareEnabledFromEnv, shareExpiresAt } from '../sharedExchanges';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MIGRATION = read('database/migrations/20261119000001_writer_studio_shared_exchanges.sql');

describe('Share this with Soullab: rules that hold whatever the code around them does', () => {
  test('dark unless the server flag is exactly "1"', () => {
    expect(shareEnabledFromEnv({ WS_SHARE_EXCHANGE_ENABLED: '1' })).toBe(true);
    for (const v of [undefined, '', '0', 'true', 'yes']) expect(shareEnabledFromEnv({ WS_SHARE_EXCHANGE_ENABLED: v })).toBe(false);
    expect(read('lib/writersStudio/ShareExchangeContext.tsx')).toMatch(/createContext\(false\)/);
    expect(read('app/dev/writers-studio-p4r1/P4R1StudioHost.tsx')).toMatch(/shareEnabled = false,/);
    expect(read('app/writers-studio/page.tsx')).toMatch(/shareEnabled=\{shareEnabledFromEnv\(process\.env\)\}/);
    expect(read('app/writers-studio/canvas/WorkConversation.tsx')).not.toMatch(/NEXT_PUBLIC_WS_SHARE/);
  });

  test('kept 365 days at most, or until the beta ends; nothing after it ends', () => {
    const now = new Date('2026-11-19T12:00:00Z');
    expect(SHARE_RETENTION_DAYS).toBeLessThanOrEqual(365);
    expect(shareExpiresAt(now)!.toISOString()).toBe('2027-11-19T12:00:00.000Z');
    expect(shareExpiresAt(now, '2027-03-01T00:00:00Z')!.toISOString()).toBe('2027-03-01T00:00:00.000Z');
    expect(shareExpiresAt(now, '2030-01-01T00:00:00Z')!.toISOString()).toBe('2027-11-19T12:00:00.000Z');
    expect(shareExpiresAt(now, '2026-11-01T00:00:00Z')).toBeNull();
    expect(shareExpiresAt(now, 'not a date')!.toISOString()).toBe('2027-11-19T12:00:00.000Z');
  });

  test('the table holds no plaintext, has no soft delete, expires, and goes when the conversation goes', () => {
    expect(MIGRATION).toMatch(/snapshot_enc TEXT NOT NULL/);
    expect(MIGRATION).not.toMatch(/\b(body|question|answer|withdrawn_at|deleted_at)\b\s+TEXT/i);
    expect(MIGRATION).toMatch(/expires_at TIMESTAMPTZ NOT NULL/);
    expect(MIGRATION).toMatch(/CHECK \(expires_at <= created_at \+ INTERVAL '12 months'\)/);
    expect(MIGRATION).toMatch(/REFERENCES ask_turns\(thread_id, turn_index\) ON DELETE CASCADE/);
    expect(MIGRATION).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  test('nothing but the share store reads the table: never MAIA’s context, never training', () => {
    const hits = execSync(`git grep --untracked -l "writer_studio_shared_exchanges" -- lib app components scripts`, { cwd: ROOT, encoding: 'utf8' })
      .trim().split('\n').filter((f) => !f.includes('__tests__'));
    expect(hits.sort()).toEqual(['lib/security/phiAccessors/sharedExchanges.ts', 'lib/writersStudio/sharedExchangesServer.ts']);
  });

  test('the button is only under MAIA’s stored answers, only when on, and sends nothing until the writer confirms', () => {
    const view = read('app/writers-studio/canvas/WorkConversation.tsx');
    expect(view).toMatch(/\{shareEnabled && t\.speaker === 'maia' && threadId \? \(\s*<ShareExchangeOffer/);
    const sanctuaryBlock = view.slice(view.indexOf('const sanctuaryAt'), view.indexOf('const sanctuaryAt') + 2000);
    expect(sanctuaryBlock).not.toMatch(/ShareExchangeOffer/);
    const offer = read('app/writers-studio/canvas/ShareExchangeOffer.tsx');
    expect(offer.match(/shareMyExchange\(/g)).toHaveLength(1);
    expect(offer).toMatch(/SHARE_CONFIRM_LABEL/);
    expect(offer).not.toMatch(/useEffect/);
  });

  test('the writer is told who reads it, how long it is kept, and that withdrawing deletes it', () => {
    const text = SHARE_EXPLAINER.join(' ');
    expect(text).toMatch(/Only Kelly/);
    expect(text).toMatch(/MAIA never sees it/);
    expect(text).toMatch(/12 months or until the beta ends/);
    expect(text).toMatch(/Withdrawing deletes it completely/);
  });
});
