import type { ReactNode } from "react";

/** The section "?" (owner pattern, 2026-07-21): every major section can
 *  carry a small question-mark that unfolds the feature's fuller story
 *  — one click away for souls who want depth, zero clutter for souls
 *  who don't. Pure <details>, like the rest of the chrome: works
 *  without JavaScript. */
export function LearnMore({
  label,
  children,
}: {
  /** Accessible name for the "?" control, e.g. "About search". */
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="learn-more">
      <summary aria-label={label} title={label}>
        ?
      </summary>
      <div className="learn-more-panel">{children}</div>
    </details>
  );
}
