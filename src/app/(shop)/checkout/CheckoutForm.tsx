"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { QtyStepper } from "@/components/QtyStepper";
import { VegMark } from "@/components/VegMark";
import { strings } from "@/content/strings";
import { api } from "@/lib/client/api";
import { type CartLine, useCart } from "@/lib/client/cart";
import { usePayment } from "@/lib/client/usePayment";
import { formatRupees } from "@/lib/money";

interface Props {
  types: ("dine_in" | "takeaway")[];
  tables: string[];
  requirePhone: boolean;
  notesEnabled: boolean;
  taxNote: string;
  maxQtyPerItem: number;
}

const NOTE_MAX = 200;
const PENDING_KEY = "pendingOrder:v1";

interface FreshCart {
  items: { menuItemId: string; name: string; pricePaise: number; isVeg: boolean; quantity: number }[];
  removed: { menuItemId: string }[];
  totalPaise: number;
}

/** Same as the server's check, so we can show the error before submitting. */
function validPhone(input: string): boolean {
  let d = input.replace(/[\s\-()]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d);
}

export function CheckoutForm({ types, tables, requirePhone, notesEnabled, taxNote, maxQtyPerItem }: Props) {
  const cart = useCart();
  const router = useRouter();
  const { pay, mockSheet } = usePayment();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [stage, setStage] = useState<"idle" | "placing" | "paying">("idle");

  // Remember contact details for this session only.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("contact:v1") ?? "{}") as {
        name?: string;
        phone?: string;
      };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (saved.name) setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
    } catch {
      /* ignore */
    }
  }, []);

  const orderType = cart.tableFixed ? "dine_in" : (cart.orderType ?? (types.length === 1 ? types[0]! : null));

  if (!cart.hydrated) {
    return (
      <main className="mx-auto max-w-xl space-y-4 px-4 py-6" aria-busy="true">
        <div className="skeleton h-8 w-40 rounded-card" />
        <div className="skeleton h-40 rounded-card" />
        <div className="skeleton h-56 rounded-card" />
      </main>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{strings.cart.yourOrder}</h1>
        <p className="mt-3 text-muted">{strings.cart.empty}</p>
        <Link
          href={cart.tableFixed && cart.table ? `/?t=${encodeURIComponent(cart.table)}` : "/"}
          className="mt-6 inline-flex h-12 items-center rounded-pill bg-primary px-6 font-semibold text-on-primary"
        >
          {strings.cart.browseMenu}
        </Link>
      </main>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = strings.checkout.nameRequired;
    if (phone.trim() ? !validPhone(phone) : requirePhone) e.phone = strings.checkout.phoneInvalid;
    if (!orderType) e.type = strings.checkout.orderType;
    if (orderType === "dine_in" && !cart.table) e.table = strings.checkout.tableRequired;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const applyFreshCart = (fresh: FreshCart) => {
    const lines: CartLine[] = fresh.items.map((i) => ({ ...i }));
    const removedNames = cart.lines
      .filter((l) => fresh.removed.some((r) => r.menuItemId === l.menuItemId))
      .map((l) => l.name);
    cart.replaceLines(lines);
    setMessage({
      tone: "error",
      text: [
        strings.checkout.cartChanged,
        removedNames.length ? strings.checkout.removedItems(removedNames.join(", ")) : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  };

  // Placing the same cart twice (double tap, retry after closing the popup) reuses
  // the order we already created instead of making a second one.
  const cartKey = JSON.stringify({
    lines: cart.lines.map((l) => [l.menuItemId, l.quantity]),
    orderType,
    table: cart.table,
    name: name.trim(),
    phone: phone.trim(),
    note: cart.note.trim(),
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (stage !== "idle") return;
    setMessage(null);
    if (!validate()) return;
    sessionStorage.setItem("contact:v1", JSON.stringify({ name: name.trim(), phone: phone.trim() }));

    let orderId: string | null = null;
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as {
        id: string;
        key: string;
      } | null;
      if (pending?.key === cartKey) orderId = pending.id;
    } catch {
      /* ignore */
    }

    if (!orderId) {
      setStage("placing");
      const res = await api<{ id: string; number: number; totalPaise: number; cart?: FreshCart }>(
        "/api/orders",
        {
          method: "POST",
          body: {
            type: orderType,
            table: orderType === "dine_in" ? (cart.table ?? undefined) : undefined,
            customerName: name,
            customerPhone: phone.trim() || undefined,
            note: notesEnabled && cart.note.trim() ? cart.note : undefined,
            items: cart.lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
            expectedTotalPaise: cart.totalPaise,
          },
        },
      );
      if (!res.ok) {
        setStage("idle");
        if (res.data.code === "cart_changed" && res.data.cart) return applyFreshCart(res.data.cart);
        if (res.data.code === "restaurant_closed")
          return setMessage({ tone: "error", text: strings.checkout.closed });
        if (res.data.code === "invalid_phone") return setErrors({ phone: strings.checkout.phoneInvalid });
        if (res.networkError) return setMessage({ tone: "error", text: strings.checkout.networkError });
        if (res.status === 429) return setMessage({ tone: "error", text: strings.checkout.rateLimited });
        return setMessage({ tone: "error", text: res.data.error ?? strings.checkout.genericError });
      }
      orderId = res.data.id;
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ id: orderId, key: cartKey }));
    }

    setStage("paying");
    const outcome = await pay(orderId);
    switch (outcome.kind) {
      case "paid":
      case "processing":
        sessionStorage.removeItem(PENDING_KEY);
        cart.clear();
        router.replace(`/order/${orderId}`);
        return;
      case "expired":
        sessionStorage.removeItem(PENDING_KEY);
        setStage("idle");
        return setMessage({ tone: "error", text: strings.payment.expired });
      case "failed":
        setStage("idle");
        return setMessage({ tone: "error", text: outcome.message });
      case "dismissed":
        setStage("idle");
        return setMessage({ tone: "info", text: strings.payment.dismissed });
      case "error":
        setStage("idle");
        return setMessage({ tone: "error", text: outcome.message });
    }
  };

  const busyLabel =
    stage === "placing" ? strings.checkout.placing : stage === "paying" ? strings.checkout.opening : null;
  const field = "mt-1 h-12 w-full rounded-card border border-line bg-surface px-3 text-base";

  return (
    <main className="mx-auto max-w-xl px-4 pt-4 pb-8">
      <div className="flex items-center gap-2">
        <Link
          href={cart.tableFixed && cart.table ? `/?t=${encodeURIComponent(cart.table)}` : "/"}
          className="-ml-2 inline-flex h-11 items-center px-2 font-semibold text-primary"
        >
          ← {strings.common.back}
        </Link>
      </div>
      <h1 className="mt-2 text-2xl font-bold">{strings.checkout.title}</h1>

      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-6">
        <section aria-labelledby="summary-h" className="rounded-card border border-line bg-surface p-4">
          <h2 id="summary-h" className="text-lg font-bold">
            {strings.checkout.summary}
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {cart.lines.map((l) => (
              <li key={l.menuItemId} className="flex items-center gap-3 py-3">
                <VegMark isVeg={l.isVeg} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{l.name}</p>
                  <p className="text-sm text-muted">{formatRupees(l.pricePaise * l.quantity)}</p>
                </div>
                <QtyStepper
                  compact
                  name={l.name}
                  quantity={l.quantity}
                  max={maxQtyPerItem}
                  onChange={(q) => cart.setQuantity(l, q)}
                />
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-line pt-3 text-lg font-bold">
            <span>{strings.checkout.total}</span>
            <span>{formatRupees(cart.totalPaise)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{taxNote}</p>
        </section>

        <fieldset className="space-y-4">
          {cart.tableFixed && cart.table ? (
            <p className="rounded-card bg-tint px-3 py-3 font-semibold">
              {strings.checkout.tableFixed(cart.table)}
            </p>
          ) : (
            <>
              {types.length > 1 && (
                <div>
                  <legend className="font-semibold">{strings.checkout.orderType}</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup">
                    {types.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={orderType === t}
                        onClick={() => cart.setOrderType(t)}
                        className={`h-12 rounded-card border-2 font-semibold ${
                          orderType === t ? "border-primary bg-tint" : "border-line bg-surface"
                        }`}
                      >
                        {t === "dine_in" ? strings.common.dineIn : strings.common.takeaway}
                      </button>
                    ))}
                  </div>
                  {errors.type && <p className="mt-1 text-sm text-danger">{errors.type}</p>}
                </div>
              )}
              {orderType === "dine_in" && (
                <label className="block">
                  <span className="font-semibold">{strings.checkout.chooseTable}</span>
                  <select
                    value={cart.table ?? ""}
                    onChange={(e) => cart.setTable(e.target.value || null)}
                    className={field}
                    aria-invalid={Boolean(errors.table)}
                  >
                    <option value="">{strings.checkout.chooseTablePlaceholder}</option>
                    {tables.map((t) => (
                      <option key={t} value={t}>
                        {strings.common.table(t)}
                      </option>
                    ))}
                  </select>
                  {errors.table && <span className="mt-1 block text-sm text-danger">{errors.table}</span>}
                </label>
              )}
            </>
          )}

          <label className="block">
            <span className="font-semibold">{strings.checkout.name}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoComplete="name"
              placeholder={strings.checkout.namePlaceholder}
              className={field}
              aria-invalid={Boolean(errors.name)}
              required
            />
            {errors.name && <span className="mt-1 block text-sm text-danger">{errors.name}</span>}
          </label>

          <label className="block">
            <span className="font-semibold">
              {requirePhone ? strings.checkout.phone : strings.checkout.phoneOptional}
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              maxLength={16}
              placeholder="98765 43210"
              className={field}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby="phone-hint"
              required={requirePhone}
            />
            <span id="phone-hint" className="mt-1 block text-xs text-muted">
              {strings.checkout.phoneHint}
            </span>
            {errors.phone && <span className="mt-1 block text-sm text-danger">{errors.phone}</span>}
          </label>

          {notesEnabled && (
            <label className="block">
              <span className="font-semibold">{strings.checkout.note}</span>
              <textarea
                value={cart.note}
                onChange={(e) => cart.setNote(e.target.value.slice(0, NOTE_MAX))}
                maxLength={NOTE_MAX}
                rows={3}
                placeholder={strings.checkout.notePlaceholder}
                className="mt-1 w-full rounded-card border border-line bg-surface p-3 text-base"
              />
              <span className="block text-right text-xs text-muted">
                {strings.checkout.noteCount(cart.note.length, NOTE_MAX)}
              </span>
            </label>
          )}
        </fieldset>

        {message && (
          <p
            role="alert"
            className={`rounded-card px-3 py-3 text-sm font-semibold ${
              message.tone === "error" ? "bg-danger text-surface" : "bg-tint"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="pb-safe sticky bottom-0 -mx-4 border-t border-line bg-bg px-4 pt-3">
          <button
            type="submit"
            disabled={stage !== "idle"}
            className="h-14 w-full rounded-pill bg-primary text-lg font-bold text-on-primary shadow-lg disabled:opacity-60"
          >
            {busyLabel ?? strings.checkout.pay(formatRupees(cart.totalPaise))}
          </button>
          <p className="mt-2 text-center text-xs text-muted">{strings.checkout.secure}</p>
        </div>
      </form>
      {mockSheet}
    </main>
  );
}
