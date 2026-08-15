import { describe, it, expect } from "vitest";
import { safePath } from "../lib/safePath";

describe("safePath; open-redirect guard (CWE-601)", () => {
  it("allows same-origin relative paths through unchanged", () => {
    expect(safePath("/verify/seed", "/")).toBe("/verify/seed");
    expect(safePath("/", "/x")).toBe("/");
    expect(safePath("/d/abc123?m=hello", "/")).toBe("/d/abc123?m=hello");
  });

  it("rejects off-origin targets and normalization tricks, using the fallback", () => {
    expect(safePath("https://evil.example", "/")).toBe("/");
    expect(safePath("//evil.example", "/")).toBe("/"); // protocol-relative
    expect(safePath("/\\evil.example", "/home")).toBe("/home"); // /\ → //
    expect(safePath("javascript:alert(1)", "/")).toBe("/");
    expect(safePath("", "/fallback")).toBe("/fallback");
    expect(safePath("evil.example/path", "/")).toBe("/"); // no leading slash
  });
});
