import { describe, it, expect } from "vitest";
import { PILLARS, LENSES } from "../lib/canon";

describe("the canon (7 pillars × 7 lenses = 49 questions)", () => {
  it("has exactly 7 pillars with unique slugs", () => {
    expect(PILLARS).toHaveLength(7);
    expect(new Set(PILLARS.map((p) => p.slug)).size).toBe(7);
  });

  it("has exactly 7 lenses", () => {
    expect(LENSES).toHaveLength(7);
  });

  it("gives every pillar exactly 7 non-empty questions", () => {
    for (const pillar of PILLARS) {
      expect(pillar.questions).toHaveLength(7);
      for (const q of pillar.questions) expect(q.trim().length).toBeGreaterThan(0);
    }
  });

  it("marks The Agora; and only The Agora; as the meta-pillar", () => {
    const meta = PILLARS.filter((p) => p.isMeta);
    expect(meta).toHaveLength(1);
    expect(meta[0].slug).toBe("agoranet");
    expect(meta[0].name).toBe("The Agora");
  });
});
