import type { Metadata } from "next";
import { adminStrings } from "@/content/adminStrings";
import { formatRupees } from "@/lib/money";
import { formatIstDateTime } from "@/lib/time";
import { getPaymentHealth } from "@/server/admin/paymentHealth";
import { getSettings } from "@/server/settings";
import { CheckNowButton, LateOrderActions } from "./PaymentActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: adminStrings.nav.payments };

const t = adminStrings.payments;

export default async function PaymentsPage() {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [h, settings] = await Promise.all([getPaymentHealth({ from, to }), getSettings()]);
  const total =
    h.capturedWithoutOrder.length +
    h.paidWithoutCapture.length +
    h.latePayments.length +
    h.mismatches.length +
    h.duplicates.length +
    h.refundsNeeded.length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted">
            {t.intro} ({t.range})
          </p>
        </div>
        <CheckNowButton />
      </div>
      {settings.lastReconcileAt && (
        <p className="mt-2 text-sm text-muted">
          {t.lastCheck(formatIstDateTime(settings.lastReconcileAt), settings.lastReconcileSummary)}
        </p>
      )}
      {h.gatewayError && (
        <p role="alert" className="mt-4 rounded-card bg-danger px-3 py-2 font-semibold text-surface">
          {h.gatewayError}
        </p>
      )}
      {total === 0 && !h.gatewayError && (
        <p className="mt-6 rounded-card bg-tint px-4 py-6 text-center text-lg font-semibold">✓ {t.allGood}</p>
      )}

      <Section
        title={t.sections.latePayments}
        help={t.sections.latePaymentsHelp}
        count={h.latePayments.length}
      >
        {h.latePayments.map((o) => (
          <Row key={o.orderId}>
            <span className="font-bold">
              #{o.dailyNumber} · {o.numberDate}
            </span>
            <span>
              {o.customerName}
              {o.customerPhone ? ` · ${o.customerPhone}` : ""}
            </span>
            <span className="font-semibold">{formatRupees(o.totalPaise)}</span>
            <LateOrderActions orderId={o.orderId} canAccept={o.status === "expired"} />
          </Row>
        ))}
      </Section>

      <Section
        title={t.sections.capturedWithoutOrder}
        help={t.sections.capturedWithoutOrderHelp}
        count={h.capturedWithoutOrder.length}
      >
        {h.capturedWithoutOrder.map((p) => (
          <Row key={p.razorpayPaymentId}>
            <code>{p.razorpayPaymentId}</code>
            <span>{p.razorpayOrderId ?? "-"}</span>
            <span className="font-semibold">{formatRupees(p.amountPaise)}</span>
            <span className="text-sm text-muted">{formatIstDateTime(p.createdAt)}</span>
          </Row>
        ))}
      </Section>

      <Section
        title={t.sections.paidWithoutCapture}
        help={t.sections.paidWithoutCaptureHelp}
        count={h.paidWithoutCapture.length}
      >
        {h.paidWithoutCapture.map((o) => (
          <Row key={o.orderId}>
            <span className="font-bold">
              #{o.dailyNumber} · {o.numberDate}
            </span>
            <span className="font-semibold">{formatRupees(o.totalPaise)}</span>
          </Row>
        ))}
      </Section>

      <Section title={t.sections.mismatches} help={t.sections.mismatchesHelp} count={h.mismatches.length}>
        {h.mismatches.map((m) => (
          <Row key={m.razorpayPaymentId}>
            <code>{m.razorpayPaymentId}</code>
            <span>
              {m.currency} {m.currency === "INR" ? formatRupees(m.amountPaise) : m.amountPaise}
            </span>
            <span>Order total: {m.orderTotalPaise === null ? "-" : formatRupees(m.orderTotalPaise)}</span>
          </Row>
        ))}
      </Section>

      <Section title={t.sections.duplicates} help={t.sections.duplicatesHelp} count={h.duplicates.length}>
        {h.duplicates.map((d) => (
          <Row key={d.razorpayPaymentId}>
            <span className="font-bold">#{d.dailyNumber}</span>
            <code>{d.razorpayPaymentId}</code>
            <span className="font-semibold">{formatRupees(d.amountPaise)}</span>
          </Row>
        ))}
      </Section>

      <Section
        title={t.sections.refundsNeeded}
        help={t.sections.refundsNeededHelp}
        count={h.refundsNeeded.length}
      >
        {h.refundsNeeded.map((o) => (
          <Row key={o.orderId}>
            <span className="font-bold">
              #{o.dailyNumber} · {o.numberDate}
            </span>
            <span>
              {o.customerName}
              {o.customerPhone ? ` · ${o.customerPhone}` : ""}
            </span>
            <span className="font-semibold">{formatRupees(o.totalPaise)}</span>
          </Row>
        ))}
      </Section>
    </div>
  );
}

function Section(props: { title: string; help: string; count: number; children: React.ReactNode }) {
  if (props.count === 0) return null;
  return (
    <section className="mt-6 rounded-card border-2 border-danger bg-surface p-4">
      <h2 className="text-lg font-bold text-danger">
        {props.title} ({props.count})
      </h2>
      <p className="text-sm">{props.help}</p>
      <ul className="mt-3 divide-y divide-line">{props.children}</ul>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">{children}</li>;
}
