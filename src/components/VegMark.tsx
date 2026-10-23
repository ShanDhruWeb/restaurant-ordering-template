import { strings } from "@/content/strings";

/** The standard Indian veg (green square, dot) / non-veg (brown square, triangle) marker. */
export function VegMark({ isVeg, className = "" }: { isVeg: boolean; className?: string }) {
  // FSSAI marker colours are a legal convention, not a theme choice, so they are
  // fixed here deliberately (the only fixed colours in the UI).
  const colour = isVeg ? "#0F8A3C" : "#8B3A1A";
  return (
    <span
      role="img"
      aria-label={isVeg ? strings.common.veg : strings.common.nonVeg}
      title={isVeg ? strings.common.veg : strings.common.nonVeg}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center border-2 bg-surface ${className}`}
      style={{ borderColor: colour }}
    >
      {isVeg ? (
        <span className="h-2 w-2 rounded-full" style={{ background: colour }} />
      ) : (
        <span
          className="h-0 w-0"
          style={{
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            borderBottom: `7px solid ${colour}`,
          }}
        />
      )}
    </span>
  );
}
