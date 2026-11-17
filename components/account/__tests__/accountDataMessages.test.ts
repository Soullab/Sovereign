/**
 * What the member is told when an export or a closure does not complete.
 *
 * The 409 is the route's designed refusal (`deletion_incomplete_unavailable`, `accountChanged:false`, `retained`).
 * Until now the component acted only on `res.ok`, so the refusal, a 500 and a signed-out 401 all looked like
 * nothing happening. These are the words for each, and the only place they are written.
 */
import {
  exportFailureMessage,
  deleteFailureMessage,
  EXPORT_DATA_DESCRIPTION,
  DELETE_ACCOUNT_DESCRIPTION,
} from '@/lib/account/accountDataCopy';

const refusal = {
  error: 'deletion_incomplete_unavailable',
  message:
    "We can't complete full account deletion automatically yet. Your account " +
    'and content have not been changed. Please contact support so we can ' +
    'handle your request safely.',
  accountChanged: false,
  nextStep: 'contact_support',
  retained: [
    { label: 'your writing', rows: 3 },
    { label: 'conversations', rows: 12 },
    { label: 'your writing', rows: 1 },
  ],
};

describe('deleteFailureMessage', () => {
  it('409: says nothing was changed, names what is held once each, and points to support', () => {
    const m = deleteFailureMessage(409, refusal);
    expect(m).toContain('have not been changed');
    expect(m).toContain('contact support');
    expect(m).toContain('Still held: your writing, conversations.');
    expect(m.match(/your writing/g)).toHaveLength(1);
  });

  it('409 without a readable body still says nothing was changed', () => {
    const m = deleteFailureMessage(409, null);
    expect(m).toMatch(/nothing was changed/i);
  });

  it('500: says the account was not closed, and does not claim "nothing was changed"', () => {
    const m = deleteFailureMessage(500, { error: 'Failed to delete account' });
    expect(m).toMatch(/couldn't close your account/i);
    expect(m).not.toMatch(/nothing was changed/i);
  });

  it('401: asks the member to sign in again', () => {
    expect(deleteFailureMessage(401, { error: 'Authentication required' })).toMatch(/sign in again/i);
  });

  it('400: the confirmation did not match', () => {
    expect(deleteFailureMessage(400, { error: 'Username confirmation does not match' })).toMatch(/username/i);
  });

  it('no response at all (a thrown fetch)', () => {
    expect(deleteFailureMessage(null, null)).toMatch(/connection/i);
  });

  it('never returns an empty string, whatever the status', () => {
    for (const status of [null, 400, 401, 403, 404, 409, 429, 500, 502, 503]) {
      expect(deleteFailureMessage(status, undefined).length).toBeGreaterThan(10);
    }
  });
});

describe('exportFailureMessage', () => {
  it('401 asks to sign in again; 500 and others say it could not be prepared; no response says connection', () => {
    expect(exportFailureMessage(401)).toMatch(/sign in again/i);
    expect(exportFailureMessage(500)).toMatch(/couldn't prepare your export/i);
    expect(exportFailureMessage(503)).toMatch(/couldn't prepare your export/i);
    expect(exportFailureMessage(null)).toMatch(/connection/i);
  });
});

describe('descriptions', () => {
  it('export says what it holds and what it leaves out', () => {
    expect(EXPORT_DATA_DESCRIPTION).toContain('profile, settings, session history and developmental memories');
    expect(EXPORT_DATA_DESCRIPTION).toContain('does not include your writing or Works');
  });

  it('delete says it closes the account when it can, and otherwise changes nothing', () => {
    expect(DELETE_ACCOUNT_DESCRIPTION).toMatch(/closes your account/i);
    expect(DELETE_ACCOUNT_DESCRIPTION).toMatch(/nothing is changed/i);
    expect(DELETE_ACCOUNT_DESCRIPTION).not.toMatch(/permanent|all associated data/i);
  });
});
