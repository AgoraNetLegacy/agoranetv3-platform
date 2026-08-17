// The platform icon family (Phase 8.5, PRESENTATION_SPEC §6.2): one
// matched set of inline SVGs replacing emoji and framework defaults
// everywhere, including the seven pillar glyphs. Icons inherit the
// text's color and size, so they read correctly in all theme rooms.

const PATHS = {
  agora: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 1.8v2M12 20.2v2M1.8 12h2M20.2 12h2" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.2 4.2" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1z" />
    </>
  ),
  pillars: (
    <>
      <path d="M4 20V9M9.3 20V9M14.7 20V9M20 20V9M2.8 20h18.4M3 6.8 12 3l9 3.8H3z" />
    </>
  ),
  discuss: (
    <>
      <path d="M20.5 11.2a7.8 7.8 0 0 1-8.2 7.3 9.5 9.5 0 0 1-3-.5L4 20l1.6-4.2A7 7 0 0 1 3.5 11c0-4.1 3.8-7.5 8.5-7.5s8.5 3.4 8.5 7.7z" />
      <path d="M8 10h8M8 13.5h5" />
    </>
  ),
  vote: (
    <>
      <path d="M5 10.5 12 3l7 7.5" />
      <path d="M7.5 9.5v9h9v-9M10 14l1.5 1.5 3-3.2" />
    </>
  ),
  souls: (
    <>
      <circle cx="9" cy="8" r="3.3" />
      <circle cx="17" cy="10" r="2.6" />
      <path d="M3.5 20c.4-4 2.2-6.2 5.5-6.2s5.2 2.2 5.5 6.2M14.2 15.1c.8-.7 1.8-1 2.9-1 2.5 0 3.8 1.8 4.1 4.9" />
    </>
  ),
  record: (
    <>
      <path d="M6 3.5h9l3 3V20.5H6zM15 3.5v3h3" />
      <path d="M9 11h6M9 14.5h6M9 18h4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c.5-5 3-7.5 7.5-7.5s7 2.5 7.5 7.5" />
    </>
  ),
  bell: (
    <>
      <path d="M5 17.5h14l-1.6-2.2V10a5.4 5.4 0 0 0-10.8 0v5.3L5 17.5z" />
      <path d="M10 20.2h4" />
    </>
  ),
  lightScore: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M3.8 7.2l2.6 1.5M17.6 15.3l2.6 1.5M3.8 16.8l2.6-1.5M17.6 8.7l2.6-1.5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 9h18M15.5 13.8h2" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  compassion: (
    <>
      <path d="M12 20.2S4 15.6 4 9.5A4.1 4.1 0 0 1 11.2 6.8L12 8l.8-1.2A4.1 4.1 0 0 1 20 9.5c0 6.1-8 10.7-8 10.7z" />
      <path d="M7.5 12h2l1.2-2.2 2.1 4.5 1.3-2.3h2.4" />
    </>
  ),
  hope: (
    <>
      <path d="M12 2.8c.7 4.9 3.3 7.5 8.2 8.2-4.9.7-7.5 3.3-8.2 8.2-.7-4.9-3.3-7.5-8.2-8.2 4.9-.7 7.5-3.3 8.2-8.2z" />
      <path d="M19.5 3.5v3M21 5h-3M4.5 17.5v3M6 19H3" />
    </>
  ),
  justice: (
    <>
      <path d="M12 3v18M7 21h10M5 7h14" />
      <path d="m7 7-3 6h6L7 7zM17 7l-3 6h6l-3-6z" />
      <path d="M3.7 13c.6 1.5 1.7 2.3 3.3 2.3s2.7-.8 3.3-2.3M13.7 13c.6 1.5 1.7 2.3 3.3 2.3s2.7-.8 3.3-2.3" />
    </>
  ),
  freedom: (
    <>
      <path d="M12 20V9.5" />
      <path d="M12 12C9 7 6 5 2.8 5.4 4.2 10 7.2 12.5 12 14" />
      <path d="M12 12c3-5 6-7 9.2-6.6C19.8 10 16.8 12.5 12 14" />
      <path d="M5 8.5c1.6 3.4 3.9 5.4 7 6.2M19 8.5c-1.6 3.4-3.9 5.4-7 6.2" />
    </>
  ),
  unity: (
    <>
      <circle cx="12" cy="7" r="3" />
      <circle cx="7" cy="16" r="3" />
      <circle cx="17" cy="16" r="3" />
      <path d="m10.5 9.7-2 3.6M13.5 9.7l2 3.6M10 16h4" />
    </>
  ),
  harmony: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 9.6C9.8 7.2 10 4.2 12 2.5c2 1.7 2.2 4.7 0 7.1zM14.1 10.8c.8-3.1 3.5-4.4 6-3.5.1 2.7-1.8 4.9-5 5.2M14 13.4c3.1-.8 5.5.9 6.1 3.5-2.3 1.4-5 .4-6.5-2.4M11.7 14.4c2.2 2.4 2 5.4 0 7.1-2-1.7-2.2-4.7 0-7.1zM9.8 13.2c-.8 3.1-3.5 4.4-6 3.5-.1-2.7 1.8-4.9 5-5.2M10 10.6c-3.1.8-5.5-.9-6.1-3.5 2.3-1.4 5-.4 6.5 2.4" />
    </>
  ),
  // Civic architecture: the brand mark, governance rooms, the record.
  temple: (
    <>
      <path d="M12 3 3.5 8.5h17L12 3z" />
      <path d="M5 8.5V17M9.7 8.5V17M14.3 8.5V17M19 8.5V17" />
      <path d="M3.5 17h17M3 20.5h18" />
    </>
  ),
  // Circles: two rings, joined; a bounded group, acting together.
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

const PILLAR_ICON: Record<string, IconName> = {
  compassion: "compassion",
  hope: "hope",
  justice: "justice",
  freedom: "freedom",
  unity: "unity",
  harmony: "harmony",
  agoranet: "agora",
};

export function PillarMark({ slug, className }: { slug: string; className?: string }) {
  return <Icon name={PILLAR_ICON[slug] ?? "agora"} className={`pillar-mark pillar-${slug}${className ? ` ${className}` : ""}`} />;
}
