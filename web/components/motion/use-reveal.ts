"use client";

import { useEffect, useState } from "react";

/**
 * Returns `true` for a short window after mount, then `false`.
 *
 * The four data-viz components remount on route navigation, so this lets each
 * one stagger its items in on mount (and replay on every navigation) while
 * NOT re-triggering the entrance animation on later in-place prop changes
 * (filter toggles, scope switch) — those only re-render the same instance, by
 * which point the window has closed and no animation classes are applied.
 *
 * `durationMs` should cover the longest item's (stagger delay + animation).
 */
export function useReveal(durationMs: number): boolean {
  const [revealing, setRevealing] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setRevealing(false), durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);
  return revealing;
}
