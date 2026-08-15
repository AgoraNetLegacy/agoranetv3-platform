import Link from "next/link";
import { Markdown } from "@/lib/markdown";
import { CONSTITUTION_MARKDOWN } from "@/lib/constitutionContent";
import { Icon } from "@/components/Icon";

// The Constitution, readable by anyone (owner walkthrough finding,
// 2026-07-15): souls acknowledge this document at onboarding, so the
// full text lives ON the platform; public, no account, no fee. Reading
// is free (Invariant 7), and nothing binds a soul that they cannot read.
export default function ConstitutionPage() {
  return (
    <>
      <h1>
        <Icon name="temple" /> The AgoraNet Constitution
      </h1>
      <p className="lore">
        This is the full founding text; the same document every soul
        acknowledges before their first post. At launch it is hashed and
        anchored on-chain, so the version you read here is verifiably the
        version everyone agreed to. The written rules it authorizes live
        at <Link href="/rules">the rulebook</Link>; where the money goes
        lives at <Link href="/transparency">transparency</Link>.
      </p>
      <Markdown source={CONSTITUTION_MARKDOWN} />
      <p className="lore">
        Amendments move by governance poll under Article IV; this page
        always renders the current ratified text.
      </p>
    </>
  );
}
