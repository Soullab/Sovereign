/**
 * WS-STEP4 B (founder decision B, 2026-11-20): "Talk about this place" opens the conversation EMPTY.
 * Benchmark 01: the door placed three app-written sentences in the composer; typed text merged into them and was sent under the
 * writer's name (S4, S6). The chapter travels as context (the "You selected" panel and the conversation's sectionId), never as words.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VIEW = readFileSync(join(process.cwd(), 'app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx'), 'utf8');

describe('Talk about this place', () => {
  it('⭐ MUST FAIL IF the door places app-written words in the composer', () => {
    const door = VIEW.slice(VIEW.indexOf('className="p4r1-talk"'), VIEW.indexOf('Talk about this place'));
    expect(door).toContain("onClick={() => openWorkConversation('')}");
    expect(VIEW).not.toContain('want to work with this place directly');
    expect(VIEW).not.toContain('Start with what is happening here and ask me one useful question');
    expect(VIEW).not.toContain('Do not rewrite anything unless I ask.');
  });
  it('keeps the selected place visible as context', () => {
    expect(VIEW).toContain('<span className="p4r1-eyebrow">You selected</span>');
  });
});
