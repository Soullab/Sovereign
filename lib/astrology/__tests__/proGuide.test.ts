/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { PRO_CONTROLS, proGuideInstruction } from '../proGuide';
import { proAskSystemPrompt, spiralFieldLine } from '../proAskMaiaSections';

const ROOT = path.resolve(__dirname, '../../..');
// The workstation and the shared astrology views it renders.
const UI_DIRS = ['app/astrology/pro-preview', 'components/astrology'];

function uiSource(): string {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(full); continue; }
      if (/\.tsx?$/.test(entry.name)) out.push(fs.readFileSync(full, 'utf8'));
    }
  };
  for (const d of UI_DIRS) walk(path.join(ROOT, d));
  return out.join('\n');
}

const UI = uiSource();
const shown = (label: string) => UI.includes(label);

describe('MAIA is told only about controls Astrology Pro actually has', () => {
  it.each(PRO_CONTROLS.map((c) => [c.label]))('"%s" appears in the Pro UI source', (label) => {
    expect(shown(label)).toBe(true);
  });

  it('the check can fail: an invented control is not found', () => {
    expect(shown('Predict my client\'s future')).toBe(false);
  });

  it('labels are unique, and every control says where it is and what it does', () => {
    expect(new Set(PRO_CONTROLS.map((c) => c.label)).size).toBe(PRO_CONTROLS.length);
    for (const c of PRO_CONTROLS) {
      expect(c.where.trim().length).toBeGreaterThan(0);
      expect(c.does.trim().length).toBeGreaterThan(0);
    }
  });

  it('covers all nine tools on the rail', () => {
    for (const tool of ['Chart', 'Timing', 'Relationships', 'Places', 'Traditions', 'Readings', 'Research', 'Study', 'Saved charts']) {
      expect(PRO_CONTROLS.some((c) => c.label === tool)).toBe(true);
    }
  });
});

describe('what MAIA is told', () => {
  const text = proGuideInstruction();

  it('names every control exactly as shown', () => {
    for (const c of PRO_CONTROLS) expect(text).toContain(`"${c.label}"`);
  });

  it('states her scope: astrology, the workstation, and its technical side', () => {
    expect(text).toContain('astrology (the chart in front of them, techniques, and the traditions)');
    expect(text).toContain('the workstation itself');
    expect(text).toContain('its technical side');
    expect(text).toContain('the main MAIA conversation is the place for the rest of life');
  });

  it('forbids inventing controls and acting for the astrologer', () => {
    expect(text).toContain('Only name controls from this list');
    expect(text).toContain('do not invent one or guess at a location');
    expect(text).toContain('You cannot press any control, save a chart, make a link or change a setting for them');
  });

  it('explains Free and Pro as rooms, not priced plans, and never as public', () => {
    expect(text).toContain('Basic Astrology and Astrology Pro are two different rooms');
    expect(text).toContain('there are no prices or tiers to quote');
    expect(text).toContain('open at present to invited testers');
    expect(text).toContain('open by individual invitation');
    expect(text).toContain('never imply either is publicly available');
  });

  it('carries the declared calculation limits', () => {
    expect(text).toContain('not yet independently certified');
    expect(text).toContain('66° latitude');
  });

  it('client consent steps are stated where the controls are', () => {
    expect(text).toContain('permission to keep the birth details');
    expect(text).toContain('only after the astrologer ticks that the person agreed');
  });
});

describe('MAIA speaks to the astrologer, not about them', () => {
  it('in Ask and in Mentor', () => {
    for (const mode of ['ask', 'mentor'] as const) {
      const prompt = proAskSystemPrompt('natal', 'Sun Gemini 24.39°', { mode });
      expect(prompt).toContain('Address the astrologer directly as "you"');
      expect(prompt).not.toContain('hand meaning back to the astrologer and their client');
    }
  });
});

describe('the Pro Ask prompt carries the guide', () => {
  it('in Ask and in Mentor', () => {
    for (const mode of ['ask', 'mentor'] as const) {
      const prompt = proAskSystemPrompt('natal', 'Sun Gemini 24.39°', { mode });
      expect(prompt).toContain('THE WORKSTATION YOU ARE IN');
      expect(prompt).toContain('"Saved charts"');
    }
  });
});

describe('MAIA knows the astrologer\'s own chart is theirs (phone witness 2026-11-24)', () => {
  it('says so without memory on, and never asks whose chart it is', () => {
    const prompt = proAskSystemPrompt('natal', 'Sun Gemini 24.39°', { ownChart: true });
    expect(prompt).toContain('The chart below is the astrologer\'s own');
    expect(prompt).toContain('never ask whose chart it is');
  });
  it('says nothing of ownership for a client chart', () => {
    const prompt = proAskSystemPrompt('natal', 'Sun Gemini 24.39°', {});
    expect(prompt).not.toContain('The chart below is the astrologer\'s own');
    expect(prompt).not.toContain('your chart');
  });
  it('memory on keeps the fuller own-chart instruction', () => {
    const prompt = proAskSystemPrompt('natal', 'Sun Gemini 24.39°', { ownChart: true, personal: { kept: '' } });
    expect(prompt).toContain('they have asked you to read it with what they have chosen to keep');
    expect(prompt).not.toContain('The chart below is the astrologer\'s own');
  });
  it('a kept conversation is never described as forgotten', () => {
    expect(proAskSystemPrompt('natal', 'x', { keeping: true })).not.toContain('Nothing is remembered between visits');
    expect(proAskSystemPrompt('natal', 'x', { keeping: true, continuing: true })).not.toContain('Nothing is kept after the visit');
    expect(proAskSystemPrompt('natal', 'x', {})).toContain('Nothing is remembered between visits');
  });
});

describe('the personal reading carries where the astrologer is in their wider work with MAIA', () => {
  it('states element, phase and motion as MAIA\'s own reading, not the chart', () => {
    const line = spiralFieldLine({ dominant_element: 'water', phase: 7, motion: 'ascending' });
    expect(line).toContain('water');
    expect(line).toContain('phase 7 of 12');
    expect(line).toContain('ascending');
    expect(line).toContain('never present it as what the chart shows');
  });

  it('says nothing when there is no state', () => {
    expect(spiralFieldLine({})).toBe('');
    expect(spiralFieldLine({ phase: 0 })).toBe('');
  });

  it('puts the field in its own section only when given', () => {
    const withField = proAskSystemPrompt('natal', 'Sun Gemini 24.39°', { ownChart: true, personal: { kept: 'k', field: 'FIELD-LINE' } });
    expect(withField).toContain('WHERE THEY ARE IN THEIR WIDER WORK WITH YOU');
    expect(withField).toContain('FIELD-LINE');
    const without = proAskSystemPrompt('natal', 'Sun Gemini 24.39°', { ownChart: true, personal: { kept: 'k' } });
    expect(without).not.toContain('WHERE THEY ARE IN THEIR WIDER WORK WITH YOU');
  });
});

describe('the field line names when it was last known', () => {
  it('says as of when, not "lately"', () => {
    const line = spiralFieldLine({ dominant_element: 'fire', phase: 3, updated_at: '2026-06-02T00:00:00Z' });
    expect(line).toContain('as of June 2026');
    expect(line).not.toContain('lately');
  });
  it('with nothing kept but a field, does not tell MAIA to read the chart on its own', () => {
    const p = proAskSystemPrompt('natal', 'Sun Gemini 24.39°', { ownChart: true, personal: { kept: '', field: 'F' } });
    expect(p).not.toContain('read the chart on its own');
    expect(p).toContain('wider work with you');
  });
});
