import type { Metadata } from "next";
import Link from "next/link";
import { config } from "@/config";
import { strings } from "@/content/strings";
import { formatHHMM } from "@/lib/time";

export const metadata: Metadata = { title: strings.pages.contactTitle };

const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default function ContactPage() {
  const r = config.restaurant;
  const days =
    r.hours.days.length === 7
      ? strings.everyDay
      : ALL_DAYS.filter((d) => r.hours.days.includes(d))
          .map((d) => strings.days[d])
          .join(", ");
  const tel = r.phone.replace(/[^\d+]/g, "");
  const wa = r.whatsapp?.replace(/\D/g, "");
  const button = "inline-flex h-12 items-center justify-center rounded-pill px-5 font-semibold";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="-ml-2 inline-flex h-11 items-center px-2 font-semibold text-primary">
        ← {strings.pages.goHome}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{strings.pages.contactTitle}</h1>
      <dl className="mt-6 space-y-5">
        <div>
          <dt className="text-sm font-semibold text-muted">{strings.pages.address}</dt>
          <dd className="mt-1">
            {r.address.line1}, {r.address.area}, {r.address.city} {r.address.pincode}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-muted">{strings.pages.hours}</dt>
          <dd className="mt-1">
            {days}: {formatHHMM(r.hours.open)} to {formatHHMM(r.hours.close)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-muted">{strings.pages.phone}</dt>
          <dd className="mt-1">{r.phone}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-muted">{strings.pages.email}</dt>
          <dd className="mt-1">
            <a href={`mailto:${r.email}`} className="underline underline-offset-4">
              {r.email}
            </a>
          </dd>
        </div>
      </dl>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href={`tel:${tel}`} className={`${button} bg-primary text-on-primary`}>
          {strings.common.callUs}
        </a>
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            rel="noopener"
            className={`${button} border border-line bg-surface`}
          >
            {strings.common.whatsapp}
          </a>
        )}
        {r.mapsUrl && (
          <a href={r.mapsUrl} rel="noopener" className={`${button} border border-line bg-surface`}>
            {strings.common.directions}
          </a>
        )}
      </div>
    </main>
  );
}
