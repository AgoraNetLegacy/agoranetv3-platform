// AgoraNet canon: the Seven Pillars and the 49 Questions.
// Ported verbatim from v2 (declared reuse); SEVEN_PILLARS.md ratifies this
// content carried forward as-is: "proven, well-loved content … should not be
// redesigned for v3, only re-implemented against the new codebase."
// Question wording may evolve later; every change becomes a ledger event.

export const LENSES = [
  "OUSIA",
  "AITIA",
  "MODUS",
  "PERSONA",
  "VELA",
  "KYOKAI",
  "TAO",
] as const;

export type Lens = (typeof LENSES)[number];

export const LENS_INFO: Record<Lens, { label: string; asks: string }> = {
  OUSIA: { label: "Essence", asks: "What is it, at its core?" },
  AITIA: { label: "Causation", asks: "Why is it broken / what blocks it?" },
  MODUS: { label: "Method", asks: "How do we actually do it?" },
  PERSONA: { label: "Identity", asks: "Who must we become?" },
  VELA: { label: "Unveiling", asks: "What becomes possible?" },
  KYOKAI: { label: "Boundary", asks: "How do we know it's working?" },
  TAO: { label: "Flow", asks: "How does it survive long-term?" },
};

export interface PillarCanon {
  slug: string;
  name: string;
  classicalName: string;
  loreName: string;
  icon: string;
  colorPrimary: string;
  colorLight: string;
  colorDark: string;
  isMeta: boolean;
  questions: [string, string, string, string, string, string, string]; // OUSIA..TAO order
}

export const PILLARS: PillarCanon[] = [
  {
    slug: "compassion",
    name: "Compassion",
    classicalName: "Cor Lucis",
    loreName: "The Enlightened Heart",
    icon: "❤️",
    colorPrimary: "#EC4899",
    colorLight: "#FCE7F3",
    colorDark: "#831843",
    isMeta: false,
    questions: [
      "What does real compassion look like in a world where caring is often performed online but rarely practiced next door?",
      "What actually stops us from helping the people around us; fear, busyness, distrust, or something deeper?",
      "How do we turn sympathy into action; what is the path from “someone should do something” to being that someone?",
      "Who do we become when we care for strangers, and what courage does our community need from us right now?",
      "What becomes possible when neighbors truly know and help each other; which problems would simply disappear?",
      "How do we know compassion is working; what should a genuinely caring community be able to see, count, or prove?",
      "How do we keep compassion alive for the long haul; so it doesn't burn out, get exploited, or become charity theater?",
    ],
  },
  {
    slug: "hope",
    name: "Hope",
    classicalName: "Dawnspire",
    loreName: "The Rising Expectation",
    icon: "✨",
    colorPrimary: "#F59E0B",
    colorLight: "#FEF3C7",
    colorDark: "#92400E",
    isMeta: false,
    questions: [
      "What is real hope, and how is it different from wishful thinking or forced positivity?",
      "Why are so many people losing faith in the future; and which of those causes can ordinary people actually change?",
      "How do we build hope deliberately; what small wins can a community stack up to prove the future can be shaped?",
      "Who carries hope in dark times, and what does it take to be that person for the people around you?",
      "What futures open up when a generation refuses to despair about climate, technology, and society?",
      "How do we measure hope; what visible signs show that a community believes in its own future?",
      "How do we sustain hope through setbacks and slow progress, without sliding into denial or burning out?",
    ],
  },
  {
    slug: "justice",
    name: "Justice",
    classicalName: "Veritas Aequitas",
    loreName: "The Balance of Truth",
    icon: "⚖️",
    colorPrimary: "#3B82F6",
    colorLight: "#EFF6FF",
    colorDark: "#1E3A8A",
    isMeta: false,
    questions: [
      "What is justice at its core; fair outcomes, fair process, or something deeper than both?",
      "Why do so many people now feel the system is rigged; and where exactly is that feeling accurate?",
      "How should ordinary people pursue justice when institutions are slow, captured, or no longer trusted?",
      "Who deserves to hold power over others, and what should holding it cost them?",
      "What becomes possible in a community where everyone trusts they will be treated fairly?",
      "What would prove that a community's rules apply equally to its most powerful members?",
      "How does justice survive across generations without hardening into bureaucracy or curdling into revenge?",
    ],
  },
  {
    slug: "freedom",
    name: "Freedom",
    classicalName: "Concordia",
    loreName: "The Liberty in Agreement",
    icon: "🦅",
    colorPrimary: "#10B981",
    colorLight: "#ECFDF5",
    colorDark: "#064E3B",
    isMeta: false,
    questions: [
      "What is freedom, really; and where does my freedom end and yours begin?",
      "What quietly takes our freedom today; surveillance, debt, algorithms, dependence; and which losses are we choosing ourselves?",
      "How do free people stay free; what habits, tools, and agreements actually protect autonomy?",
      "What does a responsible free citizen look like, and what do they owe the community that protects their freedom?",
      "What becomes possible when people are genuinely free to speak, build, and dissent without fear?",
      "Beyond slogans, how do we honestly measure whether a community is actually free?",
      "How does freedom survive fear; when every crisis tempts a society to trade liberty for safety?",
    ],
  },
  {
    slug: "unity",
    name: "Unity",
    classicalName: "The Nexus Umbral",
    loreName: "The Binding Through Difference",
    icon: "🌍",
    colorPrimary: "#06B6D4",
    colorLight: "#ECFEFF",
    colorDark: "#082F4D",
    isMeta: false,
    questions: [
      "What truly unites people; and how is unity different from sameness or conformity?",
      "Why are societies fragmenting; which forces profit from dividing us, and how do we divide ourselves?",
      "How do we build real bonds across generations, beliefs, and backgrounds; without erasing the differences?",
      "Who builds bridges in a divided world, what does it cost them, and why do they do it anyway?",
      "What could communities accomplish by pooling their skills, tools, money, and time; what is possible together that is impossible alone?",
      "How do we know unity is real; what separates a genuine community from a comfortable echo chamber?",
      "How does unity survive disagreement; so the group bends during conflict instead of breaking?",
    ],
  },
  {
    slug: "harmony",
    name: "Harmony",
    classicalName: "Everbloom Grove",
    loreName: "The Perpetual Flourishing",
    icon: "🌼",
    colorPrimary: "#EF4444",
    colorLight: "#FEE2E2",
    colorDark: "#7F1D1D",
    isMeta: false,
    questions: [
      "What is harmony; between people, and between humanity and the world that sustains us?",
      "What throws our lives out of balance; and why do we keep choosing speed, noise, and more?",
      "How do we resolve conflict so both sides grow; instead of one side winning and both sides resenting?",
      "Who keeps the peace without silencing the truth; and how does someone become that person?",
      "What could a community attempt if disagreement didn't scare it; what becomes possible when conflict is handled well?",
      "What are the vital signs of a healthy community, family, or life; how do we know we're in balance?",
      "How is balance maintained while everything changes; technology, climate, work, and family all at once?",
    ],
  },
  {
    slug: "agoranet",
    name: "The Agora",
    classicalName: "Agoranet",
    loreName: "The Platform Itself",
    icon: "🏛️",
    colorPrimary: "#8B5CF6",
    colorLight: "#F3E8FF",
    colorDark: "#4C1D95",
    isMeta: true,
    questions: [
      "What should this platform be at its core; and what must it never be allowed to become?",
      "Why have other platforms made us lonelier, angrier, and more divided; and which of those failures were deliberate choices?",
      "How should good people organize here to turn shared values into real-world action?",
      "What makes a good citizen of AgoraNet; and what should earn a person standing, voice, and trust here?",
      "What could thousands of organized, good-willed people actually fix; which problems in our communities are waiting for us?",
      "How do we prove this place works; what real-world evidence should AgoraNet be judged by?",
      "How does AgoraNet stay good for a hundred years; what must be hard to change, and who guards the guardians?",
    ],
  },
];
