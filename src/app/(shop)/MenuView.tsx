"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ItemImage } from "@/components/ItemImage";
import { QtyStepper } from "@/components/QtyStepper";
import { VegMark } from "@/components/VegMark";
import { strings } from "@/content/strings";
import { api } from "@/lib/client/api";
import { useCart } from "@/lib/client/cart";
import { usePolling } from "@/lib/client/usePolling";
import { formatRupees } from "@/lib/money";
import type { PublicMenu, PublicMenuItem } from "@/server/menu";

const MENU_REFRESH_MS = 15_000;

interface Props {
  initialMenu: PublicMenu;
  tableFromQr: string | null;
  restaurant: {
    name: string;
    tagline: string;
    logo: string;
    phone: string;
    area: string;
    open: string;
    close: string;
  };
  limits: { maxQtyPerItem: number; maxItemsPerOrder: number };
  taxNote: string;
}

export function MenuView({ initialMenu, tableFromQr, restaurant, limits, taxNote }: Props) {
  const cart = useCart();
  const [menu, setMenu] = useState(initialMenu);
  const [query, setQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  // A table QR (/?t=5) fixes the order to that table for this browser session.
  const { hydrated, setTable } = cart;
  useEffect(() => {
    if (hydrated && tableFromQr) setTable(tableFromQr, true);
  }, [hydrated, tableFromQr, setTable]);

  // Keep the menu fresh so admin changes (sold out, prices) show within 15 seconds.
  const refresh = useCallback(async () => {
    const res = await api<PublicMenu>("/api/menu");
    if (res.ok) setMenu(res.data);
    return res.ok;
  }, []);
  usePolling(refresh, MENU_REFRESH_MS);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return menu.categories
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) =>
            (!vegOnly || i.isVeg) &&
            (!q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [menu, deferredQuery, vegOnly]);

  // Stable list (same array while the category ids/names are unchanged) so the
  // scroll observer is not rebuilt on every render.
  const navKey = filtered.map((c) => `${c.id}:${c.name}`).join("|");
  const navCategories = useMemo(
    () => filtered.map((c) => ({ id: c.id, name: c.name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content, not identity
    [navKey],
  );

  const changeQty = (item: PublicMenuItem, quantity: number) => {
    setNotice(null);
    if (quantity > limits.maxQtyPerItem) return setNotice(strings.cart.maxQty(limits.maxQtyPerItem));
    if (cart.quantityOf(item.id) === 0 && quantity > 0 && cart.lines.length >= limits.maxItemsPerOrder) {
      return setNotice(strings.cart.maxItems(limits.maxItemsPerOrder));
    }
    cart.setQuantity(
      { menuItemId: item.id, name: item.name, pricePaise: item.pricePaise, isVeg: item.isVeg },
      quantity,
    );
  };

  const { ordering } = menu;
  const closedMessage = ordering.accepting
    ? null
    : ordering.reason === "outside_hours"
      ? strings.menu.closedOutsideHours(restaurant.open, restaurant.close)
      : strings.menu.closedSwitchedOff;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="pt-safe px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny logo, SVG friendly */}
          <img src={restaurant.logo} alt="" width={48} height={48} className="h-12 w-12 rounded-card" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl leading-tight font-bold">{restaurant.name}</h1>
            <p className="truncate text-sm text-muted">{restaurant.tagline}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          {strings.menu.hours(restaurant.open, restaurant.close)} · {restaurant.area}
        </p>
        {cart.tableFixed && cart.table && (
          <p className="mt-3 inline-block rounded-pill bg-ink px-3 py-1 text-sm font-semibold text-bg">
            {strings.common.table(cart.table)}
          </p>
        )}
        {ordering.bannerMessage && (
          <p role="status" className="mt-3 rounded-card border border-line bg-tint px-3 py-2 text-sm">
            {ordering.bannerMessage}
          </p>
        )}
        {closedMessage && (
          <p
            role="alert"
            className="mt-3 rounded-card bg-danger px-3 py-2 text-sm font-semibold text-surface"
          >
            {closedMessage}
          </p>
        )}
      </header>

      <CategoryNav categories={navCategories}>
        <div className="flex gap-2 px-4 pb-2">
          <label className="relative flex-1">
            <span className="sr-only">{strings.menu.searchLabel}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={strings.menu.searchPlaceholder}
              maxLength={60}
              enterKeyHint="search"
              className="h-11 w-full rounded-pill border border-line bg-surface px-4 text-base placeholder:text-muted"
            />
          </label>
          <button
            type="button"
            aria-pressed={vegOnly}
            onClick={() => setVegOnly((v) => !v)}
            className={`flex h-11 items-center gap-2 rounded-pill border px-3 text-sm font-semibold ${
              vegOnly ? "border-success bg-success text-surface" : "border-line bg-surface"
            }`}
          >
            <VegMark isVeg />
            {strings.menu.vegOnly}
          </button>
        </div>
      </CategoryNav>

      {notice && (
        <p role="alert" className="mx-4 mt-2 rounded-card bg-tint px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      <main className="px-4">
        {menu.categories.length === 0 ? (
          <p className="py-16 text-center text-muted">{strings.menu.empty}</p>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted">
            <p>{strings.menu.noResults(deferredQuery || strings.menu.vegOnly)}</p>
            <button
              type="button"
              className="mt-3 h-11 px-4 font-semibold text-primary underline"
              onClick={() => {
                setQuery("");
                setVegOnly(false);
              }}
            >
              {strings.menu.clearSearch}
            </button>
          </div>
        ) : (
          filtered.map((cat) => (
            <section
              key={cat.id}
              id={`cat-${cat.id}`}
              aria-labelledby={`h-${cat.id}`}
              className="scroll-mt-32 pt-6"
            >
              <h2 id={`h-${cat.id}`} className="mb-2 text-xl font-bold">
                {cat.name}
              </h2>
              <ul className="divide-y divide-line">
                {cat.items.map((item) => (
                  <MenuRow
                    key={item.id}
                    item={item}
                    quantity={cart.quantityOf(item.id)}
                    max={limits.maxQtyPerItem}
                    canOrder={ordering.accepting}
                    onChange={(q) => changeQty(item, q)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
        <p className="mt-8 text-center text-xs text-muted">{taxNote}</p>
      </main>

      {cart.hydrated && cart.count > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 px-3 pt-3">
          <Link
            href="/checkout"
            className="mx-auto flex h-14 max-w-3xl items-center justify-between rounded-pill bg-primary px-5 font-semibold text-on-primary shadow-lg"
          >
            <span>
              {strings.cart.items(cart.count)} · {formatRupees(cart.totalPaise)}
            </span>
            <span>{strings.cart.checkout} →</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function MenuRow(props: {
  item: PublicMenuItem;
  quantity: number;
  max: number;
  canOrder: boolean;
  onChange: (q: number) => void;
}) {
  const { item, quantity, max, canOrder, onChange } = props;
  const unavailable = !item.isAvailable;
  return (
    <li className={`flex gap-3 py-4 ${unavailable ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <VegMark isVeg={item.isVeg} />
          <h3 className="font-body text-base leading-snug font-semibold">{item.name}</h3>
        </div>
        <p className="mt-1 font-semibold">{formatRupees(item.pricePaise)}</p>
        {item.description && <p className="mt-1 line-clamp-3 text-sm text-muted">{item.description}</p>}
      </div>
      <div className="flex w-28 shrink-0 flex-col items-center">
        <ItemImage src={item.imagePath} name={item.name} className="h-24 w-28 rounded-card" />
        <div className="-mt-5">
          {unavailable ? (
            <span className="inline-flex h-11 items-center rounded-pill border border-line bg-surface px-3 text-sm font-semibold text-muted">
              {strings.menu.soldOut}
            </span>
          ) : quantity > 0 ? (
            <QtyStepper name={item.name} quantity={quantity} max={max} onChange={onChange} />
          ) : (
            <button
              type="button"
              disabled={!canOrder}
              onClick={() => onChange(1)}
              aria-label={strings.menu.addItem(item.name)}
              className="h-11 min-w-24 rounded-pill border-2 border-primary bg-surface px-5 font-bold text-primary shadow-sm active:scale-95 disabled:opacity-50"
            >
              {strings.menu.add}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/** Sticky search bar plus category pills that highlight the section on screen. */
function CategoryNav({
  categories,
  children,
}: {
  categories: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<string | null>(categories[0]?.id ?? null);
  const pillRefs = useRef(new Map<string, HTMLAnchorElement>());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace("cat-", ""));
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    for (const c of categories) {
      const el = document.getElementById(`cat-${c.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    if (active) pillRefs.current.get(active)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <div className="sticky top-0 z-20 border-b border-line bg-bg/95 pt-2 backdrop-blur">
      {children}
      {categories.length > 1 && (
        <nav
          aria-label={strings.menu.categories}
          className="overflow-x-auto px-4 pb-2 [scrollbar-width:none]"
        >
          <ul className="flex gap-2">
            {categories.map((c) => (
              <li key={c.id}>
                <a
                  ref={(el) => {
                    if (el) pillRefs.current.set(c.id, el);
                  }}
                  href={`#cat-${c.id}`}
                  aria-current={active === c.id ? "true" : undefined}
                  className={`inline-flex h-11 items-center rounded-pill px-4 text-sm font-semibold whitespace-nowrap ${
                    active === c.id ? "bg-ink text-bg" : "border border-line bg-surface"
                  }`}
                >
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
