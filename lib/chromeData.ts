import { cache } from "react";
import { db } from "./db";
import { activeTermFor } from "./moderation";
import { sessionContext } from "./webSession";
import { synchronizedWalletBalanceView } from "./synchronizedWalletBalance";

// The persistent shell is present on every signed-in page. Resolve its data
// in one request-scoped loader so FaceBar, ProfileBubble, SideNav, and the
// root theme never repeat identity or account reads. All private reads remain
// constrained to the active profile or profiles signed into this session.
export const chromeData = cache(async function chromeData() {
  const context = await sessionContext();
  const face = context?.active ?? null;
  const faces = context?.profiles ?? [];
  if (!face) {
    return {
      face: null,
      faces,
      balances: { PC: 0, G: 0 },
      walletBalances: { PC: "0", G: "0", observedAt: null, syncStatus: "missing" },
      economyMode: "credits",
      unread: 0,
      avatarVersions: new Map<string, number>(),
      showWorkbench: false,
    };
  }

  const [balances, unread, avatars, term, offer] = await Promise.all([
    db.balance.findMany({
      where: { profileId: face.id, currency: { in: ["PC", "G"] } },
      select: { currency: true, amount: true },
    }),
    db.notification.count({ where: { profileId: face.id, readAt: null } }),
    db.profileImage.findMany({
      where: { profileId: { in: faces.map((profile) => profile.id) }, kind: "avatar" },
      select: { profileId: true, updatedAt: true },
    }),
    activeTermFor(db, face.id),
    db.badgeOffer.findFirst({
      where: { profileId: face.id, status: "offered", expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
  ]);
  const amount = new Map(balances.map((balance) => [balance.currency, balance.amount]));
  const walletBalances =
    face.economyMode === "wallet" || face.economyMode === "mixed"
      ? (await synchronizedWalletBalanceView(face.id)).balances
      : { PC: "0", G: "0", observedAt: null, syncStatus: "missing" };
  return {
    face,
    faces,
    balances: { PC: amount.get("PC") ?? 0, G: amount.get("G") ?? 0 },
    walletBalances,
    economyMode: face.economyMode,
    unread,
    avatarVersions: new Map(
      avatars.map((avatar) => [avatar.profileId, avatar.updatedAt.getTime()])
    ),
    showWorkbench: Boolean(term || offer),
  };
});
