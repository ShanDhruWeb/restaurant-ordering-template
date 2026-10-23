"use client";

// Opens Razorpay Checkout (or the mock sheet in mock mode) for an existing order
// and reports what happened. Every retry uses the SAME order: the server reuses
// its Razorpay order, so whichever attempt finally succeeds is matched.
//
// The checkout handler may never fire (UPI app switch, closed tab). That is fine:
// the tracking page asks the server, which asks Razorpay (reconcile).
import { useCallback, useRef, useState } from "react";
import { strings } from "@/content/strings";
import { api } from "./api";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type ReadyResponse = {
  status: "ready";
  mode: "mock" | "test" | "live";
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: "INR";
  name: string;
  description: string;
  prefill: { name: string; contact: string };
};
type PayResponse = ReadyResponse | { status: "already_paid" };

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export type PaymentOutcome =
  | { kind: "paid" } // verified by our server
  | { kind: "processing" } // paid, server is still confirming: go to tracking
  | { kind: "failed"; message: string }
  | { kind: "dismissed" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (r: { error?: { description?: string } }) => void): void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let scriptPromise: Promise<boolean> | null = null;

/** Loads Razorpay's script only when the customer actually pays. */
function loadCheckoutScript(): Promise<boolean> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve(true);
  scriptPromise ??= new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve(Boolean(window.Razorpay));
    s.onerror = () => {
      scriptPromise = null; // allow a retry
      resolve(false);
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

type MockChoice = "success" | "success_webhook_only" | "success_silent" | "fail" | "close";

export function usePayment() {
  const [busy, setBusy] = useState(false);
  const [mock, setMock] = useState<{ resolve: (c: MockChoice) => void } | null>(null);
  const inFlight = useRef(false);

  const verify = async (orderId: string, r: RazorpaySuccess): Promise<PaymentOutcome> => {
    const res = await api<{ status: "paid" | "pending" }>(`/api/orders/${orderId}/verify`, {
      method: "POST",
      body: r,
    });
    return res.ok && res.data.status === "paid" ? { kind: "paid" } : { kind: "processing" };
  };

  const runRazorpay = (orderId: string, p: ReadyResponse) =>
    new Promise<PaymentOutcome>((resolve) => {
      let settled = false;
      let lastFailure: string | null = null;
      const done = (o: PaymentOutcome) => {
        if (!settled) {
          settled = true;
          resolve(o);
        }
      };
      const primary = getComputedStyle(document.documentElement).getPropertyValue("--t-primary").trim();
      const rzp = new window.Razorpay!({
        key: p.keyId,
        order_id: p.razorpayOrderId,
        amount: p.amountPaise,
        currency: p.currency,
        name: p.name,
        description: p.description,
        prefill: p.prefill,
        notes: { order_id: orderId },
        theme: primary ? { color: primary } : undefined,
        handler: (response: RazorpaySuccess) => {
          settled = true;
          void verify(orderId, response).then(resolve);
        },
        modal: {
          // Fires when the customer closes the popup (also after a failure).
          ondismiss: () =>
            done(lastFailure ? { kind: "failed", message: lastFailure } : { kind: "dismissed" }),
          confirm_close: true,
        },
      });
      rzp.on("payment.failed", (r) => {
        // Razorpay lets the customer retry inside the popup; remember the reason
        // and report it if they close the popup.
        lastFailure = r.error?.description || strings.payment.failed;
      });
      rzp.open();
    });

  const runMock = async (orderId: string, p: ReadyResponse): Promise<PaymentOutcome> => {
    const choice = await new Promise<MockChoice>((resolve) => setMock({ resolve }));
    setMock(null);
    if (choice === "close") return { kind: "dismissed" };
    const res = await api<{
      status: "success" | "failed" | "no_callback";
      response?: RazorpaySuccess;
      error?: { description: string };
    }>("/api/dev/mock-pay", {
      method: "POST",
      body: { razorpayOrderId: p.razorpayOrderId, outcome: choice },
    });
    if (!res.ok) return { kind: "error", message: strings.checkout.genericError };
    if (res.data.status === "failed") return { kind: "failed", message: strings.payment.failed };
    if (res.data.status === "no_callback" || !res.data.response) return { kind: "processing" };
    return verify(orderId, res.data.response);
  };

  const pay = useCallback(async (orderId: string): Promise<PaymentOutcome> => {
    if (inFlight.current) return { kind: "dismissed" }; // ignore double taps
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await api<PayResponse>(`/api/orders/${orderId}/pay`, { method: "POST", body: {} });
      if (!res.ok) {
        if (res.data.code === "order_expired") return { kind: "expired" };
        if (res.networkError) return { kind: "error", message: strings.checkout.networkError };
        if (res.status === 429) return { kind: "error", message: strings.checkout.rateLimited };
        return { kind: "error", message: res.data.error ?? strings.checkout.genericError };
      }
      if (res.data.status === "already_paid") return { kind: "paid" };
      const ready = res.data;
      if (ready.mode === "mock") return await runMock(orderId, ready);
      if (!(await loadCheckoutScript())) return { kind: "error", message: strings.payment.scriptError };
      return await runRazorpay(orderId, ready);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers are stable closures over setters
  }, []);

  const mockSheet = mock ? <MockSheet onChoose={mock.resolve} /> : null;
  return { pay, busy, mockSheet };
}

function MockSheet({ onChoose }: { onChoose: (c: MockChoice) => void }) {
  const options: [MockChoice, string][] = [
    ["success", strings.payment.mockSuccess],
    ["success_webhook_only", strings.payment.mockWebhookOnly],
    ["success_silent", strings.payment.mockSilent],
    ["fail", strings.payment.mockFail],
    ["close", strings.payment.mockClose],
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay sm:items-center"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mock-title"
        className="pb-safe w-full max-w-md rounded-t-card bg-surface p-5 shadow-xl sm:rounded-card"
      >
        <h2 id="mock-title" className="text-lg font-bold">
          {strings.payment.mockTitle}
        </h2>
        <p className="mt-1 text-sm text-muted">{strings.payment.mockBody}</p>
        <div className="mt-4 grid gap-2">
          {options.map(([value, label], i) => (
            <button
              key={value}
              type="button"
              autoFocus={i === 0}
              onClick={() => onChoose(value)}
              className={`min-h-12 rounded-card px-4 py-2 text-left font-semibold ${
                i === 0 ? "bg-primary text-on-primary" : "border border-line bg-surface"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
