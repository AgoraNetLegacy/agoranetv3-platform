"use client";

import { useCallback, useRef, useState } from "react";
import {
  loadActiveLightScores,
  type LightScoreMenuRow,
} from "@/app/lightScoreActions";
import { Icon, PillarMark } from "@/components/Icon";

type LoadState = "idle" | "loading" | "loaded" | "error";

export function LightScoreMenu() {
  const requested = useRef(false);
  const [state, setState] = useState<LoadState>("idle");
  const [rows, setRows] = useState<LightScoreMenuRow[]>([]);
  const [error, setError] = useState("Light Score is unavailable right now.");

  const ensureLoaded = useCallback(async () => {
    if (requested.current) return;
    requested.current = true;
    setState("loading");
    try {
      const result = await loadActiveLightScores();
      if (!result.ok) {
        setError(result.reason);
        setState("error");
        return;
      }
      setRows(result.rows);
      setState("loaded");
    } catch {
      setState("error");
    }
  }, []);

  return (
    <details
      className="light-score-menu"
      onMouseEnter={() => void ensureLoaded()}
      onFocus={() => void ensureLoaded()}
      onToggle={(event) => {
        if (event.currentTarget.open) void ensureLoaded();
      }}
    >
      <summary
        className="icon-link"
        aria-label="Light Score by pillar"
        title="Light Score"
      >
        <Icon name="lightScore" />
      </summary>
      <div className="light-score-panel" aria-live="polite">
        <div className="light-score-heading">Light Score</div>
        {state === "idle" && (
          <div className="light-score-status">Open to load your six pillar scores.</div>
        )}
        {state === "loading" && (
          <div className="light-score-status">Loading…</div>
        )}
        {state === "error" && (
          <div className="light-score-status">{error}</div>
        )}
        {state === "loaded" &&
          rows.map((pillar) => (
            <div className="light-score-row" key={pillar.slug}>
              <span>
                <PillarMark slug={pillar.slug} /> {pillar.name}
              </span>
              <strong>{pillar.points}</strong>
            </div>
          ))}
      </div>
    </details>
  );
}
