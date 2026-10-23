"use client";

import { strings } from "@/content/strings";

interface Props {
  name: string;
  quantity: number;
  max: number;
  onChange: (quantity: number) => void;
  /** Smaller variant used inside the cart list. */
  compact?: boolean;
}

/** − 2 + control. Every button is at least 44px tall for thumbs. */
export function QtyStepper({ name, quantity, max, onChange, compact = false }: Props) {
  const btn =
    "flex h-11 w-11 items-center justify-center text-xl font-bold text-on-primary disabled:opacity-40 active:scale-95 transition-transform";
  return (
    <div
      className={`inline-flex items-center rounded-pill bg-primary ${compact ? "" : "shadow-sm"}`}
      role="group"
      aria-label={name}
    >
      <button
        type="button"
        className={btn}
        onClick={() => onChange(quantity - 1)}
        aria-label={strings.menu.decrease(name)}
      >
        −
      </button>
      <span className="min-w-6 text-center font-semibold text-on-primary tabular-nums" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(quantity + 1)}
        disabled={quantity >= max}
        aria-label={strings.menu.increase(name)}
      >
        +
      </button>
    </div>
  );
}
