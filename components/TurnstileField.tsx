"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: {
        sitekey: string;
        theme?: "auto" | "light" | "dark";
        callback?: (token: string) => void;
        "expired-callback"?: () => void;
        "error-callback"?: () => void;
      }) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

export function TurnstileField({ siteKey }: { siteKey?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const widget = useRef<string>();

  useEffect(() => {
    const render = () => {
      if (!siteKey || !container.current || !window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: (token) => {
          if (input.current) input.current.value = token;
        },
        "expired-callback": () => {
          if (input.current) input.current.value = "";
        },
        "error-callback": () => {
          if (input.current) input.current.value = "";
        },
      });
    };
    render();
    window.addEventListener("turnstile-ready", render);
    return () => window.removeEventListener("turnstile-ready", render);
  }, [siteKey]);

  if (!siteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => window.dispatchEvent(new Event("turnstile-ready"))}
      />
      <div ref={container} aria-label="Human check" />
      <input ref={input} type="hidden" name="turnstileToken" />
    </>
  );
}
