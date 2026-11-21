import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REBUILD_LOAD_STAGES,
  RebuildLoadFailure,
  rebuildLoadStage,
  rebuildLoadStatus,
} from '../loadFailure';

const src = (name: string) => readFileSync(join(process.cwd(), name), 'utf8');
const CLIENT = 'app/writers-studio/rebuild/RebuildStudioClient.tsx';

describe('rebuild load failure: stage and status, never prose or identity', () => {
  it('each stage of load() is carried and returned', () => {
    for (const stage of REBUILD_LOAD_STAGES) {
      expect(rebuildLoadStage(new RebuildLoadFailure(stage))).toBe(stage);
    }
  });

  it('an HTTP status discriminates the causes a stage cannot', () => {
    // 404 is ownership; 500 is schema or connection. Same stage, different fault.
    expect(rebuildLoadStatus(new RebuildLoadFailure('context', 404))).toBe(404);
    expect(rebuildLoadStatus(new RebuildLoadFailure('context', 500))).toBe(500);
    // A stage that issues no request reports no status. 0 is not a status.
    expect(rebuildLoadStatus(new RebuildLoadFailure('manuscript-identity'))).toBe(0);
  });

  it('authored prose, a path, a stack or a forged stage cannot reach a log', () => {
    const privateMarker = 'Chapter 10: the sentence the writer actually wrote';
    for (const failure of [
      new Error(privateMarker),
      { stage: privateMarker, status: 500 },
      { stage: 'context', status: 500, message: privateMarker },
      privateMarker,
      null,
      undefined,
    ]) {
      const stage = rebuildLoadStage(failure);
      expect(stage).toBe('UNKNOWN');
      expect(stage).not.toContain(privateMarker);
      expect(rebuildLoadStatus(failure)).toBe(0);
    }
  });

  it('a forged stage on a real failure is refused, not echoed', () => {
    const failure = new RebuildLoadFailure('context', 404);
    (failure as unknown as { stage: string }).stage = '/private/manuscript.docx';
    expect(rebuildLoadStage(failure)).toBe('UNKNOWN');
  });

  it('an implausible status is masked rather than reported as evidence', () => {
    for (const value of [-1, 0, 99, 600, 1.5, 1e99, NaN, '404', undefined, null]) {
      const failure = new RebuildLoadFailure('context');
      (failure as unknown as { status: unknown }).status = value;
      expect(rebuildLoadStatus(failure)).toBe(0);
    }
  });

  it('every throw site in load() names a stage, and none throws a bare Error', () => {
    const code = src(CLIENT);
    const load = code.slice(
      code.indexOf('const load = useCallback'),
      code.indexOf('useEffect(() => { void load(); })'),
    );
    expect(load).toContain("RebuildLoadFailure('manuscript-list', list.status)");
    expect(load).toContain("RebuildLoadFailure('manuscript-identity')");
    expect(load).toContain("RebuildLoadFailure('context', res.status)");
    expect(load).toContain("RebuildLoadFailure('begin-draft')");
    expect(load).toContain("RebuildLoadFailure('context-after-begin', res.status)");
    expect(load).not.toContain('throw new Error(');
  });

  it('the load failure is recorded, classified, and never as the raw error', () => {
    const code = src(CLIENT);
    expect(code).toContain('rebuildLoadStage(error)');
    expect(code).toContain('rebuildLoadStatus(error)');
    // The September design logged the error object and sliced the response
    // body. Both are refused here: the body is the member's prose, and an
    // Error's message is whatever threw it.
    expect(code).not.toContain("rebuild load failed', error");
    expect(code).not.toContain('res.text()');
    expect(code).not.toContain('detail.slice');
  });

  it("the member's sentence is unchanged and names no stage", () => {
    const code = src(CLIENT);
    expect(code).toContain(
      "setMessage('The rebuilt Studio could not read this manuscript just now. Nothing has changed.');",
    );
    for (const stage of REBUILD_LOAD_STAGES) {
      expect(code).not.toContain(`could not read this manuscript just now. ${stage}`);
    }
  });
});
