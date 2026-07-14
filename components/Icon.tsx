// The platform icon family (Phase 8.5, PRESENTATION_SPEC §6.2): one
// matched set of inline SVGs replacing emoji and framework defaults
// everywhere EXCEPT the seven pillar glyphs — owner-ruled 2026-07-13:
// the pillar emoji stay as identity symbols. Icons inherit the text's
// color and size, so they read correctly in all three theme rooms.

const PATHS = {
  // Civic architecture: the brand mark, governance rooms, the record.
  temple: (
    <>
      <path d="M12 3 3.5 8.5h17L12 3z" />
      <path d="M5 8.5V17M9.7 8.5V17M14.3 8.5V17M19 8.5V17" />
      <path d="M3.5 17h17M3 20.5h18" />
    </>
  ),
  // Circles: two rings, joined — a bounded group, acting together.
  circles: (
    <>
      <circle cx="8.5" cy="12" r="5.2" />
      <circle cx="15.5" cy="12" r="5.2" />
    </>
  ),
  // The Pollinator: one hexagonal cell of the hive.
  hive: (
    <>
      <path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5z" />
      <path d="M12 8.2 15.3 10v4L12 15.8 8.7 14v-4L12 8.2z" />
    </>
  ),
  // The parking rule: the protection, not an error.
  parking: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M9.8 16.5v-9h3.4a2.8 2.8 0 1 1 0 5.6H9.8" />
    </>
  ),
  // Permanence: the record that outlives the moment.
  infinity: (
    <path d="M6.2 12c0-1.8 1.4-3.2 3.1-3.2 2.9 0 5.5 6.4 8.4 6.4 1.7 0 3.1-1.4 3.1-3.2s-1.4-3.2-3.1-3.2c-2.9 0-5.5 6.4-8.4 6.4-1.7 0-3.1-1.4-3.1-3.2z" />
  ),
  // Moderation service: the badge, worn for 48 hours, then put down.
  badge: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M9.2 13.2 7.7 21l4.3-2.4L16.3 21l-1.5-7.8" />
    </>
  ),
  // The commons: growth measured honestly.
  sprout: (
    <>
      <path d="M12 21v-7" />
      <path d="M12 14c0-4 3-6.8 6.8-6.8 0 4-3 6.8-6.8 6.8z" />
      <path d="M12 14c0-4-3-6.8-6.8-6.8 0 4 3 6.8 6.8 6.8z" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`pi${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
