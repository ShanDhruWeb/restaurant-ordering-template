"use client";

// The cart lives in sessionStorage, so a refresh does not lose it, but it does
// not follow the customer to another tab or device. Prices here are only for
// display; the server always re-prices from the database.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface CartLine {
  menuItemId: string;
  name: string;
  pricePaise: number;
  isVeg: boolean;
  quantity: number;
}

export interface CartState {
  lines: CartLine[];
  note: string;
  orderType: "dine_in" | "takeaway" | null;
  table: string | null;
  /** True when the table came from a QR code (/?t=5) and cannot be changed. */
  tableFixed: boolean;
}

const EMPTY: CartState = { lines: [], note: "", orderType: null, table: null, tableFixed: false };
const KEY = "cart:v1";

interface CartApi extends CartState {
  hydrated: boolean;
  count: number;
  totalPaise: number;
  quantityOf: (id: string) => number;
  setQuantity: (item: Omit<CartLine, "quantity">, quantity: number) => void;
  replaceLines: (lines: CartLine[]) => void;
  setNote: (note: string) => void;
  setOrderType: (t: "dine_in" | "takeaway") => void;
  setTable: (label: string | null, fixed?: boolean) => void;
  clear: () => void;
}

const CartContext = createContext<CartApi | null>(null);

function load(): CartState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    return {
      ...EMPTY,
      ...parsed,
      lines: Array.isArray(parsed.lines)
        ? parsed.lines.filter(
            (l) => l && typeof l.menuItemId === "string" && Number.isInteger(l.quantity) && l.quantity > 0,
          )
        : [],
    };
  } catch {
    return EMPTY;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Reading sessionStorage must happen after the first render (no SSR access).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
    setState(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode or full storage: cart still works for this page */
    }
  }, [state, hydrated]);

  const setQuantity = useCallback((item: Omit<CartLine, "quantity">, quantity: number) => {
    setState((s) => {
      const others = s.lines.filter((l) => l.menuItemId !== item.menuItemId);
      if (quantity <= 0) return { ...s, lines: others };
      const existing = s.lines.find((l) => l.menuItemId === item.menuItemId);
      const line = { ...item, quantity };
      // Keep the original position of the line in the cart.
      return {
        ...s,
        lines: existing
          ? s.lines.map((l) => (l.menuItemId === item.menuItemId ? line : l))
          : [...s.lines, line],
      };
    });
  }, []);

  // Setters never change identity, so components can safely list them as effect
  // dependencies. Each returns the SAME state object when nothing changes, so
  // React skips the re-render.
  const setters = useMemo(
    () => ({
      replaceLines: (lines: CartLine[]) => setState((s) => ({ ...s, lines })),
      setNote: (note: string) => setState((s) => (s.note === note ? s : { ...s, note })),
      setOrderType: (orderType: "dine_in" | "takeaway") =>
        setState((s) => (s.orderType === orderType ? s : { ...s, orderType })),
      setTable: (table: string | null, fixed = false) =>
        setState((s) => {
          const orderType = table && fixed ? "dine_in" : s.orderType;
          if (s.table === table && s.tableFixed === fixed && s.orderType === orderType) return s;
          return { ...s, table, tableFixed: fixed, orderType };
        }),
      clear: () =>
        setState((s) => ({
          ...EMPTY,
          table: s.tableFixed ? s.table : null,
          tableFixed: s.tableFixed,
          orderType: s.tableFixed ? "dine_in" : null,
        })),
    }),
    [],
  );

  const api = useMemo<CartApi>(() => {
    const count = state.lines.reduce((n, l) => n + l.quantity, 0);
    const totalPaise = state.lines.reduce((n, l) => n + l.pricePaise * l.quantity, 0);
    return {
      ...state,
      ...setters,
      hydrated,
      count,
      totalPaise,
      quantityOf: (id) => state.lines.find((l) => l.menuItemId === id)?.quantity ?? 0,
      setQuantity,
    };
  }, [state, hydrated, setQuantity, setters]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
