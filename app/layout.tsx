import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./globals.css";
import { db } from "@/lib/db";
import { balanceOf } from "@/lib/economy";
import { activeTermFor } from "@/lib/moderation";
import { activeFace, sessionFaces, faceFlipPending } from "@/lib/webSession";
import { returnToHub, switchToFace, signOutSession } from "./actions";
import { Icon } from "@/components/Icon";

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
      {others.length === 0 && (
        <Link
          href="/login"
          className="lore"
          title="Switching appears here once both faces are signed into this browser — a one-time introduction per face."
        >
          switch face? sign your other face in once →
        </Link>
      )}
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

// The left-sidebar navigation (PRESENTATION_SPEC §1.3, order and labels
// owner-blessed 2026-07-13): the feature list lives on the left,
// persistent, collapsible on small screens. The moderation workbench
// appears only for badge-holders; admin surfaces never appear (none
// exist). Each door carries its benefit one-liner (§3.2) as a tooltip;
// the landing pages say it in full.
async function SideNav() {
  const face = await activeFace();
  let showWorkbench = false;
  if (face) {
    const [term, offer] = await Promise.all([
      activeTermFor(db, face.id),
      db.badgeOffer.findFirst({
        where: { profileId: face.id, status: "offered", expiresAt: { gt: new Date() } },
      }),
    ]);
    showWorkbench = Boolean(term || offer);
  }
  return (
    <nav className="sidebar" aria-label="The platform">
      <form action={returnToHub}>
        <button type="submit" className="navlink navlink-button">
          <Icon name="temple" /> The Agora
          <span className="nav-note">the platform dashboard</span>
        </button>
      </form>
      <Link className="navlink" href="/pillars">
        The Seven Pillars
      </Link>
      <Link
        className="navlink"
        href="/discussions"
        title="Say it where it can't be quietly erased."
      >
        Discussions
      </Link>
      <Link
        className="navlink"
        href="/governance"
        title="Decide together, sealed until it's fair."
      >
        Polls &amp; Governance
      </Link>
      <Link className="navlink" href="/circles" title="Turn talk into proof you acted.">
        Circles
      </Link>
      <Link
        className="navlink"
        href="/pollinator"
        title="Workshop an idea before you defend it in public."
      >
        The Neural Pollinator
      </Link>
      <Link
        className="navlink"
        href="/souls"
        title="Find your people; nobody watches you do it."
      >
        Fellow Souls &amp; Messages
      </Link>
      <Link
        className="navlink"
        href="/record"
        title="The record nobody can rewrite — including us."
      >
        The Public Record
      </Link>
      {face && (
        <Link className="navlink" href="/profile">
          This Face&rsquo;s Profile &amp; Settings
        </Link>
      )}
      {showWorkbench && (
        <Link className="navlink" href="/moderation">
          Moderation workbench
        </Link>
      )}
    </nav>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // THEME = IDENTITY (PRESENTATION_SPEC §2): the theme follows the FACE,
  // never OS preference — the room's color is a safety signal, so the
  // signal always wins. Resolved server-side so no render ever flashes
  // the wrong room.
  const [face, flip] = await Promise.all([activeFace(), faceFlipPending()]);
  const theme = !face ? "reader" : face.face === "TRUE_SELF" ? "true-self" : "alias";
  // §5.1: the switch-animation method is the face's own choice (flip
  // default; crossfade / instant for less motion — by choice, never
  // detection). Readers get the default.
  const flipMethod = face?.switchAnimation ?? "flip";
  return (
    <html lang="en" data-theme={theme} data-flip-method={flipMethod}>
      <body className={flip ? "page-shell flip-in" : "page-shell"}>
        <input type="checkbox" id="nav-open" className="nav-toggle-box" />
        <header className="site">
          <label htmlFor="nav-open" className="nav-toggle" aria-label="Menu">
            ☰
          </label>
          <form action={returnToHub} className="inline">
            <button type="submit" className="linklike brand">
              <Icon name="temple" /> AgoraNet
            </button>
          </form>
          <Link href="/search">Search</Link>
          <FaceBar />
        </header>
        <div className="shell">
          <SideNav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
