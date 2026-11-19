/**
 * Studio guides: step-by-step ways through Writer's Studio, one per starting point.
 *
 * Founder direction 2026-11-19 (docs/programme/STUDIO_ACADEMY_EXPLORATION_2026-11-19.md §3 C–D): the guides live in the
 * Studio and on the writer's phone, every step is a place to talk with MAIA about it, and "What do I do next?" carries a QR
 * code that opens the phone guide at the step matching the screen at that moment.
 *
 * ⛔ Only live controls. Every label in quotes must be text the live Studio shows; the test pins each to the live UI source.
 * ⛔ Public and data-free. The guide page needs no sign-in and holds no member data. A step link carries only the guide and
 *    step (`/explore/writers-studio/guide#new-7`): no member id, Work, manuscript text or tracking token, and opening it
 *    records nothing.
 * ⛔ `talk` is a question the writer may ask MAIA. In the Studio it is PLACED in the conversation composer and the writer
 *    presses Send; on the public page it is shown for the writer to ask in the Studio. Nothing sends it by itself.
 */
import type { DevelopScreen, WriteScreen } from './whatNext';

export type GuideId = 'new' | 'existing';

export type GuideStep = {
  readonly title: string;
  /** What to do, in order. Quoted labels are exact on-screen text. */
  readonly steps: readonly string[];
  readonly tip: { readonly label: string; readonly text: string };
  /** A question about this step the writer may ask MAIA. Never sent by itself. */
  readonly talk: string;
};

export type StudioGuide = {
  readonly id: GuideId;
  readonly title: string;
  readonly intro: string;
  readonly steps: readonly GuideStep[];
};

export const GUIDE_PATH = '/explore/writers-studio/guide';

export const STUDIO_GUIDES: readonly StudioGuide[] = [
  {
    id: 'new',
    title: 'Starting a new Work',
    intro: 'For when you are beginning something new, with no pages yet.',
    steps: [
      {
        title: 'MAIA asks what’s calling you to write',
        steps: ['Type a few words about what you want to write. A feeling or an image is enough.', 'Press “Tell MAIA”.'],
        tip: { label: 'Not sure?', text: '“I don’t know yet” is a perfectly good answer. To skip the conversation, press “Just let me write”.' },
        talk: 'I’m at the very start. How do I tell you what I want to write if I’m not sure yet?',
      },
      {
        title: 'Choose how MAIA holds this session',
        steps: ['Press “Ordinary” if you want MAIA to remember this work with you.', 'Press “Sanctuary” if you want nothing from this session saved.'],
        tip: { label: 'Why she asks', text: 'MAIA won’t guess. Nothing is kept until you choose.' },
        talk: 'What’s the difference between an Ordinary session and Sanctuary, and which should I choose?',
      },
      {
        title: 'Choose where to begin',
        steps: ['Press “Write the first page”.'],
        tip: { label: 'Other choices', text: '“Keep talking” stays in conversation with MAIA a little longer. “Bring what I’ve written” is for pages you already have.' },
        talk: 'Should I start by writing, or by talking with you first?',
      },
      {
        title: 'Tell MAIA how to work with you',
        steps: ['Choose the one that sounds like you: “Guide me”, “Teach me as we go” or “Give me full control”.'],
        tip: { label: 'No wrong answer', text: 'If you’re not sure, “Not now” is fine.' },
        talk: 'What changes if I choose “Guide me” instead of “Teach me as we go”?',
      },
      {
        title: 'Write on your blank page',
        steps: ['Press “Just start writing”, then type on the page in the middle.', 'Stuck? Press “Help me find a beginning”. MAIA asks one question to help you start in your own words.'],
        tip: { label: 'Your page is private', text: 'MAIA doesn’t read your page until you show it to her.' },
        talk: 'I have a blank page. Can you help me find a way to begin, in my own words?',
      },
      {
        title: 'Show MAIA your first page',
        steps: ['When you’re ready, press “Show MAIA this page”.', 'Then press “Yes, read it”, or “Not yet” to wait.'],
        tip: { label: 'Nothing happens by itself', text: 'She reads only after you say yes.' },
        talk: 'What will you do with my first page if I show it to you?',
      },
      {
        title: 'Work on one passage with MAIA',
        steps: [
          'Once your Work has more than one section, you’ll see “Prose” and “Edit” at the top of the page. Press “Edit”.',
          'With your mouse, select the words you want to work on.',
          'Press “Talk with MAIA”, which appears beside them.',
          'Type what you want, or choose “What’s happening here?”, “Show me an edit” or “Teach me the craft”.',
        ],
        tip: { label: 'The key step', text: 'Selecting words works in Edit. In Prose, the page is for reading.' },
        talk: 'How do I work on one passage with you?',
      },
      {
        title: 'Start working together',
        steps: ['The first time, MAIA asks before she begins working on this Work with you.', 'Press “Start with MAIA” to work together.'],
        tip: { label: 'Your choice', text: '“Keep this private” or “Just keep writing” sends nothing to MAIA.' },
        talk: 'What does starting with you on this Work mean, and what will you remember?',
      },
      {
        title: 'Talk, then go back to your page',
        steps: ['Your conversation with MAIA opens in the middle of the screen.', 'When you’re done, press “Back to the page”. You return to the same place on your page.'],
        tip: { label: 'Your page is still there', text: 'Talking with MAIA doesn’t change your page.' },
        talk: 'How do I get back to my page after we talk?',
      },
      {
        title: 'When you have a few chapters, go to Develop',
        steps: ['Choose “Develop” in the top bar.', 'Press “Read this chapter with MAIA”.', 'Afterwards MAIA asks “What would you like to do?”. Choose one, or “Leave it for now”.'],
        tip: { label: 'What Develop is for', text: 'Looking at how a chapter, and later your whole Work, is working, with MAIA as your reader.' },
        talk: 'Am I ready for Develop, and what will I get from it?',
      },
    ],
  },
  {
    id: 'existing',
    title: 'Bringing in a Work you’ve already written',
    intro: 'For when you have a draft, a chapter or a whole manuscript.',
    steps: [
      {
        title: 'Tell the Studio you already have pages',
        steps: ['Press “I already have pages”, under the first question.', 'Already in the Studio? On Home, press “Import writing”.'],
        tip: { label: 'Your original is safe', text: 'Your original is always preserved.' },
        talk: 'I already have pages. What’s the best way to bring them in?',
      },
      {
        title: 'Bring your manuscript',
        steps: ['Give your Work a title.', 'Add your manuscript: a Word document, PDF, EPUB, Markdown or plain-text file.'],
        tip: { label: 'MAIA doesn’t touch it', text: 'Nothing is interpreted or rewritten by MAIA during import. Your original file is encrypted and kept separate from the copy you edit.' },
        talk: 'What happens to my original file when I bring it in?',
      },
      {
        title: 'Choose Ordinary or Sanctuary',
        steps: ['Press “Ordinary — keep my manuscript” to keep your Work in the Studio.'],
        tip: { label: 'Sanctuary', text: '“Sanctuary — keep nothing” lets you look without saving anything.' },
        talk: 'Should I keep my manuscript here, or look at it in Sanctuary first?',
      },
      {
        title: 'Check the chapters, then open your Work',
        steps: [
          'Press “Review structure”. The Studio proposes where your chapters begin.',
          'Fix anything that’s wrong: edit a heading, use “Merge ↑” to join two pieces, or “Add cut” to split one.',
          'Press “Create Work and open in Write”.',
        ],
        tip: { label: 'You decide', text: 'No cut is accepted until you confirm it.' },
        talk: 'How do I fix chapters that were split in the wrong place?',
      },
      {
        title: 'Find your way around your Work',
        steps: ['Your chapters are listed on the left. Click one to open it.', 'MAIA’s column on the right shows the place you chose. Press “Talk about this place” to talk about it with her.'],
        tip: { label: 'Talking about the whole Work', text: 'With no place chosen, the column offers “Talk about the whole Work”.' },
        talk: 'How do I move around my manuscript and talk with you about one chapter?',
      },
      {
        title: 'Work on one passage with MAIA',
        steps: ['Press “Edit” at the top of the page.', 'Select the words you want to work on with your mouse.', 'Press “Talk with MAIA”, which appears beside them.'],
        tip: { label: 'The first time', text: 'MAIA asks before she starts working on this Work with you. Press “Start with MAIA”, or “Keep this private” to send nothing.' },
        talk: 'How do I work on one passage with you?',
      },
      {
        title: 'Have MAIA read a chapter in Develop',
        steps: ['Choose “Develop” in the top bar, then press “Read this chapter with MAIA”.', 'When she’s done, choose what to do next. “Go through what she noticed” is a good place to start.'],
        tip: { label: 'To talk about exact words', text: 'Select them in the chapter and press “Ask MAIA about this”. To change the words, press “Edit in Write”.' },
        talk: 'What will you look for when you read my chapter?',
      },
      {
        title: 'Have MAIA read the whole Work',
        steps: ['In Develop, press “Whole book · editorial pass” at the end of the row of ways to look at your Work.', 'Read the note about what it uses, then press “Read it”.'],
        tip: { label: 'Or from Write', text: 'MAIA’s column in Write also offers “Read my Work”.' },
        talk: 'What does reading my whole Work involve, and when is it worth doing?',
      },
      {
        title: 'Read MAIA’s letter, back in Write',
        steps: ['MAIA’s letter appears in her column in Write, beside your page.', 'Click a place in the letter to go to it on your page.', 'Press “From the whole Work down” to see the biggest questions first.'],
        tip: { label: 'If you close the page', text: 'She stops after the reading she’s on. Press “Continue” later to pick up where she left off. MAIA can read the whole Work twice a day.' },
        talk: 'How should I work through your letter, one place at a time?',
      },
    ],
  },
];

export function guideById(id: GuideId): StudioGuide {
  return STUDIO_GUIDES.find((g) => g.id === id)!;
}

export type GuideStepRef = { readonly guide: GuideId; /** 1-based */ readonly step: number };

/** The public link to one step. Carries only the guide and step. */
export function guideStepHref(ref: GuideStepRef, origin = ''): string {
  return `${origin}${GUIDE_PATH}#${ref.guide}-${ref.step}`;
}

/** Parses `#new-7`; anything else is null. */
export function parseGuideHash(hash: string): GuideStepRef | null {
  const m = /^#?(new|existing)-(\d{1,2})$/.exec(hash.trim());
  if (!m) return null;
  const guide = m[1] as GuideId;
  const step = Number(m[2]);
  return step >= 1 && step <= guideById(guide).steps.length ? { guide, step } : null;
}

/** The guide step that matches what Write shows now. */
export function guideStepForWrite(s: WriteScreen): GuideStepRef {
  if (s.pageEmpty) return { guide: 'new', step: 5 };
  if (s.firstPage) return { guide: 'new', step: 6 };
  if (s.chosenPlace) return { guide: 'existing', step: 5 };
  return { guide: 'new', step: 7 };
}

/** The guide step that matches what Develop shows now. */
export function guideStepForDevelop(s: DevelopScreen): GuideStepRef {
  if (s.posture === 'ordinary' && (s.pass === 'running' || s.pass === 'ready')) return { guide: 'existing', step: s.pass === 'ready' ? 9 : 8 };
  return { guide: 'existing', step: 7 };
}
