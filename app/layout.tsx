import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./globals.css";
import { db } from "@/lib/db";
import { balanceOf } from "@/lib/economy";
import { activeFace, sessionFaces, faceFlipPending } from "@/lib/webSession";
import { returnToHub, switchToFace, signOutSession } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AgoraNet",
  description: "A purpose-built civic commons.",
};

// The persistent profile indicator (DASHBOARD §3.4): always visible,
// visually distinct per face, switching is deliberate — never a silent
// toggle. Readers see their reading state plainly.
async function FaceBar() {
  const [face, faces] = await Promise.all([activeFace(), sessionFaces()]);
  if (!face) {
    return (
      <div className="face-bar">
        <span className="face-chip reader">Reading as guest</span>
        <Link href="/login">sign in</Link>
        <Link href="/verify">verify to act</Link>
      </div>
    );
  }
  const others = faces.filter((f) => f.id !== face.id);
  const chipClass = face.face === "TRUE_SELF" ? "true-self" : "alias";
  const [pc, g, unread] = await Promise.all([
    balanceOf(db, face.id, "PC"),
    balanceOf(db, face.id, "G"),
    db.notification.count({ where: { profileId: face.id, readAt: null } }),
  ]);
  return (
    <div className="face-bar">
      <span className={`face-chip ${chipClass}`}>
        {face.face === "TRUE_SELF" ? "◆ True Self" : "◇ Alias"} ·{" "}
        {face.displayName} @{face.handle}
      </span>
      <span className="lore" title="This face's own balances — your two faces' funds never touch.">
        {pc.toFixed(2)} PC · {g.toFixed(2)} G
      </span>
      <Link href="/inbox">inbox{unread > 0 ? ` (${unread})` : ""}</Link>
      <Link href="/souls">souls</Link>
      <Link href="/moderation">workbench</Link>
      <Link href="/profile">profile</Link>
      {others.length > 0 && (
        <details className="switch-control">
          <summary>switch face</summary>
          <div className="switch-panel">
            <p>
              Switching is deliberate: it ends this face's pillar
              sessions.
            </p>
            {others.map((p) => (
              <form key={p.id} action={switchToFace}>
                <input type="hidden" name="profileId" value={p.id} />
                <button type="submit">
                  Switch to {p.displayName} @{p.handle} ({p.face === "TRUE_SELF" ? "True Self" : "Alias"})
                </button>
              </form>
            ))}
          </div>
        </details>
      )}
      <form action={signOutSession} className="inline">
        <button type="submit">sign out</button>
      </form>
    </div>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // THEME = IDENTITY (PRESENTATION_SPEC §2): the theme follows the FACE,
  // never OS preference — the room's color is a safety signal, so the
  // signal always wins. Resolved server-side so no render ever flashes
  // the wrong room.
  const [face, flip] = await Promise.all([activeFace(), faceFlipPending()]);
  const theme = !face ? "reader" : face.face === "TRUE_SELF" ? "true-self" : "alias";
  return (
    <html lang="en" data-theme={theme}>
      <body className={flip ? "page-shell flip-in" : "page-shell"}>
        <header className="site">
          <form action={returnToHub} className="inline">
            <button type="submit" className="linklike brand">
              🏛️ AgoraNet
            </button>
          </form>
          <form action={returnToHub} className="inline">
            <button type="submit" className="linklike">
              Hub
            </button>
          </form>
          <Link href="/feed">Feed</Link>
          <Link href="/search">Search</Link>
          <Link href="/circles">Circles</Link>
          <Link href="/pollinator">Pollinator</Link>
          <Link href="/ledger">Ledger</Link>
          <Link href="/transparency">Transparency</Link>
          <FaceBar />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
