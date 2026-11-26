/**
 * Soullab Strategic Marketing Roadmap, December 2026 – November 2027.
 *
 * STANDING: PROPOSAL FOR REVIEW — not ratified. Launch order, dates, bundles and
 * ownership assignments are recommendations. Nothing here authorizes a campaign,
 * an entitlement, a price, a deployment or a public claim
 * (docs/canon/MARKETING_CLAIM_DISCIPLINE.md governs internal planning too).
 *
 * Served ONLY through the admin-guarded route `app/api/admin/marketing-roadmap`.
 * Do not import this module from a client component: internal strategy must not
 * ship in a public JavaScript bundle.
 *
 * Provenance: December tasks and all other sections are transcribed from the
 * founder-supplied roadmap text. January and February tasks are DRAFTS derived
 * from the launch waves (§5) and launch cycle (§6), marked `draft: true`, for the
 * Marketing Director to confirm.
 */

export type PlanMonth = {
  id: 'dec' | 'jan' | 'feb';
  label: string;
  title: string;
  draft: boolean;
  note?: string;
  weeks: { title: string; tasks: string[] }[];
};

export const ROADMAP_STANDING = {
  status: 'proposal' as const,
  ratified: false,
  notice:
    'Proposal for review, not ratified. Launch order, dates, bundles and ownership are recommendations. ' +
    'Release holds, permissions and product readiness have not been verified. No campaigns, development ' +
    'work or deployments have been initiated. Checkmarks and statuses on this page are planning notes ' +
    'kept in your own browser; they do not authorize or activate anything.',
};

export const ROADMAP = {
  title: 'Strategic Marketing Roadmap',
  owner: 'Heather Hampton · Marketing Director',
  period: 'December 2026 – November 2027',
  tagline: 'For the life you live. For the world we make.',
  strategy:
    'Doorway-led growth. Each Studio becomes an independently marketable offering, while every Studio ' +
    'contributes to the larger Soullab brand and environment. We need a repeatable process through which ' +
    'each Studio can enter the marketplace when ready, not a simultaneous launch of everything.',

  phases: [
    { id: 'I', name: 'Foundation', period: 'Dec–Feb', objective: 'Establish brand, Doorways and marketing operations' },
    { id: 'II', name: 'Activation', period: 'Mar–May', objective: 'Launch selected Studios and establish acquisition' },
    { id: 'III', name: 'Expansion', period: 'Jun–Aug', objective: 'Grow participation, partnerships and revenue' },
    { id: 'IV', name: 'Ecosystem', period: 'Sep–Nov', objective: 'Connect the offerings into a mature commercial environment' },
  ],

  workstreams: [
    { n: '01', name: 'Brand & Culture', scope: 'Master identity, positioning, visual language and public presence.', owners: 'Heather + Founder' },
    { n: '02', name: 'Studio Doorways', scope: 'Audience strategies, landing experiences and à la carte offerings for each Studio.', owners: 'Heather + Product' },
    { n: '03', name: 'Content & Creative', scope: 'Original teachings, storytelling, films, newsletters and campaigns.', owners: 'Heather + Creative + MAIA' },
    { n: '04', name: 'Commercial Development', scope: 'Pricing, membership, bundles, partnerships and revenue.', owners: 'Heather + Founder' },
    { n: '05', name: 'Marketing Intelligence', scope: 'AI discoverability, analytics, audience understanding and campaign tools.', owners: 'Heather + JARVIS + Engineering' },
    { n: '06', name: 'Community & Relationships', scope: 'Practitioners, ambassadors, events, academies and member participation.', owners: 'Heather + Community Leads' },
  ],

  plan: [
    {
      id: 'dec', label: 'December', title: 'Establish the foundation', draft: false,
      weeks: [
        { title: 'Strategic alignment', tasks: ['Founder and Heather strategy session', 'Confirm master brand positioning', 'Inventory existing offerings and assets', 'Establish responsibilities and approval boundaries'] },
        { title: 'Audience and Doorway mapping', tasks: ['Identify audiences for each Studio', 'Audit existing public Doorways', 'Map à la carte offerings', 'Establish Studio readiness matrix'] },
        { title: 'Creative identity', tasks: ['Develop shared visual language', 'Establish Studio campaign identities', 'Build approved messaging library', 'Inventory original founder content'] },
        { title: 'Marketing operations', tasks: ['Establish publishing calendar', 'Set up privacy-preserving measurement', 'Create campaign templates', 'Prepare January creative assets'] },
      ],
    },
    {
      id: 'jan', label: 'January', title: "Prepare Wave 1: Writer's Studio and MAIA", draft: true,
      note: 'Draft for Heather to confirm, derived from the launch waves and launch cycle. The source plan listed only December.',
      weeks: [
        { title: 'Readiness and positioning', tasks: ["Confirm Writer's Studio and MAIA readiness gate status", 'Finalize Wave 1 positioning and audiences', 'Confirm Wave 1 commercial offering with founder', 'Hold first weekly Product & Marketing Council'] },
        { title: 'Doorway build', tasks: ["Draft Writer's Studio Doorway", 'Draft MAIA Doorway', 'Prepare demonstrations of verified capabilities only', 'Produce Wave 1 campaign assets'] },
        { title: 'Introduce', tasks: ['Publish educational content and previews', 'Brief writing-teacher and author partners', 'Launch newsletter series', 'Check every claim against the Readiness Register'] },
        { title: 'Invite', tasks: ['Open approved early access list', 'Send launch communication for approval', 'Confirm measurement is live before launch', 'Monthly strategy review'] },
      ],
    },
    {
      id: 'feb', label: 'February', title: 'Open Wave 1 and prepare Wave 2', draft: true,
      note: 'Draft for Heather to confirm. Launch proceeds only if the Wave 1 readiness gate is satisfied.',
      weeks: [
        { title: 'Open the Doorway', tasks: ['Launch Wave 1 if the gate is satisfied', 'Run organic campaigns', 'Monitor introductory experience and purchase', 'Log support questions and member feedback'] },
        { title: 'Understand', tasks: ['T+2 activation and conversion review', 'Collect member experience in their own words', 'Report findings to the Council', 'Adjust Wave 1 messaging'] },
        { title: 'Wave 2 preparation', tasks: ['Research Astrology and Divination audiences', 'Confirm Wave 2 readiness with Product', 'Draft Wave 2 positioning', 'Identify astrologer partners'] },
        { title: 'Develop and review', tasks: ['T+4 retention review for Wave 1', 'Decide whether paid growth is worth testing', 'Record first performance baseline', 'Phase I retrospective and Phase II plan'] },
      ],
    },
  ] as PlanMonth[],

  decemberDeliverables: [
    ['Soullab Brand Guide', 'Consistency across all communications', 'Heather'],
    ['Studio Portfolio', 'Inventory of all marketable offerings', 'Heather + Product'],
    ['Doorway Blueprint', 'Repeatable public landing experience', 'Heather + Design'],
    ['Commercial Matrix', 'À la carte, membership and Pro options', 'Founder + Heather'],
    ['Content Library', 'Approved knowledge and creative assets', 'Heather + Founder'],
    ['Audience Profiles', 'Clear initial communities', 'Heather'],
    ['Readiness Register', 'Prevent premature campaigns', 'Product + Engineering'],
    ['Marketing Calendar', 'Coordinate publishing and launches', 'Heather'],
    ['Measurement Framework', 'Establish evidence-based growth', 'Heather + Engineering'],
  ],

  waves: [
    { n: 1, when: 'Jan – Feb', studios: ["Writer's Studio", 'MAIA'], aim: 'Establish the creative and relational proposition.' },
    { n: 2, when: 'Mar – Apr', studios: ['Astrology Studio', 'Divination Studio'], aim: 'Reach established communities of symbolic and developmental exploration.' },
    { n: 3, when: 'Apr – May', studios: ['Sound Studio', 'Practices'], aim: 'Introduce experiential, embodied and creative offerings.' },
    { n: 4, when: 'Jun – Aug', studios: ['Relationship Studio', 'Community', 'Academies'], aim: 'Expand into relational, educational and collective participation.' },
  ],
  wavesNote:
    "An initial sequencing recommendation. It must be adjusted to actual product maturity and Heather's audience research. " +
    'Wave 1 falls inside Phase I (Foundation) while activation is planned from March; this overlap is unresolved.',

  launchCycle: [
    ['T−4 wk', 'Prepare', 'Positioning, audiences, commercial offering and readiness'],
    ['T−3 wk', 'Build', 'Doorway, demonstrations, content and campaign assets'],
    ['T−2 wk', 'Introduce', 'Educational content, previews and partner introductions'],
    ['T−1 wk', 'Invite', 'Approved early access, newsletter and launch communication'],
    ['Launch', 'Open the Doorway', 'Organic campaigns, introductory experience and purchase'],
    ['T+2 wk', 'Understand', 'Activation, feedback, support and conversion review'],
    ['T+4 wk', 'Develop', 'Refine campaign, establish retention and evaluate paid growth'],
  ],
  launchGate:
    'The launch clock only proceeds when the relevant readiness gate is satisfied. Marketing preparation can happen earlier, ' +
    'but public promotion of unavailable functionality cannot.',

  commerceRequirements: ['Shared identity', 'Consistent commerce', 'Studio-specific entitlements', 'Transparent pricing', 'Preserved member work', 'Permission-controlled continuity'],

  bundles: [
    { name: 'The Creative Life', kind: 'Proposed bundle', parts: 'Writing + Sound + MAIA' },
    { name: 'The Symbolic Life', kind: 'Proposed bundle', parts: 'Astrology + Divination + MAIA' },
    { name: 'The Relational Life', kind: 'Proposed bundle', parts: 'Relationships + Practices + MAIA' },
    { name: 'The Soullab Life', kind: 'Proposed membership', parts: 'Multiple Studios + Community' },
  ],
  bundlesNote: 'Conceptual packages to explore, not decisions to implement new entitlements.',

  partnerships: [
    ['Authors and writing teachers', "Workshops, creative salons and Writer's Academy"],
    ['Astrologers', 'Professional demonstrations and education'],
    ['Therapists and coaches', 'Reflective and professional tools within appropriate boundaries'],
    ['Musicians and sound artists', 'Sound experiences and creative collaborations'],
    ['Embodiment practitioners', 'Elemental practices and educational events'],
    ['Retreat centers', 'Hybrid physical and digital experiences'],
    ['Researchers', 'Papers, case studies and public conversations'],
  ],

  ecosystem: [
    ['Broader Soullab membership', 'Participation across multiple Studios'],
    ['Academies', 'Education and deeper engagement'],
    ['Practitioner network', 'Distributed expertise and community growth'],
    ['Marketing intelligence', 'Increasingly integrated creative and analytical capabilities'],
    ['Public knowledge catalog', 'Accurate discovery through external AI agents'],
    ['Soullab cultural programming', 'Salons, interviews, publications and experiences'],
    ['AIN OS positioning', 'A coordinated but distinct professional and developer narrative'],
  ],

  alignment:
    'A Shared Product & Marketing Council (Founder · Heather · Product · Engineering) meets weekly for 30 minutes, with a monthly ' +
    'strategy review. Heather brings market evidence into product development; JARVIS and Engineering bring verified product ' +
    'capabilities into marketing; the founder holds the larger vision and commercial direction.',

  dependencies: [
    ['Canonical Studio inventory', 'P0', 'Accurate marketing portfolio'],
    ['Individual public Doorways', 'P0', 'Independent acquisition'],
    ['Shared identity and onboarding', 'P0', 'Frictionless entry'],
    ['Studio-specific entitlements', 'P0', 'À la carte commerce'],
    ['Approved pricing and billing', 'P0', 'Sustainable revenue'],
    ['Privacy-preserving analytics', 'P0', 'Campaign measurement'],
    ['Public knowledge catalog', 'P1', 'Search and AI discoverability'],
    ['Creative asset library', 'P1', 'Consistent brand production'],
    ['Campaign attribution', 'P1', 'Understand acquisition performance'],
    ['Consent-controlled continuity', 'P1', 'Interconnected member experience'],
    ['Marketing intelligence workspace', 'P2', 'Integrated marketing operations'],
    ['Agent interoperability', 'P2', 'External AI-mediated discovery'],
  ],
  dependenciesNote: 'Requirements to evaluate against the existing architecture first, not instructions to create another application.',

  studios: ['MAIA', "Writer's Studio", 'Astrology', 'Divination', 'Sound', 'Relationships', 'Practices', 'Community', 'Academies'],

  evaluation: [
    ['Brand', 'Soullab has a recognizable identity and clear positioning'],
    ['Doorways', 'Each released Studio has an effective independent entrance'],
    ['Commerce', 'Members can participate à la carte without unnecessary friction'],
    ['Audience', 'We understand who values each Studio and why'],
    ['Revenue', 'We establish sustainable acquisition and recurring participation'],
    ['Content', 'Original Soullab knowledge drives a consistent publishing ecosystem'],
    ['Discovery', 'Search engines and AI agents accurately represent our offerings'],
    ['Community', 'Practitioners and members contribute meaningfully'],
    ['Intelligence', 'Heather has useful, integrated marketing capabilities'],
    ['Trust', 'Member sovereignty and privacy remain intact'],
  ],
  evaluationNote:
    'No arbitrary revenue, follower or conversion targets until a first reliable performance baseline exists. ' +
    'After that, Heather develops evidence-based quarterly targets for each Studio.',

  northStar: {
    headline: 'Many Doorways. One House.',
    subline: 'A living environment for human creativity, connection and development.',
    lines: [
      "Heather's mandate is to make Soullab visible, accessible, understood and commercially sustainable without diminishing the depth of what we are creating.",
      'The individual Studios provide the immediate reasons to enter. The larger Soullab environment provides the reasons to belong. MAIA provides the possibility of continuity. AIN OS provides the foundation for intelligence in relationship.',
    ],
    bridge: 'Marketing becomes the bridge between the life people are already living and the possibilities Soullab opens for them.',
  },
};

export type StrategicRoadmap = typeof ROADMAP;
