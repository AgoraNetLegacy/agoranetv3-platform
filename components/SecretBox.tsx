"use client";

import { useRef, useState } from "react";

// The one-time secret display (owner finding, 2026-07-14): a secret
// you can't copy is a secret you'll mistype. Three layers, because
// clipboard access varies by browser and privacy settings (Brave
// gates it hard): the async clipboard API → the legacy
// select-and-execCommand path → select the text and say so plainly,
// so one keystroke finishes the job. The value still renders exactly
// once, never touches storage, never rides a URL.
export function SecretBox({ value }: { value: string }) {
  const [state, setState] = useState<"idle" | "copied" | "selected">("idle");
  const spanRef = useRef<HTMLSpanElement>(null);

  function selectValue(): boolean {
    const node = spanRef.current;
    if (!node) return false;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
      return;
    } catch {
      // fall through — clipboard API refused (privacy settings, no
      // user-activation context); try the legacy path.
    }
    if (selectValue()) {
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      if (ok) {
        window.getSelection()?.removeAllRanges();
        setState("copied");
        setTimeout(() => setState("idle"), 2500);
      } else {
        // Honest last resort: the text is selected — one keystroke away.
        setState("selected");
      }
    }
  }

  return (
    <div className="secret-box">
      <span className="secret-value" ref={spanRef}>
        {value}
      </span>
      <button type="button" className="copy-button" onClick={copy}>
        {state === "copied"
          ? "✓ Copied"
          : state === "selected"
            ? "Selected — press ⌘C"
            : "Copy"}
      </button>
    </div>
  );
}
