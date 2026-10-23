"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PollState {
  /** False after a failed fetch; true again after the next success. */
  live: boolean;
  lastUpdated: Date | null;
}

/**
 * Calls `tick` now and every `intervalMs` while the tab is visible. Pauses when
 * the tab is hidden (saves mobile data) and refreshes immediately on return.
 * `tick` returns true on success, false on failure (shown as "Offline, retrying").
 */
export function usePolling(tick: () => Promise<boolean>, intervalMs: number, enabled = true) {
  const [state, setState] = useState<PollState>({ live: true, lastUpdated: null });
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const run = useCallback(async () => {
    const ok = await tickRef.current();
    setState((s) => ({ live: ok, lastUpdated: ok ? new Date() : s.lastUpdated }));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => void run(), intervalMs);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void run();
        start();
      } else {
        clearInterval(timer);
      }
    };
    void run();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onVisibility);
    };
  }, [enabled, intervalMs, run]);

  return { ...state, refresh: run };
}
