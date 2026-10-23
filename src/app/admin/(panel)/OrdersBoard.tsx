"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LiveStatus } from "@/components/LiveStatus";
import { VegMark } from "@/components/VegMark";
import { adminStrings } from "@/content/adminStrings";
import { strings } from "@/content/strings";
import { adminApi } from "@/lib/client/adminApi";
import { audioReady, keepScreenOn, startAlert, stopAlert, unlockAudio } from "@/lib/client/alerts";
import { usePolling } from "@/lib/client/usePolling";
import { formatRupees } from "@/lib/money";
import type { getBoard } from "@/server/admin/orders";

type Board = Awaited<ReturnType<typeof getBoard>>;
type BoardOrder = Board["orders"][number];
type Column = "paid" | "preparing" | "ready";

const POLL_MS = 4000;
const COLUMNS: Column[] = ["paid", "preparing", "ready"];
const t = adminStrings.board;

export function OrdersBoard({ initial }: { initial: Board }) {
  const [board, setBoard] = useState(initial);
  const [soundOn, setSoundOn] = useState(false);
  const [wakeLock, setWakeLock] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<BoardOrder | null>(null);
  const [printing, setPrinting] = useState<BoardOrder | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const res = await adminApi<Board>("/api/admin/board");
    if (res.ok) setBoard(res.data);
    return res.ok;
  }, []);
  const poll = usePolling(refresh, POLL_MS);

  // Minute ticker for "5 min ago" labels.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Repeating beep while any paid order has not been tapped yet.
  const unacknowledged = board.orders.filter((o) => o.status === "paid" && !o.acknowledgedAt);
  useEffect(() => {
    if (unacknowledged.length > 0 && soundOn) startAlert();
    else stopAlert();
  }, [unacknowledged.length, soundOn]);
  useEffect(() => () => stopAlert(), []);

  // Keep the tablet screen awake; the lock is dropped when the tab is hidden, so re-take it.
  const lockRef = useRef<{ release: () => void } | null>(null);
  useEffect(() => {
    const take = async () => {
      if (document.visibilityState !== "visible") return;
      lockRef.current?.release();
      lockRef.current = await keepScreenOn();
      setWakeLock(Boolean(lockRef.current));
    };
    void take();
    document.addEventListener("visibilitychange", take);
    return () => {
      document.removeEventListener("visibilitychange", take);
      lockRef.current?.release();
    };
  }, []);

  const enableSound = async () => {
    setSoundOn(await unlockAudio());
  };

  const act = async (order: BoardOrder, body: Record<string, unknown>) => {
    setNotice(null);
    const res = await adminApi(`/api/admin/orders/${order.id}`, { method: "POST", body });
    if (!res.ok) setNotice(res.status === 409 ? t.conflict : t.actionFailed);
    await poll.refresh();
  };

  const acknowledge = (order: BoardOrder) => {
    if (order.status !== "paid" || order.acknowledgedAt) return;
    // Optimistic: stop the beep for this order straight away.
    setBoard((b) => ({
      ...b,
      orders: b.orders.map((o) =>
        o.id === order.id ? { ...o, acknowledgedAt: new Date().toISOString() } : o,
      ),
    }));
    void act(order, { action: "acknowledge" });
  };

  const printTicket = (order: BoardOrder) => {
    acknowledge(order);
    setPrinting(order);
    // Let React render the ticket before opening the print dialog.
    setTimeout(() => window.print(), 50);
  };
  useEffect(() => {
    const after = () => setPrinting(null);
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, []);

  return (
    <div>
      <div className="no-print flex flex-wrap items-center gap-3">
        <p className="font-semibold">{t.today(board.today.count, formatRupees(board.today.totalPaise))}</p>
        <div className="ml-auto flex items-center gap-3">
          {!soundOn || !audioReady() ? (
            <button
              type="button"
              onClick={enableSound}
              className="h-12 rounded-card bg-accent px-4 font-bold text-ink shadow"
            >
              🔔 {t.enableSound}
            </button>
          ) : (
            <span className="text-sm font-semibold text-success">🔔 {t.soundOn}</span>
          )}
          {wakeLock && <span className="hidden text-xs text-muted sm:inline">{t.wakeLockOn}</span>}
          <LiveStatus live={poll.live} lastUpdated={poll.lastUpdated} />
        </div>
      </div>

      {!board.acceptingOrders && (
        <div
          role="alert"
          className="no-print mt-3 flex items-center gap-3 rounded-card bg-danger px-4 py-3 font-bold text-surface"
        >
          {t.closedBanner}
          <Link href="/admin/settings" className="ml-auto underline">
            {t.turnOn}
          </Link>
        </div>
      )}
      {board.reconcileProblems > 0 && (
        <div
          role="alert"
          className="no-print mt-3 flex items-center gap-3 rounded-card border-2 border-danger bg-surface px-4 py-3 font-bold text-danger"
        >
          ⚠ {t.reconcileProblems(board.reconcileProblems)}
          <Link href="/admin/payments" className="ml-auto underline">
            {t.viewPayments}
          </Link>
        </div>
      )}
      {unacknowledged.length > 0 && (
        <p
          role="alert"
          className="no-print mt-3 animate-pulse rounded-card bg-primary px-4 py-3 text-lg font-bold text-on-primary"
        >
          {t.newOrders(unacknowledged.length)}
        </p>
      )}
      {notice && (
        <p role="status" className="no-print mt-3 rounded-card bg-tint px-4 py-2 font-semibold">
          {notice}
        </p>
      )}

      <div className="no-print mt-4 grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const orders = board.orders.filter((o) => o.status === col);
          return (
            <section key={col} aria-labelledby={`col-${col}`} className="rounded-card bg-shade p-2">
              <h2 id={`col-${col}`} className="flex items-center justify-between px-2 py-2 text-xl font-bold">
                {t.columns[col]}
                <span className="rounded-pill bg-ink px-3 py-0.5 text-base text-bg">{orders.length}</span>
              </h2>
              {orders.length === 0 ? (
                <p className="px-2 py-8 text-center text-muted">{t.empty}</p>
              ) : (
                <ul className="space-y-3">
                  {orders.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      now={now}
                      onTap={() => acknowledge(o)}
                      onAdvance={() => act(o, { action: "advance", from: col })}
                      onCancel={() => setCancelling(o)}
                      onPrint={() => printTicket(o)}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {cancelling && (
        <CancelDialog
          order={cancelling}
          onClose={() => setCancelling(null)}
          onConfirm={async (reason) => {
            const o = cancelling;
            setCancelling(null);
            await act(o, { action: "cancel", reason: reason || undefined });
          }}
        />
      )}
      {printing && <KitchenTicket order={printing} />}
    </div>
  );
}

function OrderCard(props: {
  order: BoardOrder;
  now: number;
  onTap: () => void;
  onAdvance: () => void;
  onCancel: () => void;
  onPrint: () => void;
}) {
  const { order: o, now } = props;
  const isNew = o.status === "paid" && !o.acknowledgedAt;
  const minutes = o.paidAt ? Math.floor((now - new Date(o.paidAt).getTime()) / 60_000) : 0;
  return (
    <li>
      <article
        onClick={props.onTap}
        className={`rounded-card bg-surface p-3 shadow-sm ${isNew ? "ring-4 ring-primary" : "border border-line"}`}
      >
        <header className="flex items-start justify-between gap-2">
          <div>
            <p className="text-3xl font-bold">#{o.dailyNumber}</p>
            <p className="font-semibold">
              {o.tableLabel ? strings.common.table(o.tableLabel) : strings.common.takeaway} · {o.customerName}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className={minutes >= 20 ? "font-bold text-danger" : "text-muted"}>{t.minutesAgo(minutes)}</p>
            <p className="font-semibold">{formatRupees(o.totalPaise)}</p>
          </div>
        </header>
        {o.latePayment && (
          <p className="mt-2 rounded-card bg-accent px-2 py-1 text-sm font-bold text-ink">
            {adminStrings.late}
          </p>
        )}
        <ul className="mt-2 space-y-1 text-lg">
          {o.items.map((i, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <VegMark isVeg={i.isVeg} />
              <span className="font-bold">{i.quantity} ×</span> {i.nameSnapshot}
            </li>
          ))}
        </ul>
        {o.note && (
          <p className="mt-2 rounded-card bg-tint px-2 py-1 whitespace-pre-line">
            <span className="font-bold">{t.note}: </span>
            {o.note}
          </p>
        )}
        {o.customerPhone && (
          <p className="mt-1 text-sm text-muted">
            {t.phone}:{" "}
            <a href={`tel:+91${o.customerPhone}`} className="underline" onClick={(e) => e.stopPropagation()}>
              {o.customerPhone}
            </a>
          </p>
        )}
        <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={props.onAdvance}
            className="h-14 rounded-card bg-primary text-lg font-bold text-on-primary active:scale-[0.98]"
          >
            {t.advance[o.status as Column]}
          </button>
          <button
            type="button"
            onClick={props.onPrint}
            aria-label={t.print}
            title={t.print}
            className="h-14 w-14 rounded-card border border-line text-xl"
          >
            🖨
          </button>
          {o.status !== "ready" && (
            <button
              type="button"
              onClick={props.onCancel}
              aria-label={t.cancel}
              title={t.cancel}
              className="h-14 w-14 rounded-card border-2 border-danger text-xl font-bold text-danger"
            >
              ✕
            </button>
          )}
        </div>
      </article>
    </li>
  );
}

function CancelDialog(props: {
  order: BoardOrder;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={props.onClose}
      aria-labelledby="cancel-title"
      className="m-auto w-[min(28rem,92vw)] rounded-card bg-surface p-5 text-ink backdrop:bg-overlay"
    >
      <h2 id="cancel-title" className="text-2xl font-bold">
        {t.confirmCancel(props.order.dailyNumber)}
      </h2>
      <p className="mt-2 font-semibold text-danger">{t.confirmCancelPaid}</p>
      <label className="mt-4 block">
        <span className="font-semibold">{t.reasonLabel}</span>
        <input
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 h-12 w-full rounded-card border border-line bg-surface px-3"
        />
      </label>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          autoFocus
          onClick={props.onClose}
          className="h-14 rounded-card border border-line font-bold"
        >
          {t.keep}
        </button>
        <button
          type="button"
          onClick={() => props.onConfirm(reason)}
          className="h-14 rounded-card bg-danger font-bold text-surface"
        >
          {t.confirm}
        </button>
      </div>
    </dialog>
  );
}

/** Only visible when printing (see .print-only in globals.css). */
function KitchenTicket({ order: o }: { order: BoardOrder }) {
  return (
    <div className="print-only font-body text-black">
      <p className="text-3xl font-bold">{adminStrings.ticket.title(o.dailyNumber)}</p>
      <p className="text-xl font-bold">
        {o.tableLabel ? strings.common.table(o.tableLabel) : strings.common.takeaway}
      </p>
      <p>{o.customerName}</p>
      <p className="text-sm">
        {adminStrings.ticket.paidAt}: {o.paidAt ? new Date(o.paidAt).toLocaleString("en-IN") : ""}
      </p>
      <hr className="my-2 border-black" />
      <ul className="text-xl">
        {o.items.map((i, idx) => (
          <li key={idx}>
            <strong>{i.quantity} ×</strong> {i.nameSnapshot} {i.isVeg ? "" : "(NV)"}
          </li>
        ))}
      </ul>
      {o.note && (
        <>
          <hr className="my-2 border-black" />
          <p className="text-lg font-bold whitespace-pre-line">
            {t.note}: {o.note}
          </p>
        </>
      )}
    </div>
  );
}
