// Pillar dashboard editorial content (SEVEN_PILLAR_DASHBOARD_SPEC §5.1,
// §4.2, §7): the Why banner is that pillar's WHY_*.md "condensed to a few
// sentences, not the full document" (the spec's own instruction); the hub
// hook line is "a single short hook line drawn from its Strategic
// Conclusion or WHY document." Condensations keep the source documents'
// own language wherever a sentence survives whole. The Agora has no WHY
// document; its banner condenses the capstone's own Strategic Conclusion
// (agora_breakdown.md, owner-ratified 2026-07-10).

export interface PillarEditorial {
  pillarSlug: string;
  /** Hub tile hook; one short line (spec §4.2). */
  hookLine: string;
  /** Why banner; a few sentences condensed from WHY_*.md (spec §5.1). */
  whyBanner: string;
  /** The pillar's single flagship Stoic principle (breakdown grounding). */
  stoicPrinciple: string;
}

export const PILLAR_EDITORIAL: PillarEditorial[] = [
  {
    pillarSlug: "compassion",
    hookLine: "Not a luxury add-on; a rigid engineering requirement for a civilization that works.",
    whyBanner:
      "We built machines that can see across the universe; and still a person can lie in a hospital bed calculating whether the ambulance ride was worth the debt. None of that is natural law: every one of those outcomes is the product of a system somebody built, and systems that were built can be rebuilt. This pillar exists to make compassion structural instead of optional; a baseline of safety and dignity that isn't conditional on proving you deserve it first.",
    stoicPrinciple: "Oikeiôsis; Hierocles' Circles of Concern",
  },
  {
    pillarSlug: "hope",
    hookLine: "Make proof visible to each other; hope stops being a private wish and becomes collective belief.",
    whyBanner:
      "Never has it been easier to see everything that's broken; and never has it felt harder to believe your own effort could fix any of it. That isn't a personality flaw; it is what happens, predictably and mechanically, when real effort stops connecting to real outcome. This pillar exists to make belief the rational response to reality again: visible pathways, fast legible proof that effort works, and progress made visible to each other.",
    stoicPrinciple: "The Dichotomy of Control",
  },
  {
    pillarSlug: "justice",
    hookLine: "One set of rules: outcomes decided by facts, not by the wealth or power of the parties.",
    whyBanner:
      "The law is identical in wording and completely different in practice, depending on who you are. That is not what the Rule of Law is supposed to mean; it is what happens when the mechanisms of justice are captured to protect power and wealth instead of the people the law claims to serve equally. This pillar exists to make one thing true in practice, not just on paper: the outcome of a conflict is decided by its facts, not by the resources of the people involved.",
    stoicPrinciple: "Sympatheia & Cosmopolitanism",
  },
  {
    pillarSlug: "freedom",
    hookLine: "Not the absence of rules; the structurally guaranteed capacity to direct your own life.",
    whyBanner:
      "We were sold more choice than any generation in history and told that this was freedom; while the choices that actually determine the shape of a life quietly narrowed underneath. Freedom is not the absence of a rule forbidding something; it is the real, structurally guaranteed capacity to act on your own judgment without coercion. This pillar exists to close the gap between the freedom we're sold and the freedom we actually have.",
    stoicPrinciple: "Preferred Indifferents",
  },
  {
    pillarSlug: "unity",
    hookLine: "Structural solidarity: conflict directed at concentrated power, not at manufactured enemies.",
    whyBanner:
      "We built the tools to connect every person on the planet and ended up more suspicious of our own neighbors than any generation before us. That isn't proof people are more divided; it is what happens when fragmentation becomes more profitable, and more useful to entrenched power, than solidarity ever was. This pillar exists to make structural solidarity real again: not forced sameness, but the practical capacity of distinct people to pool their leverage and act together on what they actually share.",
    stoicPrinciple: "Kathēkon; Duty and Appropriate Action",
  },
  {
    pillarSlug: "harmony",
    hookLine: "Not the absence of friction; the continuous, healthy metabolism of it.",
    whyBanner:
      "We built a world that looks orderly by hiding whatever doesn't fit the picture; and a pressure cooker looks perfectly calm right up until it doesn't. Harmony has never meant stillness: it means a system healthy enough to keep correcting itself, continuously, in increments small enough that no correction is ever a crisis. This pillar exists to metabolize real difference and real tension instead of suppressing them.",
    stoicPrinciple: "Eupatheia vs. Pathē; Rational Equanimity vs. Suppressed or Irrational Passion",
  },
  {
    pillarSlug: "agoranet",
    hookLine: "The instrument layer: six examine what holds us back, The Agora equips, the community inherits.",
    whyBanner:
      "The six pillars end in questions; The Agora is what makes the questions answerable. It is not a seventh value; it is the instrument layer: an economy that cannot sell attention because it never captures it, records that cannot be revised because no one holds the pen, judges that cannot be bought because they cannot be predicted, and a founder whose power is constitutionally scheduled to dissolve into the community it served. The six examine the forces that hold us back. The Agora equips us to act. The community inherits.",
    stoicPrinciple: "The Discipline of Assent",
  },
];

export function editorialFor(slug: string): PillarEditorial {
  const e = PILLAR_EDITORIAL.find((p) => p.pillarSlug === slug);
  if (!e) throw new Error(`No pillar editorial for slug: ${slug}`);
  return e;
}
