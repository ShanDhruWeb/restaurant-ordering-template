"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminStrings } from "@/content/adminStrings";
import { adminApi } from "@/lib/client/adminApi";

const t = adminStrings.payments;

export function CheckNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await adminApi("/api/admin/sweep", { method: "POST", body: {} });
        setBusy(false);
        router.refresh();
      }}
      className="h-12 rounded-card bg-primary px-5 font-bold text-on-primary disabled:opacity-60"
    >
      {busy ? t.checking : t.checkNow}
    </button>
  );
}

/** For a late payment: cook it after all, or flag it for a refund in Razorpay. */
export function LateOrderActions({ orderId, canAccept }: { orderId: string; canAccept: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (action: "accept_late" | "mark_refund_needed") => {
    setBusy(true);
    await adminApi(`/api/admin/orders/${orderId}`, { method: "POST", body: { action } });
    setBusy(false);
    router.refresh();
  };
  return (
    <span className="ml-auto flex gap-2">
      {canAccept && (
        <button
          type="button"
          disabled={busy}
          onClick={() => act("accept_late")}
          className="h-12 rounded-card bg-success px-3 font-bold text-surface"
        >
          {t.accept}
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => act("mark_refund_needed")}
        className="h-12 rounded-card border-2 border-danger px-3 font-bold text-danger"
      >
        {t.willRefund}
      </button>
    </span>
  );
}
