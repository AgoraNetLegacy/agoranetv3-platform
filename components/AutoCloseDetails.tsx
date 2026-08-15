"use client";

import { useRef, type ReactNode } from "react";

/** A <details> that closes itself when a link inside it is followed.
 *  Client-side navigation keeps the layout; and this element's open
 *  state; mounted, so a panel opened from the persistent chrome would
 *  otherwise linger over the next page. Form submits are already
 *  handled elsewhere (the face key remounts the bubble on a switch);
 *  this covers the plain links (Profile, Settings). */
export function AutoCloseDetails({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className={className}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) {
          ref.current?.removeAttribute("open");
        }
      }}
    >
      {children}
    </details>
  );
}
