import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "./PrintButton";
import { strings } from "@/content/strings";
import { getIdentity } from "@/lib/identity";
import { formatRupees } from "@/lib/money";
import { buildReceipt, RECEIPT_TEXT } from "@/lib/receipt";
import { getPublicOrder } from "@/server/orders/publicOrder";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Receipt", robots: { index: false, follow: false } };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) notFound();
  const order = await getPublicOrder(id);
  if (!order) notFound();
  const identity = getIdentity();

  if (order.paymentStatus !== "paid") {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold">{RECEIPT_TEXT.title}</h1>
        <p className="mt-3 text-muted">{strings.receipt.notPaid}</p>
        <Link
          href={`/order/${order.id}`}
          className="mt-6 inline-flex h-12 items-center rounded-pill bg-primary px-6 font-semibold text-on-primary"
        >
          {strings.receipt.backToOrder}
        </Link>
      </main>
    );
  }

  const r = buildReceipt(identity, order);
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="no-print flex items-center justify-between gap-3">
        <Link
          href={`/order/${order.id}`}
          className="-ml-2 inline-flex h-11 items-center px-2 font-semibold text-primary"
        >
          ← {strings.receipt.backToOrder}
        </Link>
        <PrintButton label={strings.receipt.print} />
      </div>
      <article className="mt-4 rounded-card border border-line bg-surface p-5 print:border-0 print:p-0">
        <header>
          <p className="font-heading text-xl font-bold" data-identity="legal-name">
            {r.legalName}
          </p>
          {r.legalName !== r.tradeName && <p className="text-sm text-muted">{r.tradeName}</p>}
          <p className="mt-1 text-sm">{r.address}</p>
          {r.gstin && <p className="text-sm">GSTIN: {r.gstin}</p>}
          {r.fssai && <p className="text-sm">FSSAI: {r.fssai}</p>}
        </header>
        <h1 className="mt-5 text-2xl font-bold">{RECEIPT_TEXT.title}</h1>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{strings.receipt.orderNumber}</dt>
          <dd>#{r.orderNumber}</dd>
          <dt className="text-muted">{strings.receipt.dateTime}</dt>
          <dd>{r.dateTime} IST</dd>
          <dt className="text-muted">{strings.receipt.orderType}</dt>
          <dd>{r.orderType}</dd>
        </dl>
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 font-semibold">{strings.receipt.item}</th>
              <th className="py-2 text-right font-semibold">{strings.receipt.qty}</th>
              <th className="py-2 text-right font-semibold">{strings.receipt.price}</th>
              <th className="py-2 text-right font-semibold">{strings.receipt.amount}</th>
            </tr>
          </thead>
          <tbody>
            {r.lines.map((l, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-2 pr-2">{l.name}</td>
                <td className="py-2 text-right tabular-nums">{l.quantity}</td>
                <td className="py-2 text-right tabular-nums">{formatRupees(l.unitPaise)}</td>
                <td className="py-2 text-right tabular-nums">{formatRupees(l.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 text-right text-base font-bold">
                {strings.receipt.total}
              </td>
              <td className="pt-3 text-right text-base font-bold tabular-nums">
                {formatRupees(r.totalPaise)}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-4 font-semibold">{r.paymentStatus}</p>
        <p className="mt-1 text-sm text-muted">{r.taxStatement}</p>
        <p className="mt-1 text-sm text-muted">{RECEIPT_TEXT.notTaxInvoice}</p>
      </article>
    </main>
  );
}
