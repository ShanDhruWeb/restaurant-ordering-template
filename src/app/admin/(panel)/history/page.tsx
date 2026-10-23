import type { Metadata } from "next";
import Link from "next/link";
import { adminStrings } from "@/content/adminStrings";
import { strings } from "@/content/strings";
import { formatRupees } from "@/lib/money";
import { formatIstTime, istDateString } from "@/lib/time";
import { getHistory, historyQuerySchema } from "@/server/admin/history";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: adminStrings.nav.history };

const t = adminStrings.history;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const raw = await searchParams;
  const parsed = historyQuerySchema.safeParse({
    from: raw.from || undefined,
    to: raw.to || undefined,
    q: raw.q || undefined,
    page: raw.page,
  });
  const query = parsed.success ? parsed.data : { page: 1 };
  const data = await getHistory(query);
  const today = istDateString();
  const qs = (extra: Record<string, string | number>) =>
    new URLSearchParams(
      Object.entries({ from: query.from ?? "", to: query.to ?? "", q: query.q ?? "", ...extra }).filter(
        ([, v]) => v !== "",
      ) as [string, string][],
    ).toString();
  const field = "mt-1 h-12 w-full rounded-card border border-line bg-surface px-3";

  return (
    <div>
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <form method="get" className="mt-4 grid gap-3 sm:grid-cols-[auto_auto_1fr_auto]">
        <label>
          <span className="text-sm font-semibold">{t.from}</span>
          <input type="date" name="from" defaultValue={query.from ?? today} max={today} className={field} />
        </label>
        <label>
          <span className="text-sm font-semibold">{t.to}</span>
          <input
            type="date"
            name="to"
            defaultValue={query.to ?? query.from ?? today}
            max={today}
            className={field}
          />
        </label>
        <label>
          <span className="text-sm font-semibold">{t.search}</span>
          <input type="search" name="q" defaultValue={query.q ?? ""} maxLength={40} className={field} />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-12 rounded-card bg-primary px-5 font-bold text-on-primary">
            {t.apply}
          </button>
          <a
            href={`/api/admin/history/export?${qs({})}`}
            className="inline-flex h-12 items-center rounded-card border border-line px-4 font-semibold"
          >
            {t.export}
          </a>
        </div>
      </form>

      <p className="mt-4 text-lg font-semibold">
        {t.summary(data.paidCount, formatRupees(data.paidTotalPaise))}
      </p>

      {data.orders.length === 0 ? (
        <p className="mt-8 text-center text-muted">{t.empty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-shade">
              <tr>
                <th className="p-3">{t.columns.number}</th>
                <th className="p-3">{t.columns.time}</th>
                <th className="p-3">{t.columns.customer}</th>
                <th className="p-3">{t.columns.status}</th>
                <th className="p-3 text-right">{t.columns.total}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td className="p-3 font-bold">
                    #{o.dailyNumber}
                    <span className="block text-xs font-normal text-muted">{o.numberDate}</span>
                  </td>
                  <td className="p-3">{formatIstTime(o.createdAt)}</td>
                  <td className="p-3">
                    {o.customerName}
                    <span className="block text-xs text-muted">
                      {o.tableLabel ? strings.common.table(o.tableLabel) : strings.common.takeaway}
                      {o.customerPhone ? ` · ${o.customerPhone}` : ""}
                    </span>
                  </td>
                  <td className="p-3">
                    {adminStrings.status[o.status]}
                    <span className="block text-xs text-muted">
                      {adminStrings.payment[o.paymentStatus]}
                      {o.refundStatus !== "none" ? ` · ${adminStrings.refund[o.refundStatus]}` : ""}
                      {o.latePayment ? ` · ${adminStrings.late}` : ""}
                    </span>
                  </td>
                  <td className="p-3 text-right font-semibold tabular-nums">{formatRupees(o.totalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.pages > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Pages">
          {query.page > 1 ? (
            <Link
              href={`?${qs({ page: query.page - 1 })}`}
              className="inline-flex h-12 items-center rounded-card border border-line px-4"
            >
              ← {t.prev}
            </Link>
          ) : (
            <span />
          )}
          <span>{t.page(query.page, data.pages)}</span>
          {query.page < data.pages ? (
            <Link
              href={`?${qs({ page: query.page + 1 })}`}
              className="inline-flex h-12 items-center rounded-card border border-line px-4"
            >
              {t.next} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
