"use client";

import { type FormEvent, useState } from "react";
import { adminStrings } from "@/content/adminStrings";
import { adminApi } from "@/lib/client/adminApi";

const t = adminStrings.settings;

export function SettingsForm({ initial }: { initial: { acceptingOrders: boolean; bannerMessage: string } }) {
  const [accepting, setAccepting] = useState(initial.acceptingOrders);
  const [banner, setBanner] = useState(initial.bannerMessage);
  const [status, setStatus] = useState<string | null>(null);

  const save = async (body: { acceptingOrders?: boolean; bannerMessage?: string }) => {
    setStatus(null);
    const res = await adminApi<{ acceptingOrders: boolean; bannerMessage: string }>("/api/admin/settings", {
      method: "POST",
      body,
    });
    if (!res.ok) return setStatus(res.data.error ?? adminStrings.board.actionFailed);
    setAccepting(res.data.acceptingOrders);
    setBanner(res.data.bannerMessage);
    setStatus(t.saved);
  };

  const submitBanner = (e: FormEvent) => {
    e.preventDefault();
    void save({ bannerMessage: banner });
  };

  return (
    <div className="mt-4 space-y-6">
      <section className="rounded-card border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="accepting-label" className="text-lg font-bold">
              {t.accepting}
            </h2>
            <p className="text-sm text-muted">{t.acceptingHelp}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={accepting}
            aria-labelledby="accepting-label"
            onClick={() => save({ acceptingOrders: !accepting })}
            className={`h-16 min-w-28 rounded-card text-2xl font-bold ${accepting ? "bg-success text-surface" : "bg-danger text-surface"}`}
          >
            {accepting ? t.on : t.off}
          </button>
        </div>
      </section>

      <form onSubmit={submitBanner} className="rounded-card border border-line bg-surface p-4">
        <label className="block">
          <span className="text-lg font-bold">{t.banner}</span>
          <input
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
            maxLength={160}
            placeholder={t.bannerPlaceholder}
            className="mt-2 h-12 w-full rounded-card border border-line bg-surface px-3"
          />
        </label>
        <button type="submit" className="mt-3 h-12 rounded-card bg-primary px-5 font-bold text-on-primary">
          {t.save}
        </button>
      </form>

      {status && (
        <p role="status" className="rounded-card bg-tint px-3 py-2 font-semibold">
          {status}
        </p>
      )}
    </div>
  );
}
