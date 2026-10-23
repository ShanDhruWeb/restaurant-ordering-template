import type { Metadata } from "next";
import { config } from "@/config";
import { adminStrings } from "@/content/adminStrings";
import { strings } from "@/content/strings";
import { formatHHMM } from "@/lib/time";
import { getSettings } from "@/server/settings";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: adminStrings.nav.settings };

const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default async function SettingsPage() {
  const s = await getSettings();
  const h = config.restaurant.hours;
  const t = adminStrings.settings;
  const days =
    h.days.length === 7
      ? strings.everyDay
      : ALL_DAYS.filter((d) => h.days.includes(d))
          .map((d) => strings.days[d])
          .join(", ");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <SettingsForm initial={{ acceptingOrders: s.acceptingOrders, bannerMessage: s.bannerMessage }} />
      <section className="mt-8 rounded-card border border-line bg-surface p-4">
        <h2 className="text-lg font-bold">{t.hours}</h2>
        <p className="mt-2 text-lg">
          {days}: {formatHHMM(h.open)} to {formatHHMM(h.close)}
        </p>
        <p className="mt-1">{config.ordering.enforceHours ? t.enforced : t.notEnforced}</p>
        <p className="mt-2 text-sm text-muted">{t.hoursHelp}</p>
      </section>
    </div>
  );
}
