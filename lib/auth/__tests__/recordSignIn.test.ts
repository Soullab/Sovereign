/**
 * last_sign_in must be recorded on every successful sign-in path, and its
 * failure must never turn a committed sign-in into a reported failure.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const queryMock = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...args: unknown[]) => queryMock(...args) }));

import { recordSignIn } from '../recordSignIn';

beforeEach(() => queryMock.mockReset());

test('writes last_sign_in for the member', async () => {
  queryMock.mockResolvedValue({ rows: [] });
  await recordSignIn('member-1', 'TEST');
  expect(queryMock).toHaveBeenCalledWith(
    expect.stringContaining('UPDATE members SET last_sign_in = NOW()'),
    ['member-1'],
  );
});

test('never throws when the timestamp write fails', async () => {
  queryMock.mockRejectedValue(new Error('db unavailable'));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(recordSignIn('member-1', 'TEST')).resolves.toBeUndefined();
  warn.mockRestore();
});

// Every route that issues a member session on sign-in must record it.
const SIGN_IN_ROUTES = [
  'app/api/members/signin/route.ts',
  'app/api/members/enter/route.ts',
  'app/api/now-what/signin/route.ts',
  'app/api/auth/webauthn/authenticate/verify/route.ts',
  'app/api/members/email-code/verify/route.ts',
  'app/api/members/magic-link/route.ts',
  'app/api/auth/native-biometry/verify/route.ts',
  'app/api/auth/signin/apple/callback/route.ts',
  'app/api/auth/signin/google/callback/route.ts',
  'app/api/auth/apple/native-callback/route.ts',
  'app/api/auth/google/native-callback/route.ts',
];

test.each(SIGN_IN_ROUTES)('%s records last_sign_in', (route) => {
  const src = readFileSync(join(process.cwd(), route), 'utf8');
  expect(/recordSignIn\(|last_sign_in = NOW\(\)/.test(src)).toBe(true);
});
