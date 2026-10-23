"use client";

// Last-resort error page when the root layout itself fails. It cannot use the
// theme (the layout did not render), so it stays plain and readable.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>Please try again. If it keeps happening, call the restaurant.</p>
        <button type="button" onClick={reset} style={{ minHeight: 48, padding: "0 24px", fontSize: 16 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
