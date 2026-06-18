import { RefObject, useEffect, useState } from "react";

// True while the element is in (or near) the viewport. Used to pause the
// expensive r3f render loop when a 3D scene is scrolled offscreen. Starts true
// so a scene that mounts in view renders immediately; the rootMargin resumes
// it slightly before it scrolls back in to avoid a blank pop-in.
export function useOnScreen(
  ref: RefObject<Element | null>,
  rootMargin = "200px",
): boolean {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, rootMargin]);
  return onScreen;
}
