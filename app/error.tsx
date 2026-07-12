"use client";

// The refusal boundary. Server actions refuse loudly (walls, missing
// faces, spec-gated actions); production masks thrown messages, so this
// boundary keeps the refusal humane. Pace-wall refusals are the common
// case a stranger could meet — say so honestly.

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error.message?.includes("Pace wall")
    ? error.message
    : "That action was refused. If you were moving quickly, wait a minute " +
      "and try again; if this keeps happening, the platform wants to know.";
  return (
    <main style={{ maxWidth: "40rem", margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Refused, honestly</h1>
      <p>{message}</p>
      <button onClick={() => reset()}>Try again</button>
    </main>
  );
}
