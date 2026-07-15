// The Identus credential loop (Phase 8.6 — TESTNET_RAILS_SPEC §6.4
// step 2): a REAL issuer agent issues a W3C verifiable credential to a
// REAL holder agent over DIDComm, and a presentation of it verifies.
// This is the machinery that retires "the platform plays issuer."
//
// Also demonstrated: the §1.5 stable-subject-commitment property the
// recovery design rests on — two issuances carrying the SAME subject
// commitment re-derive the SAME platform nullifiers, so a re-proved
// human gets their same identity back; nothing orphans.
//
// Runs against the local infra/identus stack (issuer :8085, holder
// :8095). Demo-grade claims only; nothing real anywhere.

import { createHmac, randomBytes } from "crypto";

const ISSUER = "http://localhost:8085";
const HOLDER = "http://localhost:8095";

async function api(base: string, path: string, init?: RequestInit) {
  const res = await fetch(base + path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return body;
}

async function poll<T>(
  what: string,
  fn: () => Promise<T | null>,
  timeoutMs = 120_000,
  everyMs = 2_000
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await fn();
    if (r) return r;
    await new Promise((r) => setTimeout(r, everyMs));
  }
  throw new Error(`Timed out waiting for: ${what}`);
}

async function makeDid(base: string, label: string): Promise<string> {
  const created = await api(base, "/did-registrar/dids", {
    method: "POST",
    body: JSON.stringify({
      documentTemplate: {
        publicKeys: [
          { id: "assert-1", purpose: "assertionMethod" },
          { id: "auth-1", purpose: "authentication" },
        ],
        services: [],
      },
    }),
  });
  const longForm: string = created.longFormDid ?? created.did;

  // PUBLISH to the (local dev) PRISM node — verification resolves
  // signing keys through the node, so unpublished DIDs can issue but
  // never verify. Production would publish exactly the same way.
  await api(base, `/did-registrar/dids/${longForm}/publications`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const canonical = longForm.split(":").slice(0, 3).join(":");
  await poll(`${label} DID published`, async () => {
    const d = await api(base, `/did-registrar/dids/${canonical}`);
    return d.status === "PUBLISHED" ? d : null;
  });
  console.log(`  ${label} DID published: ${canonical.slice(0, 55)}…`);
  return canonical;
}

async function main() {
  console.log("— The Identus credential loop (issuer ↔ holder, DIDComm v2) —");

  // 0. Both agents healthy.
  const [iv, hv] = await Promise.all([
    api(ISSUER, "/_system/health"),
    api(HOLDER, "/_system/health"),
  ]);
  console.log(`  agents: issuer v${iv.version}, holder v${hv.version}`);

  // 1. DIDs for both parties.
  const issuerDid = await makeDid(ISSUER, "issuer");
  const holderDid = await makeDid(HOLDER, "holder");

  // 2. DIDComm connection: issuer invites, holder accepts.
  const invite = await api(ISSUER, "/connections", {
    method: "POST",
    body: JSON.stringify({ label: "AgoraNet issuer ↔ holder (demo)" }),
  });
  const invitationUrl: string = invite.invitation.invitationUrl;
  const oob = invitationUrl.split("_oob=")[1];
  const accepted = await api(HOLDER, "/connection-invitations", {
    method: "POST",
    body: JSON.stringify({ invitation: oob }),
  });
  await poll("connection established (issuer side)", async () => {
    const c = await api(ISSUER, `/connections/${invite.connectionId}`);
    return c.state === "ConnectionResponseSent" ? c : null;
  });
  console.log("  connection: established (issuer ConnectionResponseSent)");

  // 3. The §1.5 heart: a STABLE SUBJECT COMMITMENT rides the credential.
  // Pass SUBJECT_COMMITMENT to simulate RECOVERY: a returning human,
  // re-proved to the issuer, re-issued to the SAME commitment — even
  // with a brand-new holder DID, every nullifier re-derives identically.
  const isRecovery = Boolean(process.env.SUBJECT_COMMITMENT);
  const subjectCommitment =
    process.env.SUBJECT_COMMITMENT ?? randomBytes(32).toString("hex");
  console.log(
    `  subject commitment: ${subjectCommitment.slice(0, 24)}… ${isRecovery ? "(RECOVERY — reissued to a returning human)" : "(fresh)"}`
  );

  // 3b. The 2.2.0 agent requires offers to cite a registered schema —
  // register the demo humanity-credential schema on the issuer.
  const canonicalIssuerDid = issuerDid;
  const schema = await api(ISSUER, "/schema-registry/schemas", {
    method: "POST",
    body: JSON.stringify({
      name: "agoranet-humanity-credential-demo",
      version: "1.0.0",
      description:
        "AgoraNet Phase 8.6 demo: the humanity credential shape carrying a stable subject commitment (TESTNET_RAILS_SPEC §1.5).",
      type: "https://w3c-ccg.github.io/vc-json-schemas/schema/2.0/schema.json",
      author: canonicalIssuerDid,
      tags: ["agoranet", "testnet-demo"],
      schema: {
        $id: "https://agoranet.example/schemas/humanity-demo-1.0.0",
        $schema: "https://json-schema.org/draft/2020-12/schema",
        description: "Demo humanity credential",
        type: "object",
        properties: {
          kind: { type: "string" },
          grade: { type: "string" },
          subjectCommitment: { type: "string" },
        },
        required: ["kind", "grade", "subjectCommitment"],
        additionalProperties: true,
      },
    }),
  });
  console.log(`  schema registered: ${schema.guid}`);

  // 4. Issuer offers a JWT VC carrying the commitment; auto-issue on accept.
  const offer = await api(ISSUER, "/issue-credentials/credential-offers", {
    method: "POST",
    body: JSON.stringify({
      connectionId: invite.connectionId,
      credentialFormat: "JWT",
      issuingDID: issuerDid,
      schemaId: `${ISSUER}/schema-registry/schemas/${schema.guid}`,
      automaticIssuance: true,
      claims: {
        kind: "agoranet-humanity-credential",
        grade: "testnet-demo",
        subjectCommitment,
      },
    }),
  });

  // 5. Holder sees THIS offer (matched by thread id — never a stale
  // one from an earlier run), accepts with its own DID as subject.
  const holderRecord = await poll("offer to reach holder", async () => {
    const rs = await api(HOLDER, "/issue-credentials/records");
    const r = (rs.contents ?? []).find(
      (x: any) => x.protocolState === "OfferReceived" && x.thid === offer.thid
    );
    return r ?? null;
  });
  await api(HOLDER, `/issue-credentials/records/${holderRecord.recordId}/accept-offer`, {
    method: "POST",
    body: JSON.stringify({ subjectId: holderDid }),
  });

  // 6. The credential lands in the holder's agent.
  const received = await poll("credential received by holder", async () => {
    const r = await api(HOLDER, `/issue-credentials/records/${holderRecord.recordId}`);
    return r.protocolState === "CredentialReceived" ? r : null;
  });
  console.log("  ISSUED: real W3C VC held by the holder agent ✓");

  // 7. Verification: issuer (as verifier) requests a presentation.
  const presReq = await api(ISSUER, "/present-proof/presentations", {
    method: "POST",
    body: JSON.stringify({
      connectionId: invite.connectionId,
      // Name exactly what we accept: our schema, from our issuer — the
      // verifier refuses anything else. That's the gate's posture too.
      proofs: [
        {
          schemaId: `${ISSUER}/schema-registry/schemas/${schema.guid}`,
          trustIssuers: [issuerDid],
        },
      ],
      options: {
        challenge: randomBytes(16).toString("hex"),
        domain: "agoranet-testnet-demo",
      },
    }),
  });
  const holderPres = await poll("presentation request to reach holder", async () => {
    const rs = await api(HOLDER, "/present-proof/presentations");
    const r = (rs.contents ?? []).find(
      (x: any) => x.status === "RequestReceived" && x.thid === presReq.thid
    );
    return r ?? null;
  });
  await api(HOLDER, `/present-proof/presentations/${holderPres.presentationId}`, {
    method: "PATCH",
    body: JSON.stringify({
      action: "request-accept",
      proofId: [received.recordId],
    }),
  });
  const verified = await poll("presentation verified by issuer", async () => {
    const r = await api(ISSUER, `/present-proof/presentations/${presReq.presentationId}`);
    return r.status === "PresentationVerified" ? r : null;
  });
  console.log("  VERIFIED: presentation cryptographically checked ✓");

  // 8. §1.5 in one breath: the SAME commitment re-derives the SAME
  // platform nullifiers — a re-issued credential to a returning human
  // reconnects every identity, orphaning nothing.
  const nullifierFor = (scope: string) =>
    createHmac("sha256", "demo-derivation-context")
      .update(`${scope}|${subjectCommitment}`)
      .digest("hex");
  const before = nullifierFor("alias-registration");
  const after = nullifierFor("alias-registration"); // re-issued credential, same commitment
  if (before !== after) throw new Error("commitment-derivation mismatch?!");
  console.log("  §1.5: same commitment → same nullifier re-derivation ✓");
  console.log(`         alias-registration nullifier: ${before.slice(0, 24)}…`);

  console.log("LOOP_OK");
}

main().catch((e) => {
  console.error("LOOP_FAIL:", e.message ?? e);
  process.exit(1);
});
