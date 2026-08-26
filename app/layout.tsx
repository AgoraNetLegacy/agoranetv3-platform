import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./globals.css";
import { activeFace, faceFlipPending } from "@/lib/webSession";
import { chromeData } from "@/lib/chromeData";
import { switchToFace, signOutSession, toggleSpiritMode } from "./actions";
import { Icon } from "@/components/Icon";
import { AutoCloseDetails } from "@/components/AutoCloseDetails";
import { LightScoreMenu } from "@/components/LightScoreMenu";
import { db } from "@/lib/db";
import { getOwnerDashboardOperator } from "@/lib/supportOperations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AgoraNet",
  description: "A purpose-built civic commons.",
};

// The persistent profile indicator (DASHBOARD §3.4): always visible,
// visually distinct per identity, switching is deliberate; never a silent
// toggle. Readers see their reading state plainly.
async function FaceBar() {
  const { face, balances, walletBalances, economyMode, unread } = await chromeData();
  if (!face) {
    return (
      <div className="face-bar">
        <span className="face-chip reader">Reading as guest</span>
        <Link href="/login" className="mobile-login-link">Sign in</Link>
        <Link href="/verify">Create your True Self</Link>
      </div>
    );
  }
  const chipClass = face.face === "TRUE_SELF" ? "true-self" : "alias";
  const walletMode = economyMode === "wallet" || economyMode === "mixed";
  // PC/G are one application asset. In Wallet mode, show internal ledger
  // custody plus observed testnet custody as one balance.
  const pcTotal = balances.PC + Number(walletBalances.PC);
  const gTotal = balances.G + Number(walletBalances.G);
  return (
    <div className="face-bar">
      <span className={`face-chip ${chipClass}`}>
        {face.face === "TRUE_SELF" ? "◆ True Self" : "◇ Alias"} ·{" "}
        {face.displayName} @{face.handle}
      </span>
      <span className="balance-chip">
        <span className="currency-tooltip" aria-hidden="true">
          {walletMode ? "PC/G balance · internal + Cardano testnet custody" : "PC/G balance · internal custody"}
        </span>
        <span className="currency-amount">
          <span className="currency-symbol" tabIndex={0} aria-label="PollCoin balance">
            <img
              className="currency-mark pollcoin-mark"
              src="/brand/pollcoin/pollcoin-token-v1.webp"
              alt=""
              aria-hidden="true"
            />
            <span className="currency-tooltip" aria-hidden="true">PollCoin</span>
          </span>
          {pcTotal.toFixed(2)} PC
        </span>
        <span className="balance-divider" aria-hidden="true" />
        <span className="currency-amount">
          <span className="currency-symbol" tabIndex={0} aria-label="Gratium balance">
            <img
              className="currency-mark"
              src="/brand/gratium/concepts/gratium-single-rail.svg"
              alt=""
              aria-hidden="true"
            />
            <span className="currency-tooltip" aria-hidden="true">Gratium</span>
          </span>
          {gTotal.toFixed(2)} G
        </span>
      </span>
      <LightScoreMenu key={face.handle} />
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
  const { face, faces, avatarVersions } = await chromeData();
  if (!face) return null;
  // Cache-bust the bubble's mark by the image row's timestamp; the
  // bubble must always match the profile (owner finding 2026-07-22).
  const avatarVersion = avatarVersions.get(face.id);
  const avatarSrc = `/img/${face.handle}/avatar${
    avatarVersion ? `?v=${avatarVersion}` : ""
  }`;
  // The switch rows' marks bust the same way; the selector must
  // always match the profiles (owner finding 2026-07-22).
  const others = faces.filter((f) => f.id !== face.id);
  const bustFor = new Map(
    others.map((other) => {
      const version = avatarVersions.get(other.id);
      return [other.id, version ? `?v=${version}` : ""];
    })
  );
  const chipClass = face.face === "TRUE_SELF" ? "true-self" : "alias";
  return (
    // The anchor pins the bubble; the spirit dot lives OUTSIDE the
    // <details> because closed-details content is hidden and a button
    // inside <summary> would also toggle the panel.
    <div className="profile-bubble-anchor">
      {/* Presence dot: green means online; white means offline. */}
      <form action={toggleSpiritMode} className="spirit-toggle">
        <button
          type="submit"
          className={`profile-mode-dot ${chipClass}${face.spiritActive ? " spirit" : ""}`}
          aria-label={face.spiritActive ? "Offline; click to appear online" : "Online; click to appear offline"}
          title={face.spiritActive ? "Offline" : "Online"}
        />
      </form>
      {/* Keyed by the active identity: a successful switch remounts the
          <details>, which resets its uncontrolled `open` state; the
          panel closes itself after a switch instead of lingering. On a
          refused switch the identity (and key) are unchanged, so the panel
          stays open to show the refusal. */}
      <AutoCloseDetails className="profile-bubble" key={face.id}>
      <summary aria-label="Profile mode and identity switching">
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
          Choose an identity below to switch. Switching ends the current
          identity&rsquo;s pillar sessions.
        </p>
        {others.length === 0 ? (
          <Link href="/login" className="profile-bubble-action">
            {face.face === "TRUE_SELF"
              ? "Sign in to your Alias"
              : "Sign in to your True Self"} <Icon name="chevron" />
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
                  Switch to {p.face === "TRUE_SELF" ? "True Self" : "Alias"}
                </span>
                <span>{p.face === "TRUE_SELF" ? "◆ True Self" : "◇ Alias"}</span>
              </button>
            </form>
          ))
        )}
        <div className="profile-bubble-links">
          <Link href="/profile">Profile</Link>
          <Link href="/alias">Create an Alias</Link>
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
  const { face, showWorkbench } = await chromeData();
  const ownerDashboard = face ? await getOwnerDashboardOperator(db, face.id) : null;
  return (
    <nav className="sidebar" aria-label="The platform">
      <Link href="/" className="navlink navlink-button">
          <span className="nav-icon"><Icon name="agora" /></span>
          <span>The Agora
          <span className="nav-note">the platform dashboard</span>
          </span>
      </Link>
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
          <span className="nav-icon"><Icon name="profile" /></span><span>This Identity&rsquo;s Profile</span>
        </Link>
      )}
      {showWorkbench && (
        <Link className="navlink" href="/moderation">
          <span className="nav-icon"><Icon name="badge" /></span><span>Moderation workbench</span>
        </Link>
      )}
      <div className="nav-section-label">Help</div>
      <Link
        className="navlink"
        href="/support"
        title="Guidance, troubleshooting, and human support."
      >
        <span className="nav-icon"><Icon name="compass" /></span><span>Help &amp; Support</span>
      </Link>
      {ownerDashboard && (
        <Link className="navlink" href="/support/operations/overview">
          <span className="nav-icon"><Icon name="record" /></span><span>Owner operations</span>
        </Link>
      )}
    </nav>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // THEME = IDENTITY (PRESENTATION_SPEC §2): the theme follows the identity,
  // never OS preference; the room's color is a safety signal, so the
  // signal always wins. Resolved server-side so no render ever flashes
  // the wrong room.
  const [face, flip] = await Promise.all([activeFace(), faceFlipPending()]);
  const theme = !face ? "reader" : face.face === "TRUE_SELF" ? "true-self" : "alias";
  // §5.1: the switch-animation method is the identity's own choice (flip
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
          <Link href="/" className="brand">
              <span className="brand-mark"><Icon name="agora" /></span>
              <span>AgoraNet<small>Civic observatory</small></span>
          </Link>
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
