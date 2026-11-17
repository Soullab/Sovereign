/**
 * Account → Your Data: the words promise only what the routes do, and a refusal is not swallowed.
 *
 *  - Export said "Download all your data". /api/members/export-data returns profile, settings, session history,
 *    developmental memories and a Google-connected flag, and nothing on a member's Works or writing.
 *  - Delete said "Permanently delete your account and all associated data". The release authority says permanent
 *    erasure is NOT certified, and the route closes the account only when it can: otherwise it refuses with a 409
 *    that names what it holds, or fails with a 500. The handler acted only on `res.ok`, so both refusals showed
 *    the member nothing at all.
 *
 * The copy law below is tied to the capability read, not to a frozen string: if erasure is later certified, or the
 * export gains Works, the matching sentence is allowed (and required) to change — a promise follows the capability.
 *
 * Source-reading, comments stripped first (a sentence that documents the rule must not count as obeying it).
 * AccountSettings is a ~3,000-line component with a native bridge; the message logic is exercised behaviourally in
 * accountDataMessages.test.ts, and this file pins that the component uses it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { writerReleaseAuthority } from '@/lib/writersStudio/releaseAuthority';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const COMPONENT = 'components/account/AccountSettings.tsx';
const EXPORT_ROUTE = strip(read('app/api/members/export-data/route.ts'));

/** The Data section's two descriptive sentences, as the component renders them. */
function renderedDescriptions(src: string) {
  const code = strip(src);
  const start = code.indexOf('const renderData');
  const section = code.slice(start, code.indexOf('if (loading)', start));
  return { section, code };
}

/** Named violations of the copy law; empty is conforming. */
function copyViolations(src: string): string[] {
  const found: string[] = [];
  const { section } = renderedDescriptions(src);
  const authority = writerReleaseAuthority();
  const exportHasWorks = /member_manuscripts|living_works/.test(EXPORT_ROUTE);

  if (!authority.permanentErasureCertified && /permanent|all associated data|all your data|everything/i.test(deleteSentence(section))) {
    found.push('delete-promises-erasure-the-capability-read-says-is-not-certified');
  }
  if (!exportHasWorks && /\ball (of )?your data\b|everything/i.test(exportSentence(section))) {
    found.push('export-promises-all-data-but-omits-works');
  }
  if (!exportHasWorks && !/does not include your writing or Works/.test(exportSentence(section))) {
    found.push('export-does-not-say-it-omits-works');
  }
  return found;
}

/** The text of the first <p> after a heading, or the copy constant it renders. */
function sentenceAfter(section: string, heading: string, constant: string): string {
  const at = section.indexOf(heading);
  const after = section.slice(at, at + 700);
  if (after.includes(`{${constant}}`)) {
    const all = strip(read('lib/account/accountDataCopy.ts'));
    const m = new RegExp(`export const ${constant}\\s*=\\s*([\\s\\S]*?);\\n`).exec(all);
    return m ? m[1] : '';
  }
  const p = /<p[^>]*>([\s\S]*?)<\/p>/.exec(after);
  return p ? p[1] : '';
}
const exportSentence = (section: string) => sentenceAfter(section, 'Export Your Data', 'EXPORT_DATA_DESCRIPTION');
const deleteSentence = (section: string) => sentenceAfter(section, 'Delete Account', 'DELETE_ACCOUNT_DESCRIPTION');

describe('Account → Your Data — copy promises only what the capability read and the routes allow', () => {
  it('the export and delete sentences are conforming', () => {
    expect(copyViolations(read(COMPONENT))).toEqual([]);
  });

  it('the old promises are gone', () => {
    const { code } = renderedDescriptions(read(COMPONENT));
    expect(code).not.toContain('Download all your data');
    expect(code).not.toContain('Permanently delete your account and all associated data');
  });
});

describe('Account → Your Data — a refused export or deletion is shown, not swallowed', () => {
  const code = strip(read(COMPONENT));
  const slice = (from: string, to: string) => code.slice(code.indexOf(from), code.indexOf(to, code.indexOf(from)));
  const exportBody = slice('const exportData = useCallback', 'const deleteAccount = useCallback');
  const deleteBody = slice('const deleteAccount = useCallback', 'const handleChangePassword');

  it('exportData reports a non-OK response and a thrown error', () => {
    expect(exportBody).toContain('exportFailureMessage(');
    expect(exportBody).toContain('setExportMessage(');
  });

  it('deleteAccount reports a non-OK response (409 refusal, 500, 401) and a thrown error', () => {
    expect(deleteBody).toContain('deleteFailureMessage(');
    expect(deleteBody).toContain('setDeleteMessage(');
  });

  it('both messages are rendered in the Data section', () => {
    const { section } = renderedDescriptions(read(COMPONENT));
    expect(section).toContain('{exportMessage}');
    expect(section).toContain('{deleteMessage}');
  });

  it('the delete request body is untouched (route.test.ts pins it: no memberId)', () => {
    expect(deleteBody).toContain('confirmUsername: deleteConfirm');
    expect(deleteBody).not.toMatch(/memberId/);
  });
});

describe('lethality — each defeat candidate fails the same checks', () => {
  const real = read(COMPONENT);

  it('delete copy that still promises permanent deletion of everything', () => {
    const candidate = real.replace('{DELETE_ACCOUNT_DESCRIPTION}', 'Permanently delete your account and all associated data. This cannot be undone.');
    expect(candidate).not.toBe(real);
    expect(copyViolations(candidate)).toContain('delete-promises-erasure-the-capability-read-says-is-not-certified');
  });

  it('export copy that still says "all your data"', () => {
    const candidate = real.replace('{EXPORT_DATA_DESCRIPTION}', 'Download all your data including profile, settings, and session history.');
    expect(candidate).not.toBe(real);
    expect(copyViolations(candidate)).toContain('export-promises-all-data-but-omits-works');
  });

  it('export copy that is silent about omitting Works', () => {
    const candidate = real.replace('{EXPORT_DATA_DESCRIPTION}', 'Download your profile, settings and session history.');
    expect(candidate).not.toBe(real);
    expect(copyViolations(candidate)).toContain('export-does-not-say-it-omits-works');
  });
});
