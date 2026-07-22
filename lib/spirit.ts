// Spirit Mode (owner-ruled 2026-07-21): a per-face visibility veil.
// The face chooses a LEVEL in Settings (all three available, discovery
// is the default) and toggles the veil on/off at will from the bubble
// dot. Enforcement lives at the same choke points as blocks, and every
// refusal uses the block's own neutral wording (§5.2) — the veil must
// never itself be a signal.

export const SPIRIT_LEVELS = ["discovery", "inbound", "ghost"] as const;
export type SpiritLevel = (typeof SPIRIT_LEVELS)[number];

export const SPIRIT_LEVEL_LABELS: Record<SpiritLevel, string> = {
  discovery: "Discovery only — hidden from the search Souls lane",
  inbound:
    "Discovery + inbound — also refuses new fellow-soul requests and new message threads",
  ghost:
    "Full ghost — also walks unseen among your fellow souls; messages into existing threads wait",
};

const RANK: Record<SpiritLevel, number> = { discovery: 1, inbound: 2, ghost: 3 };

/** Is this face's veil covering the given surface right now? */
export function spiritCovers(
  profile: { spiritActive: boolean; spiritLevel: string },
  surface: SpiritLevel
): boolean {
  if (!profile.spiritActive) return false;
  const level = RANK[profile.spiritLevel as SpiritLevel] ?? RANK.discovery;
  return level >= RANK[surface];
}

export function asSpiritLevel(value: string): SpiritLevel {
  return (SPIRIT_LEVELS as readonly string[]).includes(value)
    ? (value as SpiritLevel)
    : "discovery";
}
