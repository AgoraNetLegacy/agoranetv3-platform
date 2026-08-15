// The onboarding journey, visible (owner directive, 2026-07-14): every
// ceremony screen shows where you are, what's done, and what's next;
// hand-holding for the new soul that costs the experienced soul
// nothing, since the bar reads at a glance and the flow itself never
// slows down. The journey ends by carrying the soul to the Agora
// Dashboard.

const STEPS = [
  { key: "gate", label: "The gate" },
  { key: "credential", label: "Save your credential" },
  { key: "trueself", label: "Name your True Self" },
  { key: "key", label: "Save your access key" },
  { key: "consents", label: "Two consents" },
  { key: "tour", label: "Orientation" },
  { key: "seed", label: "Values seed" },
] as const;

export type JourneyStep = (typeof STEPS)[number]["key"];

export function JourneySteps({ current }: { current: JourneyStep }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  const next = STEPS[idx + 1];
  return (
    <nav className="journey" aria-label="Your onboarding journey">
      <ol>
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            className={i < idx ? "done" : i === idx ? "current" : "ahead"}
          >
            {i < idx ? "✓ " : `${i + 1}. `}
            {s.label}
          </li>
        ))}
      </ol>
      <p className="journey-next">
        {next
          ? `Next: ${next.label.toLowerCase()}; then the Agora, your dashboard.`
          : "Last step; the Agora, your dashboard, is right through here."}
      </p>
    </nav>
  );
}
