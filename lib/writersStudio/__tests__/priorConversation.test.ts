import { priorConversationLabel, priorConversationOffer } from '../priorConversation';

const T = (id: string, turnCount: number, openedAt = '2026-11-19T19:10:00Z') => ({ id, openedAt, turnCount });

describe('priorConversationOffer — what the door may truthfully say', () => {
  it('⭐ MUST FAIL IF an unavailable discovery is read as "no conversations" or as one', () => {
    expect(priorConversationOffer({ kind: 'unavailable', reason: 'http_500' })).toEqual({ kind: 'none' });
  });
  it('no threads → ordinary door', () => {
    expect(priorConversationOffer({ kind: 'threads', threads: [] })).toEqual({ kind: 'none' });
  });
  it('an empty thread (no turns) is not a conversation to continue', () => {
    expect(priorConversationOffer({ kind: 'threads', threads: [T('a', 0)] })).toEqual({ kind: 'none' });
  });
  it('one thread with turns → continue it', () => {
    expect(priorConversationOffer({ kind: 'threads', threads: [T('a', 4)] })).toMatchObject({ kind: 'one', turnCount: 4 });
  });
  it('⭐ MUST FAIL IF several threads collapse into one (the writer chooses, never MAIA)', () => {
    expect(priorConversationOffer({ kind: 'threads', threads: [T('a', 4), T('b', 2)] })).toEqual({ kind: 'several', count: 2 });
  });
});

describe('priorConversationLabel', () => {
  it('ordinary label when there is nothing to continue', () => {
    expect(priorConversationLabel({ kind: 'none' }, 'Talk about the whole Work')).toEqual({ label: 'Talk about the whole Work', note: null });
  });
  it('one conversation names its date', () => {
    const r = priorConversationLabel({ kind: 'one', openedAt: '2026-11-19T19:10:00Z', turnCount: 4 }, 'x');
    expect(r.label).toBe('Continue our conversation');
    expect(r.note).toMatch(/19 November/);
  });
  it('an unreadable date never prints "Invalid Date"', () => {
    const r = priorConversationLabel({ kind: 'one', openedAt: 'nope', turnCount: 1 }, 'x');
    expect(r.note).not.toMatch(/Invalid/);
  });
  it('several conversations say the writer chooses', () => {
    expect(priorConversationLabel({ kind: 'several', count: 3 }, 'x').note).toMatch(/You choose which one/);
  });
});
