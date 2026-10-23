"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-11 rounded-pill border border-line bg-surface px-4 font-semibold"
    >
      {label}
    </button>
  );
}
