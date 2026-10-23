"use client";

import { strings } from "@/content/strings";

/** "● Live" / "● Offline, retrying" with the time of the last successful update. */
export function LiveStatus({ live, lastUpdated }: { live: boolean; lastUpdated: Date | null }) {
  const time = lastUpdated?.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <div role="status" aria-live="polite" className="text-right text-xs">
      <span
        className={`inline-flex items-center gap-1 font-semibold ${live ? "text-success" : "text-danger"}`}
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${live ? "bg-success" : "bg-danger"}`} />
        {live ? strings.common.live : strings.common.offline}
      </span>
      {time && <span className="block text-muted">{strings.common.updatedAt(time)}</span>}
    </div>
  );
}
