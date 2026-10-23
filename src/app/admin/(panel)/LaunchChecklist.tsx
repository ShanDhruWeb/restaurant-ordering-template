import { adminStrings } from "@/content/adminStrings";
import type { ChecklistItem } from "@/lib/compliance";

/** Collapsed by default so the kitchen board stays in view; shows only what is still incomplete. */
export function LaunchChecklist({ items }: { items: ChecklistItem[] }) {
  const t = adminStrings.launch;
  if (items.length === 0) return null;
  const required = items.filter((i) => i.level === "required").length;
  return (
    <details className="mb-4 rounded-card border border-line bg-surface">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 py-2 font-semibold">
        {t.title}
        <span className="rounded-pill bg-tint px-2 py-0.5 text-sm">
          {required > 0 ? t.summaryRequired(required) : t.summaryRecommended(items.length)}
        </span>
      </summary>
      <div className="border-t border-line px-4 py-3">
        <p className="text-sm text-muted">{t.intro}</p>
        <ul className="mt-3 space-y-3">
          {items.map((i) => (
            <li key={i.id + i.title} className="rounded-card border border-line p-3">
              <p className="font-semibold">
                {i.title}{" "}
                <span className="text-xs font-normal text-muted">
                  ({i.level === "required" ? t.required : t.recommended})
                </span>
              </p>
              <p className="mt-1 text-sm">{i.instruction}</p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
