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
import { returnToHub, switchToFace, signOutSession, toggleSpiritMode } from "./actions";
import { Icon } from "@/components/Icon";
import { AutoCloseDetails } from "@/components/AutoCloseDetails";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AgoraNet",
  description: "A purpose-built civic commons.",
};

// The persistent profile indicator (DASHBOARD §3.4): always visible,
// visually distinct per face, switching is deliberate; never a silent
// toggle. Readers see their reading state plainly.
async function FaceBar() {
  const [face, faces] = await Promise.all([activeFace(), sessionFaces()]);
  if (!face) {
    return (
      <div className="face-bar">
        <span className="face-chip reader">Reading as guest</span>
        <Link href="/login" className="mobile-login-link">Sign in</Link>
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
      <span className="balance-chip">
        <span className="currency-amount">
          <span className="currency-symbol" tabIndex={0} aria-label="PollCoin">
            <img
              className="currency-mark pollcoin-mark"
              src="/brand/pollcoin/pollcoin-token.png"
              alt=""
              aria-hidden="true"
            />
            <span className="currency-tooltip" aria-hidden="true">PollCoin</span>
          </span>
          {pc.toFixed(2)} PC
        </span>
        <span className="balance-divider" aria-hidden="true" />
        <span className="currency-amount">
          <span className="currency-symbol" tabIndex={0} aria-label="Gratium">
            <img
              className="currency-mark"
              src="/brand/gratium/concepts/gratium-single-rail.svg"
              alt=""
              aria-hidden="true"
            />
            <span className="currency-tooltip" aria-hidden="true">Gratium</span>
          </span>
          {g.toFixed(2)} G
        </span>
      </span>
      <Link href="/inbox" className="icon-link" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Icon name="bell" />
        {unread > 0 && <span className="notification-dot">{unread}</span>}
        <span className="currency-tooltip" aria-hidden="true">Notifications</span>
      </Link>
    </div>
  );
}

// Deliberately NOT rendered inside <header>: the header has a
// backdrop-filter (for the glass effect), which makes it the containing
// block for any `position: fixed` descendant; the bubble would then
// pin to the header's own box instead of the viewport, and its popover
// would render off-screen. Rendered as a sibling of <header> instead so
// `fixed` resolves against the real viewport.
async function ProfileBubble() {
  const [face, faces] = await Promise.all([activeFace(), sessionFaces()]);
  if (!face) return null;
  // Cache-bust the bubble's mark by the image row's timestamp; the
  // bubble must always match the profile (owner finding 2026-07-22).
  const avatarRow = await db.profileImage.findUnique({
    where: { profileId_kind: { profileId: face.id, kind: "avatar" } },
    select: { updatedAt: true },
  });
  const avatarSrc = `/img/${face.handle}/avatar${
    avatarRow ? `?v=${avatarRow.updatedAt.getTime()}` : ""
  }`;
  // The switch rows' marks bust the same way; the selector must
  // always match the profiles (owner finding 2026-07-22).
  const others = faces.filter((f) => f.id !== face.id);
  const otherAvatars = await db.profileImage.findMany({
    where: { profileId: { in: others.map((o) => o.id) }, kind: "avatar" },
    select: { profileId: true, updatedAt: true },
  });
  const bustFor = new Map(
    otherAvatars.map((a) => [a.profileId, `?v=${a.updatedAt.getTime()}`])
  );
  const chipClass = face.face === "TRUE_SELF" ? "true-self" : "alias";
  return (
    // The anchor pins the bubble; the spirit dot lives OUTSIDE the
    // <details> because closed-details content is hidden and a button
    // inside <summary> would also toggle the panel.
    <div className="profile-bubble-anchor">
      {/* Spirit Mode dot (owner-ruled 2026-07-21): the small dot on the
          bubble IS the veil toggle; filled when visible, hollowed when
          walking unseen. The level itself is a Settings choice. */}
      <form action={toggleSpiritMode} className="spirit-toggle">
        <button
          type="submit"
          className={`profile-mode-dot ${chipClass}${face.spiritActive ? " spirit" : ""}`}
          aria-label={
            face.spiritActive
              ? "Spirit Mode is on; click to become visible"
              : "Click to enter Spirit Mode (visibility veil)"
          }
          title={face.spiritActive ? "Walking unseen; click to reappear" : "Spirit Mode"}
        />
      </form>
      {/* Keyed by the active face: a successful switch remounts the
          <details>, which resets its uncontrolled `open` state; the
          panel closes itself after a switch instead of lingering. On a
          refused switch the face (and key) are unchanged, so the panel
          stays open to show the refusal. */}
      <AutoCloseDetails className="profile-bubble" key={face.id}>
      <summary aria-label="Profile mode and face switching">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bubble-avatar" src={avatarSrc} alt="" />
      </summary>
      <div className="profile-bubble-panel">
        <div className="profile-bubble-heading">
          <span className={`face-chip ${chipClass}`}>
            {face.face === "TRUE_SELF" ? "◆ True Self" : "◇ Alias"}
          </span>
          <strong>{face.displayName}</strong>
          <span className="lore">@{face.handle}</span>
        </div>
        <p className="profile-bubble-note">
          Switching is deliberate: it ends this face&rsquo;s pillar sessions.
        </p>
        {others.length === 0 ? (
          <Link href="/login" className="profile-bubble-action">
            Sign your other face in once <Icon name="chevron" />
          </Link>
        ) : (
          others.map((p) => (
            <form key={p.id} action={switchToFace}>
              <input type="hidden" name="profileId" value={p.id} />
              <button
                type="submit"
                className={`profile-bubble-action ${
                  p.face === "TRUE_SELF" ? "face-row-true" : "face-row-alias"
                }`}
              >
                <span className="switch-face-name">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="avatar-sm"
                    src={`/img/${p.handle}/avatar${bustFor.get(p.id) ?? ""}`}
                    alt=""
                  />
                  Switch to {p.displayName}
                </span>
                <span>{p.face === "TRUE_SELF" ? "◆ True Self" : "◇ Alias"}</span>
              </button>
            </form>
          ))
        )}
        <div className="profile-bubble-links">
          <Link href="/profile">Profile</Link>
          <Link href="/alias">Hatch an Alias</Link>
          <Link href="/settings">Settings</Link>
          <Link href="/support">Support</Link>
          <form action={signOutSession} className="inline">
            <button type="submit" className="linklike">Sign out</button>
          </form>
        </div>
      </div>
      </AutoCloseDetails>
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
          <span className="nav-icon"><Icon name="agora" /></span>
          <span>The Agora
          <span className="nav-note">the platform dashboard</span>
          </span>
        </button>
      </form>
      <div className="nav-section-label">Explore</div>
      <Link className="navlink" href="/pillars">
        <span className="nav-icon"><Icon name="pillars" /></span><span>The Seven Pillars</span>
      </Link>
      <Link
        className="navlink"
        href="/discussions"
        title="Say it where it can't be quietly erased."
      >
        <span className="nav-icon"><Icon name="discuss" /></span><span>General Discussions</span>
      </Link>
      <Link
        className="navlink"
        href="/governance"
        title="Decide together, sealed until it's fair."
      >
        <span className="nav-icon"><Icon name="vote" /></span><span>Polls &amp; Governance</span>
      </Link>
      <Link className="navlink" href="/circles" title="Turn talk into proof you acted.">
        <span className="nav-icon"><Icon name="circles" /></span><span>Circles</span>
      </Link>
      <Link
        className="navlink"
        href="/pollinator"
        title="Workshop an idea before you defend it in public."
      >
        <span className="nav-icon"><Icon name="hive" /></span><span>The Neural Pollinator</span>
      </Link>
      <Link
        className="navlink"
        href="/souls"
        title="Find your people; nobody watches you do it."
      >
        <span className="nav-icon"><Icon name="souls" /></span><span>Fellow Souls &amp; Messages</span>
      </Link>
      <Link
        className="navlink"
        href="/record"
        title="The record nobody can rewrite; including us."
      >
        <span className="nav-icon"><Icon name="record" /></span><span>The Public Record</span>
      </Link>
      {face && (
        <Link className="navlink" href="/profile">
          <span className="nav-icon"><Icon name="profile" /></span><span>This Face&rsquo;s Profile</span>
        </Link>
      )}
      {showWorkbench && (
        <Link className="navlink" href="/moderation">
          <span className="nav-icon"><Icon name="badge" /></span><span>Moderation workbench</span>
        </Link>
      )}
    </nav>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // THEME = IDENTITY (PRESENTATION_SPEC §2): the theme follows the FACE,
  // never OS preference; the room's color is a safety signal, so the
  // signal always wins. Resolved server-side so no render ever flashes
  // the wrong room.
  const [face, flip] = await Promise.all([activeFace(), faceFlipPending()]);
  const theme = !face ? "reader" : face.face === "TRUE_SELF" ? "true-self" : "alias";
  // §5.1: the switch-animation method is the face's own choice (flip
  // default; crossfade / instant for less motion; by choice, never
  // detection). Readers get the default.
  const flipMethod = face?.switchAnimation ?? "flip";
  return (
    <html lang="en" data-theme={theme} data-flip-method={flipMethod}>
      <body className={flip ? "page-shell flip-in" : "page-shell"}>
        <input type="checkbox" id="nav-open" className="nav-toggle-box" />
        <header className="site">
          <label htmlFor="nav-open" className="nav-toggle" aria-label="Menu">
            <Icon name="menu" />
          </label>
          <form action={returnToHub} className="inline">
            <button type="submit" className="linklike brand">
              <span className="brand-mark"><Icon name="agora" /></span>
              <span>AgoraNet<small>Civic observatory</small></span>
            </button>
          </form>
          <Link href="/search" className="search-door"><Icon name="search" /><span>Search</span></Link>
          <FaceBar />
        </header>
        <ProfileBubble />
        <div className="shell">
          <SideNav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
