/**
 * B0 — founder ruling 2026-11-19 (live walk WS-LIVE-WALK-01): "The manuscript remains primary. MAIA accompanies the writing.
 * Conversation must not replace the page." This SUPERSEDES the 2026-11-12 direction pinned here before ("the middle is where the
 * creative process between MAIA and writer happens"), which replaced the page with the conversation; in production the conversation
 * card also carried `p4r1-context-card` (position: fixed), so from 2026-11-12 the centre stood EMPTY while the conversation floated
 * over MAIA's column (witnessed live at 1440px, card at x=992, position: fixed).
 * Source-level pins (jest has no layout engine); the browser walk at desktop, laptop and phone widths is the acceptance.
 * The file keeps its name so its history shows the reversal.
 */
import fs from 'node:fs';
import path from 'node:path';
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const view = read('app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx');
const controller = read('app/dev/writers-studio-pc3-live/P4R1WriteEditController.tsx');
const liveCss = read('app/dev/writers-studio-p4r1/p4r1-live.css');

describe('B0: the page stays in the centre; the conversation lives beside it in MAIA\'s column', () => {
  it('⭐ MUST FAIL IF the conversation replaces the page in the centre', () => {
    expect(view).toMatch(/\) : craftVisible \? craftWork : workSurface\}/);
    expect(view).not.toMatch(/workCentre/);
    expect(view).not.toMatch(/data-write-centre-conversation/);
  });

  it('⭐ MUST FAIL IF the conversation is not rendered in MAIA\'s column', () => {
    /* 'const blankArrival =' (with the space): 'const blankArrival' alone first matches blankArrivalVisible, ABOVE writeMaia, so the
       2026-11-12 version of this pin sliced an empty string and its not.toMatch passed vacuously. */
    const start = view.indexOf('const writeMaia = props.work ? (');
    const maia = view.slice(start, view.indexOf('const blankArrival =', start));
    expect(maia.length).toBeGreaterThan(500);
    expect(maia).toMatch(/\{workConversationOpen \? \(\s*workConversation\s*\)/);
  });

  it('⭐ MUST FAIL IF the conversation wrapper carries the fixed floating-card class', () => {
    const wrapper = view.match(/<div className="([^"]*)" data-p4r1-work-conversation/);
    expect(wrapper).not.toBeNull();
    expect(wrapper![1]).not.toMatch(/p4r1-context-card/);
    /* the class really is a fixed overlay; if that ever changes this pin can be revisited, not silently kept */
    expect(liveCss).toMatch(/\.p4r1-root \.p4r1-context-card\s*\{[^}]*position:\s*fixed/);
  });

  it('opening a conversation leaves Full Canvas (which folds MAIA\'s column to zero) and keeps the page', () => {
    const open = view.slice(view.indexOf('const openWorkConversation'), view.indexOf('const blankArrivalVisible'));
    expect(open).toMatch(/setCanvas\(false\)/);
    expect(open).not.toMatch(/setProseView|navigateMode|onMode/);
  });

  it('⭐ the letter stays in view on the right while the writer talks', () => {
    expect(view).not.toMatch(/<div hidden=\{workConversationOpen\} data-write-letter="true"/);
    expect(view).toMatch(/<div data-write-letter="true"/);
  });

  it('"Talk about it" arrives as Focus (the desk opens on the passage) and never as a revision request', () => {
    const talk = controller.slice(controller.indexOf('const onTalkPassIssue'), controller.indexOf('if (phase !== \'ready\' || !context)'));
    expect(talk).toMatch(/next\.set\('insightAction', 'focus'\)/);
    expect(talk).not.toMatch(/try-revision/);
    expect(controller).toMatch(/onTalkPassIssue=\{onTalkPassIssue\}/);
  });
});

describe('relationship visibility on return (WS-LIVE-WALK-01 W5)', () => {
  it('the whole-Work door and "What do I do next?" use the same label', () => {
    expect(view).toMatch(/talkWholeLabel: priorConversationLabel\(priorConversation,/);
    expect(view).toMatch(/const door = priorConversationLabel\(priorConversation,/);
  });
  it('discovery only reads: it never opens, adopts or sends', () => {
    const eff = view.slice(view.indexOf('const [priorConversation'), view.indexOf('const [proseView'));
    expect(eff).toMatch(/threadsOn\(|threadsOnLivingWorkAsk\(/);
    expect(eff).not.toMatch(/\bask\(|askLivingWork\(|adopt\(|method: 'POST'/);
  });
});

describe('conversation space contract (founder direction 2026-11-19)', () => {
  const css = read('app/dev/writers-studio-p4r1/p4r1-live.css');
  const contract = css.slice(css.indexOf('CONVERSATION SPACE CONTRACT'));
  it('⭐ MUST FAIL IF the open conversation is not the only flexible child of MAIA\'s column body', () => {
    expect(contract).toMatch(/\.fr-mbody\{display:flex;flex-direction:column;overflow:hidden\}/);
    expect(contract).toMatch(/\.fr-mbody > :not\(\[data-write-conversation-beside='true'\]\)\{flex:0 0 auto\}/);
    expect(contract).toMatch(/\.fr-mbody > \[data-write-conversation-beside='true'\]\{flex:1 1 auto;min-height:0;height:auto\}/);
  });
  it('the letter yields while talking: one line, on demand, still mounted', () => {
    expect(view).toMatch(/data-letter-yields=\{workConversationOpen && !letterShownWhileTalking \? 'true' : 'false'\}/);
    expect(contract).toMatch(/\[data-letter-yields='true'\] > :not\(\[data-write-letter-toggle\]\)\{display:none\}/);
    expect(view).toMatch(/if \(!workConversationOpen\) setLetterShownWhileTalking\(false\)/);
  });
  it('the footer and the relationship note step aside at every width while a conversation is open', () => {
    expect(contract).toMatch(/:has\(\[data-write-conversation-beside='true'\]\) \.fr-foot\{display:none\}/);
    expect(contract).toMatch(/:has\(\[data-write-conversation-beside='true'\]\) \[data-p4r1-maia-relationship\]\{display:none\}/);
    expect(contract).not.toMatch(/max-width:1279px/);
  });
});
