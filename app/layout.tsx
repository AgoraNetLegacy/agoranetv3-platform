import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { db } from "@/lib/db";
import { activeProfile } from "@/lib/devSession";
import { selectDevFace, createDevSouls } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AgoraNet",
  description: "A purpose-built civic commons.",
};

async function DevFaceBar() {
  const [current, profiles] = await Promise.all([
    activeProfile(),
    db.profile.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <div className="dev-face">
      <span className="interim-note">
        dev session — onboarding arrives in Phase 2
      </span>
      <form action={selectDevFace} className="inline">
        <select name="profileId" defaultValue={current?.id ?? ""}>
          <option value="">(read only)</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.pseudonym} · {p.face === "TRUE_SELF" ? "True Self" : "Alias"}
            </option>
          ))}
        </select>
        <button type="submit">act as</button>
      </form>
      <form action={createDevSouls} className="inline">
        <button type="submit">+ dev soul</button>
      </form>
    </div>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site">
          <Link className="brand" href="/">
            🏛️ AgoraNet
          </Link>
          <Link href="/">Pillars</Link>
          <Link href="/ledger">Ledger</Link>
          <DevFaceBar />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
