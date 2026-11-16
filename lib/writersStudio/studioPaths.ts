/**
 * Writer's Studio — Studio paths (JARVIS-WRITERS-STUDIO-INSPIRATION-OPENING-01).
 *
 * Founder, 2026-11-13: a member who arrives for a known purpose opens on that path, not on the generic
 * "what's calling you to write?". "We will have many of these sub functions within writers studio to help our members",
 * so this is a registry, and the college essay is its first entry (controlled beta, ledger #1938).
 *
 * Law, carried from the Spark door:
 *   - A path is chosen ONLY by the member's own link (`?path=<id>`, exact id). It is never inferred from who they are,
 *     their invitation's audience, their Works or their answers.
 *   - The path's first prompt replaces the Spark question only where the door would show anyway (no Works, no writing).
 *   - A path may RECOMMEND Work settings. They are offered pre-ticked and applied only through the member's own Begin act,
 *     through the existing member-act PATCH. Untick and nothing is sent.
 *   - MAIA's frame for a path comes from this registry by id, server-side. The client never supplies prompt text.
 *   - The opening conversation is still never kept (founder Q1). Only a spark the member chooses to hold reaches the Work.
 */

/**
 * Founder framing, 2026-11-13: each path is a UNIQUE OFFERING, a specialised environment built with AIN OS and MAIA
 * for a difficult or very niche arena. Not a template with a different first question: its own arena, its own MAIA
 * posture, its own door, its own recommended Work settings, its own arc.
 *
 * Claim discipline (docs/canon/MARKETING_CLAIM_DISCIPLINE.md): a path shows the member only what exists today. `arc`
 * records the environment's intended journey; a stage is shown only once it is `built`.
 */
/**
 * One stage of a program's arc (founder 2026-11-16: "all phases of writing process for College essay ready to test").
 * The words come from the program's own curriculum. `built` is claim discipline: a stage is shown only once it exists.
 */
export interface StudioStage {
  /** Stable id stored on the Work (living_works.studio_stage). Lowercase, hyphenated. */
  id: string;
  /** What the writer sees the stage called. */
  stage: string;
  built: boolean;
  /** The stage's one-line heading, e.g. "Look beneath the moment." */
  lead?: string;
  /** What this stage is for, in one or two plain sentences. */
  guidance?: string;
  /** The stage's question for the writer, and its label. */
  prompt?: string;
  question?: string;
  /** Anything else the writer should know here (e.g. Draft's word range is information, not a limit). */
  info?: string;
  /** The label of the writer's private notes for this stage. */
  notesLabel?: string;
  /** How MAIA coaches in this stage (server-side; appended after the program posture). Never client-supplied. */
  posture?: string;
  /** The writer's own checklist for this stage (e.g. Ready). Ticks are theirs; nothing is certified. */
  checklist?: readonly { id: string; label: string }[];
  /** Tools this stage offers beside the page: keep a version of my words; compare my own versions (Revision Mirror). */
  tools?: readonly ('keep' | 'mirror')[];
}

export interface StudioPath {
  /** Exact id used in `?path=`. Lowercase, hyphenated. */
  id: string;
  /** What the member sees the path called. */
  name: string;
  /** The program's own offer on Studio Home, for a member who already has Works (e.g. "Start a college essay"). */
  startLabel: string;
  /**
   * Founder ruling 2026-11-16 (#1900): a program that students may use. Before MAIA speaks at its door, the member says
   * they are 18+, or 13–17 with adult supervision; under-13 is turned away. Enforced server-side at the door and at Begin.
   */
  requiresAgeAttestation?: boolean;
  /** The arena this environment serves, in one plain sentence (shown at its door). */
  arena: string;
  /** The environment's journey. Only `built` stages may ever be shown to a member. */
  arc: readonly StudioStage[];
  /** Replaces "Before anything else: what's calling you to write?" for this path. */
  firstPrompt: string;
  /** One quiet line under the prompt. */
  invitation: string;
  /** Prefilled, editable title for the path's first Work. */
  suggestedTitle: string;
  /** Settings the path recommends. Offered pre-ticked; applied only on the member's confirmation. */
  recommended: { maiaRevisionsPaused?: boolean };
  /** Plain words for each recommended setting, shown beside its tick box. */
  recommendedCopy: { maiaRevisionsPaused?: { label: string; hint: string } };
  /** How MAIA reflects at this path's door. Appended to the shared path frame. */
  reflectionGuide: string;
  /** The program's own words in the Studio, once a Work belongs to this path (living_works.studio_path, 2026-11-15). */
  studioCopy: {
    /** MAIA's orientation line when nothing is picked. */
    orient: string;
    /** The button that opens the conversation about the whole Work. */
    whole: string;
    /** MAIA's line before the writer has started with her on this Work. */
    notYet: string;
    /** The Write rail's heading in place of "Manuscript". */
    railHeading: string;
    /** An unheaded place when the Work has ONE (in place of "Section 1"). */
    onlyPlace: string;
    /** An unheaded place among several: `${part} ${n}` in place of "Section n". */
    part: string;
    /** The Write column's footer line in place of "The manuscript stays primary; …". */
    foot: string;
    /** The conversation's whole-Work scope, in place of "the whole book" ("About: where I am · the whole essay"). */
    wholeScope: string;
  };
  /** How MAIA coaches in this program's Work, on every editorial turn (server-side, by id; never client-supplied text). */
  studioPosture: string;
}

export const STUDIO_PATHS: readonly StudioPath[] = [
  {
    id: 'college-essay',
    name: 'College essay',
    startLabel: 'Start a college essay',
    requiresAgeAttestation: true,
    arena: 'For the personal essay you’ll send with your college applications: written in your own voice, from your own life.',
    // The College Essay coaching arc, from the program's own curriculum (offline Studio v2.1, weeks 1–6), brought into the Studio
    // (founder 2026-11-16). Notes are private by default: MAIA reads one only when the writer sends it herself.
    arc: [
      { id: 'discover', stage: 'Discover', built: true,
        lead: 'The story only you can tell.',
        guidance: 'Begin with something genuinely yours. Your most meaningful experience need not be dramatic, public, or painful.',
        prompt: 'A moment that stays with me',
        question: 'What ordinary moment do you remember clearly—and what can you still notice about it?',
        info: 'You are never required to disclose private experiences. A small moment of fascination, kindness, work, play or curiosity can be enough.',
        notesLabel: 'My own notes',
        posture: 'STAGE: DISCOVER. Help the writer find and stay with one specific moment: what they saw, heard, did. Do not hunt for significance yet.' },
      { id: 'meaning', stage: 'Meaning', built: true,
        lead: 'Look beneath the moment.',
        guidance: 'An essay can show how you attend to the world. It does not need a predetermined moral.',
        prompt: 'What draws my attention?',
        question: 'What feels important about this experience now? What questions are still open?',
        notesLabel: 'My own reflections',
        posture: 'STAGE: MEANING. Ask what draws their attention and what still feels open. Never supply a meaning, a moral or a lesson; never say what the moment "shows about" them. Their reflections are theirs to find.' },
      { id: 'voice', stage: 'Voice', built: true,
        lead: 'Listen for your own voice.',
        guidance: 'Notice where your writing feels natural, particular, and alive. No one needs to sound like a professional copywriter.',
        prompt: 'Write a scene in your language',
        question: 'Where were you? What did you notice? What actually happened?',
        notesLabel: 'Scene exercise',
        posture: 'STAGE: VOICE. Point to the places in their own words that sound most like them (quote only their words) and ask for the scene: where they were, what they noticed, what happened. Never model a voice.' },
      { id: 'draft', stage: 'Draft', built: true,
        lead: 'Write. Explore. Keep ownership.',
        guidance: 'Only you can add, delete, or change your essay. All coaching appears outside the editor.',
        info: 'The standard Common App essay range is 250–650 words; verify requirements for your actual application. The count is informational and does not limit your writing.',
        notesLabel: 'My notes while drafting',
        tools: ['keep'],
        posture: 'STAGE: DRAFT. They are writing the whole essay now. Encourage getting it down; ask about what is missing or unclear; never draft for them.' },
      { id: 'revise', stage: 'Revise', built: true,
        lead: 'Improve the writing without giving it away.',
        guidance: 'A reviewer can notice patterns, ask questions, or teach techniques. Rewriting remains your decision and your work.',
        prompt: 'My revision intention',
        question: 'One change I want to consider',
        notesLabel: 'My revision intention',
        tools: ['keep', 'mirror'],
        posture: 'STAGE: REVISE. Notice patterns in their draft, ask questions, and when asked, explain a technique in general terms. Never write the revision; the change is theirs.' },
      { id: 'ready', stage: 'Ready', built: true,
        lead: 'Readiness belongs to the writer.',
        guidance: 'These reminders help you review your work. They are not a certification or a promise of admission.',
        notesLabel: 'My own readiness notes',
        info: 'This checklist cannot attest to authorship or submit to a college. It is yours.',
        checklist: [
          { id: 'wrote-myself', label: 'I wrote the substantive essay myself, using only support allowed by the colleges to which I am applying.' },
          { id: 'checked-prompt', label: 'I personally checked the current prompt and word limit.' },
          { id: 'read-aloud', label: 'I read it aloud and recognized my own voice.' },
          { id: 'comfortable-sharing', label: 'I have chosen what I feel comfortable sharing.' },
          { id: 'final-decisions', label: 'I made the final revision decisions myself.' },
        ],
        posture: 'STAGE: READY. The writer decides when the essay is ready. Never certify it, grade it, or predict admission; help them check it is their own voice and their own choices.' },
    ],
    // The College Essay coaching arc's Discover prompt (Discover → Meaning → Voice → Draft → Revise → Ready), verbatim.
    firstPrompt: 'A moment that stays with me: what ordinary moment do you remember clearly, and what can you still notice about it?',
    invitation: 'It doesn’t need to be important or impressive. Small and specific is perfect. You don’t need to know yet what the essay will be.',
    suggestedTitle: 'College essay',
    recommended: { maiaRevisionsPaused: true },
    recommendedCopy: {
      maiaRevisionsPaused: {
        label: 'MAIA asks, never rewrites',
        hint: 'She asks questions and points to places in your draft. Every word stays yours. You can change this later.',
      },
    },
    reflectionGuide: 'They are a student beginning a college application essay. Reflect the details they still notice: what they saw, heard, did. Stay with the moment itself. Do not tell them what the moment means, what it says about them, or how it would impress an admissions reader.',
    studioCopy: {
      orient: 'Pick a paragraph of your essay at left, or select exact words, and I’ll look at it with you.',
      whole: 'Talk about the whole essay',
      notYet: 'I haven’t read your essay with you yet.',
      railHeading: 'Your essay',
      onlyPlace: 'Your draft',
      part: 'Part',
      foot: 'Your essay comes first. I follow where you put your attention.',
      wholeScope: 'the whole essay',
    },
    studioPosture: [
      'PROGRAM: COLLEGE ESSAY. This Work is a student\'s personal essay for their college applications.',
      'Call it their essay or their draft; never a book, chapter or manuscript.',
      'Stay with concrete details: what they saw, heard, did, felt. Help them find the specific moment and their own voice.',
      'Do not tell them what the moment means, what it says about them, or how it would impress an admissions reader. Do not optimise for admission.',
      'Keep it warm, plain and brief: one or two observations and one question.',
    ].join('\n'),
  },
];

/** The arc stages a member may see: built ones only (claim discipline). */
export function visibleArc(path: StudioPath): string[] {
  return path.arc.filter((s) => s.built).map((s) => s.stage);
}

/** The built stages of a program, in order. */
export function builtStages(path: StudioPath): readonly StudioStage[] {
  return path.arc.filter((s) => s.built);
}

/** A Work's stage: its declared stage if it is a built stage of its program, else the program's first built stage. */
export function currentStage(path: StudioPath, declared: string | null | undefined): StudioStage {
  const stages = builtStages(path);
  return stages.find((s) => s.id === declared) ?? stages[0]!;
}

/** The stage after this one, or null at the last. */
export function nextStage(path: StudioPath, stageId: string): StudioStage | null {
  const stages = builtStages(path);
  const i = stages.findIndex((s) => s.id === stageId);
  return i >= 0 && i + 1 < stages.length ? stages[i + 1]! : null;
}

/** A built stage of this program by id (the server accepts nothing else), or null. */
export function stageById(path: StudioPath, stageId: unknown): StudioStage | null {
  return typeof stageId === 'string' ? builtStages(path).find((s) => s.id === stageId) ?? null : null;
}

/** The member's own link chose this path. Exact match only; anything else opens no path (F17). */
export function pathFromParam(param: string | null | undefined): StudioPath | null {
  if (typeof param !== 'string') return null;
  return STUDIO_PATHS.find((p) => p.id === param) ?? null;
}

/**
 * MAIA's frame for a path's door, built from the registry by id (F20). It keeps the Spark door's law: reflect, don't
 * define, don't write, plain text, and check understanding before anything is held.
 */
/** A registered path by its stored id (living_works.studio_path), or null. */
export function studioPathById(id: string | null | undefined): StudioPath | null {
  if (typeof id !== 'string') return null;
  return STUDIO_PATHS.find((p) => p.id === id) ?? null;
}

export function pathFrameFor(id: string): string | null {
  const path = pathFromParam(id);
  if (!path) return null;
  return `You are MAIA, in a writer's Studio, meeting a writer on their first visit. They came here for one thing: ${path.name.toLowerCase()}. They have no Work here yet and you have read nothing of theirs. You asked them: "${path.firstPrompt}"

WHAT YOU ARE DOING
Reflect back what you heard, in a few warm, plain sentences, staying close to their own words and details. On your first reply, end by asking whether you heard them right (for example: "Am I hearing that right?"). When they correct you or say it again differently, reflect again and end by asking whether you have it now. Otherwise ask at most one question, or none.

${path.reflectionGuide}

WHAT YOU MUST NOT DO
Do not write any part of their piece, an opening line, or a sample sentence. Do not define the Work or what it is "really" about. Do not grade or assess what they said. Do not interpret them as a person. Do not propose an outline or a structure. Say nothing about what will be saved; the screen asks them that separately.

Plain text only: no asterisks, underscores, headings, bullets or lists. Be brief: two to four sentences.`;
}

/**
 * Program declaration CONTRACT (ledger #1938):
 * A Work's program is explicitly declared through an authenticated, authorized action by the member who owns that Work.
 * The declaration must identify a registered program. Once established, the program is immutable. No title, invitation,
 * system process, or inferred context may silently assign or change it. (Founder contract ACCEPT_F2_MEMBER_DECLARATION_ONCE_FIXED,
 * 2026-11-15; supersedes earlier "Begin-only" wording, including this migration's header. The contract is member authorization,
 * not button provenance: existing session authorization and request-integrity protections apply, and the client submits an
 * explicit program selection, never an inferred one.)
 *
 * What the member's Begin sends through the existing member-act PATCH (F19). The title is theirs exactly (empty = left
 * unnamed). The recommended setting is included ONLY when they kept it ticked. A spark is included only when they held one.
 */
export function pathBeginPatch(input: {
  path: StudioPath;
  title: string;
  revisionsPausedConfirmed: boolean;
  purpose: string | null;
}): { title?: string; maiaRevisionsPaused?: true; purpose?: string; studioPath: string } {
  // The Work belongs to this program from the member's own Begin (2026-11-15), so the Studio can speak in its words.
  const patch: { title?: string; maiaRevisionsPaused?: true; purpose?: string; studioPath: string } = { studioPath: input.path.id };
  if (input.title.trim().length > 0) patch.title = input.title;
  if (input.path.recommended.maiaRevisionsPaused === true && input.revisionsPausedConfirmed) patch.maiaRevisionsPaused = true;
  if (input.purpose !== null) patch.purpose = input.purpose;
  return patch;
}

/** The name of an unheaded place in a Work: the program's own words when it has them, else the ordinary "Section n". */
export function unheadedPlaceName(
  copy: Pick<StudioPath['studioCopy'], 'onlyPlace' | 'part'> | null | undefined,
  position: number,
  total: number,
): string {
  if (!copy) return `Section ${position + 1}`;
  return total === 1 ? copy.onlyPlace : `${copy.part} ${position + 1}`;
}
