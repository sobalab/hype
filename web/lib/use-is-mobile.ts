import { useEffect, useLayoutEffect, useState } from "react";

// Run before paint on the client, fall back to useEffect on the server (where
// useLayoutEffect would warn and do nothing). This lets a viewport-derived
// value correct itself between hydration and the first paint, so mobile loads
// never flash the desktop layout. Initial state stays `false`, so it matches
// the server-rendered HTML and there is no hydration mismatch.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useIsomorphicLayoutEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** True at/below the given max width (px). Updates live on resize, and
 *  resolves the correct value before first paint (no desktop flash on mobile). */
export function useIsMobile(maxWidthPx = 639): boolean {
  return useMediaQuery(`(max-width: ${maxWidthPx}px)`);
}
