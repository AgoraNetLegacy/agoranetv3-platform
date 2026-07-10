import { describe, it, expect } from "vitest";
import {
  canonicalJson,
  computeEntryHash,
  verifyChain,
  findForbiddenId,
  GENESIS_HASH,
} from "../lib/ledger";

describe("canonicalJson", () => {
  it("sorts keys recursively so equal objects hash equally", () => {
    const a = canonicalJson({ b: 1, a: { d: 2, c: [1, { z: 0, y: 1 }] } });
    const b = canonicalJson({ a: { c: [1, { y: 1, z: 0 }], d: 2 }, b: 1 });
    expect(a).toBe(b);
  });

  it("drops undefined values and keeps null", () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

function buildChain(payloads: Array<Record<string, unknown>>) {
  const events = [];
  let prevHash = GENESIS_HASH;
  for (const [i, p] of payloads.entries()) {
    const payload = canonicalJson(p);
    const eventType = `test.event`;
    const entryHash = computeEntryHash(prevHash, eventType, payload);
    events.push({ seq: i + 1, prevHash, entryHash, eventType, payload });
    prevHash = entryHash;
  }
  return events;
}

describe("verifyChain", () => {
  it("accepts a well-formed chain from GENESIS", () => {
    const events = buildChain([{ n: 1 }, { n: 2 }, { n: 3 }]);
    const result = verifyChain(events);
    expect(result.valid).toBe(true);
    expect(result.checked).toBe(3);
  });

  it("detects a tampered payload", () => {
    const events = buildChain([{ n: 1 }, { n: 2 }, { n: 3 }]);
    events[1].payload = canonicalJson({ n: 99 });
    const result = verifyChain(events);
    expect(result.valid).toBe(false);
    expect(result.firstBrokenSeq).toBe(2);
    expect(result.reason).toContain("entryHash mismatch");
  });

  it("detects a broken link (deleted event)", () => {
    const events = buildChain([{ n: 1 }, { n: 2 }, { n: 3 }]);
    events.splice(1, 1); // delete the middle event
    const result = verifyChain(events);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("prevHash mismatch");
  });
});

describe("findForbiddenId", () => {
  it("finds an internal id hiding in a payload", () => {
    const event = {
      actorId: "bright-heron-42",
      payload: canonicalJson({ note: "leaked", ref: "clx123internal" }),
    };
    expect(findForbiddenId(event, ["clx123internal"])).toBe("clx123internal");
  });

  it("finds an internal id used as actorId", () => {
    const event = { actorId: "clx123internal", payload: "{}" };
    expect(findForbiddenId(event, ["clx123internal"])).toBe("clx123internal");
  });

  it("passes a clean pseudonym-only event", () => {
    const event = {
      actorId: "bright-heron-42",
      payload: canonicalJson({ handle: "bright-heron-42", nullifier: "ab12" }),
    };
    expect(findForbiddenId(event, ["clx123internal", "clx456other"])).toBeNull();
  });
});
