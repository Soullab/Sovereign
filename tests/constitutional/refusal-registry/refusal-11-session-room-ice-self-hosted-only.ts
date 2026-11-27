import type { RefusalCheck } from './harness';

/**
 * Refusal R-A5 — the Session Room hands the peer connection ONLY self-hosted ICE endpoints.
 *
 * Sovereignty = control of signaling, relay, storage, lifecycle. A third-party STUN/TURN
 * server in the media path puts a third party in the sacred field. This proof attempt
 * inspects the two sources that determine the ICE configuration a browser uses —
 * the credential route and the room page — and asserts:
 *   (a) neither emits a third-party STUN/TURN host, and
 *   (b) the credential route FAILS CLOSED when unconfigured (no silent public fallback).
 *
 * Source-level structural assertion, per the registry idiom (no third-party literal exists),
 * not a behavioural test. Spec: docs/specs/NATIVE_SESSION_ROOM_PHASE_A_REFUSAL_TESTS_2026-07-05.md.
 */

const ROUTE = 'app/api/open/session-room/[roomId]/turn-credentials/route.ts';
const PAGE = 'app/open/session-room/[roomId]/page.tsx';
// Since 350e58dfa (2026-10-29) the route is a thin wrapper; the admission logic lives here.
const RUNTIME = 'lib/encounters/roomRuntime.ts';

// Any well-known third-party ICE host literal is a violation. This is intentionally broad:
// the correct config references only our own host (an env var), never a hardcoded provider.
const THIRD_PARTY =
  /stun\.l\.google\.com|stun[0-9]?\.google|global\.stun|twilio|xirsys|metered\.ca|stunprotocol|\bstun:stun\d?\.[a-z0-9-]+\.(com|net|org)/i;

export const check: RefusalCheck = {
  id: 'R-A5',
  refusal: 'Session Room offers the peer connection only self-hosted ICE endpoints (no third-party relay)',
  grade: 'B',
  enforcedBy: 'turn-credentials route emits only self-hosted coturn URLs and fails closed; room page has no public-STUN fallback',
  evidence: `${ROUTE} (delegates to createTurnHandlers) + ${RUNTIME} (no mint → 503 ROOM_INTEGRATION_HELD; any relay → 503 LIVE_RELAY_HELD) + ${PAGE}. Re-anchored 2026-11-26.`,
  violationAttempted:
    'find a third-party STUN/TURN host literal in the credential route or the room page, or a silent public-relay fallback when TURN is unconfigured',
  passingAuthorizes:
    'the ICE configuration these two sources produce contains only self-hosted endpoints unless an explicit external-relay authorization is added',
  passingDoesNotAuthorize:
    'that media is end-to-end encrypted, or that a deployed coturn is in fact sovereign — only that no third-party endpoint is emitted by these sources',
  hostileForkMustChange:
    'add a third-party STUN/TURN URL literal (or a public-endpoint fallback) to the credential route or the room page — a visible diff',

  run(io) {
    const route = io.read(ROUTE);
    const page = io.read(PAGE);

    if (THIRD_PARTY.test(route)) {
      io.fail('third-party ICE host present in turn-credentials route', 'R-A5 falsified');
    } else {
      io.pass('turn-credentials route emits no third-party ICE host');
    }

    // Fail-closed: the route delegates to createTurnHandlers, which refuses with 503
    // when no mint is configured and refuses ANY relay server (host candidates only).
    const runtime = io.read(RUNTIME);
    const delegates = /export const GET = createTurnHandlers\(\{[\s\S]*?\}\)\.GET;/.test(route);
    const handler = runtime.slice(runtime.indexOf('export function createTurnHandlers'));
    const noMintClosed = /if\(!deps\.mint\)return json\(\{code:'ROOM_INTEGRATION_HELD'\},503\)/.test(handler);
    const noRelay = /if\(result\.iceServers\.length!==0\)return json\(\{code:'LIVE_RELAY_HELD'\},503\)/.test(handler);
    if (delegates && noMintClosed && noRelay) {
      io.pass('turn-credentials fails closed (no mint → 503; any relay → 503; no public fallback)');
    } else {
      io.fail('turn-credentials lacks a fail-closed path — a public fallback could leak in', `R-A5 at risk: delegates=${delegates} noMintClosed=${noMintClosed} noRelay=${noRelay}`);
    }

    if (THIRD_PARTY.test(runtime)) {
      io.fail('third-party ICE host present in room runtime', 'R-A5 falsified');
    } else {
      io.pass('room runtime emits no third-party ICE host');
    }

    if (THIRD_PARTY.test(page)) {
      io.fail('room page hardcodes a third-party STUN/TURN endpoint', 'R-A5 falsified');
    } else {
      io.pass('room page has no hardcoded third-party ICE endpoint');
    }
  },
};
