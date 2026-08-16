"use client";

// The calm nudge (BEACON_FEED_SPEC §7): entirely client-side; a
// timer in the soul's own browser, nothing measured, nothing sent.
// After the identity's chosen minutes of dashboard reading, one quiet
// inline card suggests acting instead; at the identity's own daily cap it
// says "you asked me to stop here." At most once each per session.
// Day-minute accounting lives in localStorage, keyed per identity and day
//; it never leaves the browser.

import { useEffect, useState } from "react";
import Link from "next/link";

function dayKey(faceId: string) {
  const d = new Date();
  return `beacon-min-${faceId}-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function BeaconNudge({
  faceId,
  nudgeAfterMin,
  dailyCapMin,
}: {
  faceId: string;
  nudgeAfterMin: number | null;
  dailyCapMin: number | null;
}) {
  const [show, setShow] = useState<"nudge" | "cap" | null>(null);

  useEffect(() => {
    const TICK_S = 30;
    const started = Date.now();
    const timer = setInterval(() => {
      if (document.hidden) return;
      const key = dayKey(faceId);
      const dayMin =
        (Number(localStorage.getItem(key)) || 0) + TICK_S / 60;
      localStorage.setItem(key, String(dayMin));
      const sessionMin = (Date.now() - started) / 60_000;

      if (
        dailyCapMin !== null &&
        dayMin >= dailyCapMin &&
        !sessionStorage.getItem("beacon-cap-shown")
      ) {
        sessionStorage.setItem("beacon-cap-shown", "1");
        setShow("cap");
      } else if (
        nudgeAfterMin !== null &&
        sessionMin >= nudgeAfterMin &&
        !sessionStorage.getItem("beacon-nudge-shown")
      ) {
        sessionStorage.setItem("beacon-nudge-shown", "1");
        setShow("nudge");
      }
    }, TICK_S * 1000);
    return () => clearInterval(timer);
  }, [faceId, nudgeAfterMin, dailyCapMin]);

  if (!show) return null;
  return (
    <div className="beacon-nudge" role="status">
      {show === "nudge" ? (
        <p>
          You&rsquo;ve been reading a while; something here worth acting
          on? <Link href="/circles">Find a Circle</Link> ·{" "}
          <Link href="/pillars">work a question</Link>
        </p>
      ) : (
        <p>
          You asked me to stop here; your daily feed budget is spent.
          The commons will keep; <Link href="/circles">go make
          something happen</Link>.
        </p>
      )}
      <button type="button" className="linklike" onClick={() => setShow(null)}>
        dismiss
      </button>
    </div>
  );
}
