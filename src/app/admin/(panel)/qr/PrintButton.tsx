"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-12 rounded-card bg-primary px-5 font-bold text-on-primary"
    >
      {label}
    </button>
  );
}
