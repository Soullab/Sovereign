import { doorwayFirstArrivalPath, doorwayReturnPath } from '@/lib/studios/doorwayReturnPath';

describe('doorwayReturnPath', () => {
  it("preserves the exact allowlisted College Essay path for Writer's Studio", () => {
    expect(doorwayReturnPath('writer', '/writers-studio', 'college-essay'))
      .toBe('/writers-studio?path=college-essay');
  });

  it('falls back for unknown or malformed Writer path input', () => {
    expect(doorwayReturnPath('writer', '/writers-studio', 'https://evil.example/')).toBe('/writers-studio');
    expect(doorwayReturnPath('writer', '/writers-studio', '../college-essay')).toBe('/writers-studio');
    expect(doorwayReturnPath('writer', '/writers-studio', null)).toBe('/writers-studio');
  });

  it('never applies a Writer path to another Studio', () => {
    expect(doorwayReturnPath('sound', '/listen', 'college-essay')).toBe('/listen');
  });
});

describe('doorwayFirstArrivalPath (WS-WELCOME-01)', () => {
  it("sends a new writer with no chosen path to the welcome invitation", () => {
    expect(doorwayFirstArrivalPath('writer', '/writers-studio', null)).toBe('/writers-studio/welcome');
    expect(doorwayFirstArrivalPath('writer', '/writers-studio', undefined)).toBe('/writers-studio/welcome');
  });

  it('NEGATIVE: a writer who chose an allowlisted path keeps that path, not the welcome page', () => {
    expect(doorwayFirstArrivalPath('writer', '/writers-studio', 'college-essay')).toBe('/writers-studio?path=college-essay');
  });

  it('NEGATIVE: a hostile path value is never used; the writer gets the welcome page', () => {
    expect(doorwayFirstArrivalPath('writer', '/writers-studio', 'https://evil.example/')).toBe('/writers-studio/welcome');
  });

  it('NEGATIVE: other Studios are untouched', () => {
    expect(doorwayFirstArrivalPath('sound', '/listen', null)).toBe('/listen');
    expect(doorwayFirstArrivalPath('astrology', '/astrology', 'college-essay')).toBe('/astrology');
  });

  it('returning sign-in is unchanged: doorwayReturnPath never points at the welcome page', () => {
    expect(doorwayReturnPath('writer', '/writers-studio', null)).toBe('/writers-studio');
  });
});
