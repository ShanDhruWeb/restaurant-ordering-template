"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LiveStatus } from "@/components/LiveStatus";
import { VegMark } from "@/components/VegMark";
import { strings } from "@/content/strings";
import { api } from "@/lib/client/api";
import { useCart } from "@/lib/client/cart";
import { usePayment } from "@/lib/client/usePayment";
import { usePolling } from "@/lib/client/usePolling";
import { formatRupees } from "@/lib/money";
import type { PublicOrder } from "@/server/orders/publicOrder";

const POLL_MS = 4000;
const STEPS = ["paid", "preparing", "ready", "completed"] as const;

export function OrderTracker({ initial }: { initial: PublicOrder }) {
  const [order, setOrder] = useState(initial);
  const [payMessage, setPayMessage] = useState<string | null>(null);
  const { pay, busy, mockSheet } = usePayment();
  const cart = useCart();

  const done =
    order.status === "completed" ||
    order.status === "cancelled" ||
    (order.status === "expired" && order.paymentStatus !== "paid") ||
    order.refundStatus === "refunded";

  const refresh = useCallback(async () => {
    const res = await api<{ order: PublicOrder }>(`/api/orders/${initial.id}`);
    if (res.ok) setOrder(res.data.order);
    return res.ok;
  }, [initial.id]);
  const poll = usePolling(refresh, POLL_MS, !done);

  // Once paid, this order's cart is done: clear it if it is still around
  // (e.g. the customer paid in a UPI app and came back here).
  const { clear, hydrated } = cart;
  useEffect(() => {
    if (!hydrated || order.paymentStatus !== "paid") return;
    try {
      const pending = JSON.parse(sessionStorage.getItem("pendingOrder:v1") ?? "null") as {
        id: string;
      } | null;
      if (pending?.id === order.id) {
        sessionStorage.removeItem("pendingOrder:v1");
        clear();
      }
    } catch {
      /* ignore */
    }
  }, [hydrated, order.paymentStatus, order.id, clear]);

  const retryPayment = async () => {
    setPayMessage(null);
    const outcome = await pay(order.id);
    if (outcome.kind === "failed" || outcome.kind === "error") setPayMessage(outcome.message);
    else if (outcome.kind === "dismissed") setPayMessage(strings.payment.dismissed);
    else if (outcome.kind === "expired") setPayMessage(strings.payment.expired);
    await poll.refresh();
  };

  const unpaid = order.paymentStatus !== "paid";
  const canPay = order.status === "pending_payment" && unpaid;
  const t = strings.tracking;

  return (
    <main className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {order.table ? strings.common.table(order.table) : strings.common.takeaway}
            {order.customerFirstName ? ` · ${order.customerFirstName}` : ""}
          </p>
          <h1 className="text-3xl font-bold">{t.title(order.number)}</h1>
        </div>
        {!done && <LiveStatus live={poll.live} lastUpdated={poll.lastUpdated} />}
      </div>

      <StatusPanel order={order} />

      {canPay && (
        <div className="mt-4">
          <button
            type="button"
            onClick={retryPayment}
            disabled={busy}
            className="h-14 w-full rounded-pill bg-primary text-lg font-bold text-on-primary disabled:opacity-60"
          >
            {busy ? strings.checkout.opening : strings.payment.payNow(formatRupees(order.totalPaise))}
          </button>
          {payMessage && (
            <p role="alert" className="mt-2 rounded-card bg-tint px-3 py-2 text-sm font-semibold">
              {payMessage}
            </p>
          )}
        </div>
      )}

      <section aria-labelledby="items-h" className="mt-6 rounded-card border border-line bg-surface p-4">
        <h2 id="items-h" className="text-lg font-bold">
          {t.items}
        </h2>
        <ul className="mt-2 divide-y divide-line">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex items-center gap-3 py-2">
              <VegMark isVeg={i.isVeg} />
              <span className="flex-1">
                {i.quantity} × {i.name}
              </span>
              <span className="tabular-nums">{formatRupees(i.pricePaise * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-line pt-3 font-bold">
          <span>{unpaid ? t.totalDue : t.total}</span>
          <span>{formatRupees(order.totalPaise)}</span>
        </div>
      </section>

      <p className="mt-4 text-center text-sm text-muted">{done ? t.saveLink : t.keepOpen}</p>
      <div className="mt-4 text-center">
        <Link
          href={order.table ? `/?t=${encodeURIComponent(order.table)}` : "/"}
          className="inline-flex h-12 items-center rounded-pill border border-line bg-surface px-6 font-semibold"
        >
          {t.orderAgain}
        </Link>
      </div>
      {mockSheet}
    </main>
  );
}

function StatusPanel({ order }: { order: PublicOrder }) {
  const t = strings.tracking;
  const refundLine =
    order.refundStatus === "needed"
      ? t.refundNeeded
      : order.refundStatus === "partial"
        ? t.refundPartial
        : order.refundStatus === "refunded"
          ? t.refunded
          : null;

  // Problem states get a single clear message instead of the step tracker.
  if (order.status === "cancelled") {
    return <Notice tone="danger" title={t.cancelledTitle} body={t.cancelledBody} extra={refundLine} />;
  }
  if (order.status === "expired") {
    return order.paymentStatus === "paid" ? (
      <Notice tone="info" title={t.expiredTitle} body={t.expiredPaidBody} extra={refundLine} />
    ) : (
      <Notice tone="danger" title={t.expiredTitle} body={t.expiredBody} />
    );
  }
  if (order.status === "pending_payment") {
    return order.paymentStatus === "failed" ? (
      <Notice tone="danger" title={t.failedTitle} body={t.failedBody} />
    ) : (
      <Notice tone="info" title={t.pendingTitle} body={t.pendingBody} spinner />
    );
  }

  const current = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const body =
    order.status === "paid"
      ? t.paidBody
      : order.status === "preparing"
        ? t.preparingBody
        : order.status === "ready"
          ? order.type === "dine_in"
            ? t.readyDineIn
            : t.readyTakeaway
          : t.completedBody;

  return (
    <div className="mt-5">
      <ol aria-label={t.stepsLabel} className="grid grid-cols-4 gap-1">
        {STEPS.map((s, i) => {
          const reached = i <= current;
          return (
            <li key={s} aria-current={i === current ? "step" : undefined} className="text-center">
              <div className={`h-2 rounded-full ${reached ? "bg-primary" : "bg-line"}`} />
              <span className={`mt-2 block text-xs font-semibold ${reached ? "text-ink" : "text-muted"}`}>
                {t.steps[s]}
              </span>
            </li>
          );
        })}
      </ol>
      <p
        role="status"
        aria-live="polite"
        className="mt-4 rounded-card bg-tint px-4 py-4 text-lg font-semibold"
      >
        {body}
      </p>
      {refundLine && <p className="mt-2 text-sm">{refundLine}</p>}
    </div>
  );
}

function Notice(props: {
  tone: "info" | "danger";
  title: string;
  body: string;
  extra?: string | null;
  spinner?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-5 rounded-card px-4 py-4 ${props.tone === "danger" ? "border-2 border-danger bg-surface" : "bg-tint"}`}
    >
      <p
        className={`flex items-center gap-2 text-lg font-bold ${props.tone === "danger" ? "text-danger" : ""}`}
      >
        {props.spinner && (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
          />
        )}
        {props.title}
      </p>
      <p className="mt-1">{props.body}</p>
      {props.extra && <p className="mt-2 font-semibold">{props.extra}</p>}
    </div>
  );
}
