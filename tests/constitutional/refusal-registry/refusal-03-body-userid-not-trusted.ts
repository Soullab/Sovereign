import type { RefusalCheck } from './harness';

/**
 * Refusal 03 — Request identity is never taken from a client-asserted claim.
 *
 * The identity resolver derives the member id ONLY from a validated
 * auth_sessions credential (session cookie or x-session-token). A bare
 * x-member-id / maia_member_id claim is honoured only if it matches the verified
 * session; a mismatch is rejected as impersonation. No request body is read.
 */

const RESOLVER = 'lib/auth/getMemberFromRequest.ts';
const AUTHORITY = 'lib/auth/sessionCredentialAuthority.ts';

export const check: RefusalCheck = {
  id: 'R03',
  refusal: 'Request identity is never trusted from a client-asserted claim (body userId / bare header)',
  grade: 'A',
  enforcedBy: 'lib/auth/getMemberFromRequest.ts + lib/auth/sessionCredentialAuthority.ts — identity resolved only from a live auth_sessions token',
  evidence: 'authority ← resolveSessionCredentialAuthority (live, unrevoked auth_sessions row; conflict refused); !authority.ok → null; claims.some(claim !== authority.memberId) → null. Re-anchored 2026-11-26 after 0f726b4db (2026-10-26) replaced verifiedMemberId.',
  violationAttempted: 'find identity being assigned from a non-session source, a missing no-session/impersonation guard, or a request-body read in the resolver',
  passingAuthorizes: 'the identity resolver derives member id only from a validated session credential',
  passingDoesNotAuthorize: 'that every route USES this resolver — route-level adoption is a separate check; this proves only the resolver never trusts a bare claim',
  hostileForkMustChange: 'make the resolver assign identity from the request body / a bare header, or delete the impersonation guard — visible diff',

  run(io) {
    const src = io.read(RESOLVER);
    const authoritySrc = io.read(AUTHORITY);

    // 0. The session authority itself resolves identity only from a live, unrevoked
    //    auth_sessions row, and refuses conflicting credentials.
    const liveSession =
      /FROM auth_sessions s[\s\S]*?WHERE s\.session_token = \$1[\s\S]*?s\.revoked = FALSE[\s\S]*?s\.expires_at > NOW\(\)/.test(authoritySrc);
    const conflict = /credential_conflict/.test(authoritySrc);
    const memberFromRow = /memberId:\s*authority\.member_id/.test(authoritySrc);
    if (liveSession && conflict && memberFromRow) {
      io.pass('Session authority reads identity only from a live auth_sessions row', 'unrevoked, unexpired; conflicting credentials refused');
    } else {
      io.fail('Session authority shape changed — re-audit', `liveSession=${liveSession} conflict=${conflict} memberFromRow=${memberFromRow}`);
    }

    // 1. Every exit of the resolver returns null or the session authority's member id.
    //    `authority` is bound only from resolveSessionCredentialAuthority().
    const returns = [...src.matchAll(/return\s+([^;]+);/g)].map((m) => m[1].trim());
    const allowedReturn = /^(null|authority\.memberId|authority\.ok \? authority\.memberId : null)$/;
    const badReturns = returns.filter((r) => !allowedReturn.test(r));
    const bindings = [...src.matchAll(/\bauthority\s*=\s*([^;(]+)/g)].map((m) => m[1].trim());
    const badBindings = bindings.filter((b) => !/^await resolveSessionCredentialAuthority$/.test(b));
    if (returns.length === 0 || bindings.length === 0) {
      io.fail('No resolver exits or authority binding found', 'resolver shape changed — re-audit');
    } else if (badReturns.length === 0 && badBindings.length === 0) {
      io.pass('Identity returned only from the session authority / null', `${returns.length} exits, ${bindings.length} bindings`);
    } else {
      io.fail('Identity returned from a non-session source', [...badReturns, ...badBindings].join(' | '));
    }

    // 1b. Client identity claim headers never reach the credential list.
    const credentialCalls = [...src.matchAll(/resolveSessionCredentialAuthority\(\[([\s\S]*?)\]\)/g)].map((m) => m[1]);
    if (credentialCalls.length > 0 && credentialCalls.every((c) => !/member-id|member_id/.test(c))) {
      io.pass('No identity claim is presented as a credential', 'only maia_session / x-session-token / explicit token');
    } else {
      io.fail('An identity claim is presented as a credential', `${credentialCalls.length} credential lists`);
    }

    // 2. No verified session → returns null (never falls through to a claim).
    if (/if\s*\(\s*!authority\.ok\s*\)\s*return\s+null/.test(src)) {
      io.pass('Returns null when there is no verified session');
    } else {
      io.fail('Missing "no verified session → null" guard');
    }

    // 3. Any identity claim that differs from the verified session is rejected
    //    as impersonation (the block's first exit is `return null`).
    if (/claims\.some\(\s*\(claim\)\s*=>\s*claim\s*!==\s*authority\.memberId\s*\)\s*\)\s*\{[\s\S]*?return\s+null/.test(src)) {
      io.pass('Rejects mismatched identity claim (impersonation guard)');
    } else {
      io.fail('Missing impersonation-rejection guard');
    }

    // 4. The resolver never reads a request body / json payload for identity.
    if (/\.json\s*\(\s*\)|request\.body|req\.body|body\.userId/.test(src)) {
      io.fail('Request body referenced in identity resolver', 'possible body-derived identity');
    } else {
      io.pass('No request body read in identity resolver');
    }
  },
};
