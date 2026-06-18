"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

// App-wide liquid background. Mounted once in the root layout behind the
// content (z-0). A handful of large, heavily-blurred color blobs drift on a
// requestAnimationFrame loop and ease toward the cursor with a spring-feel
// lerp, so the whole surface feels alive without ever touching React state per
// frame (transforms are written straight to the DOM). It is part of the
// "playful" motion register, never the editorial one.
//
// Degrades gracefully:
//  - prefers-reduced-motion -> a single settled field, no rAF, no listeners.
//  - tab hidden -> rAF paused.
//  - coarse pointer (touch) -> no cursor blob, drift only.

type BlobDef = {
  /** Brand / story color at the blob core. */
  color: string;
  /** Diameter in vmax. */
  size: number;
  /** Base position as a viewport percentage (0-100). */
  bx: number;
  by: number;
  /** Drift amplitude in px. */
  ax: number;
  ay: number;
  /** Drift angular frequency (rad/s). */
  wx: number;
  wy: number;
  /** Phase offset so the blobs don't move in lockstep. */
  phase: number;
  /** How strongly cursor parallax tugs this blob (0-1). */
  pull: number;
  /** The single blob that rides directly under the pointer. */
  cursor?: boolean;
};

const BLOBS: BlobDef[] = [
  { color: "#1277de", size: 64, bx: 24, by: 30, ax: 46, ay: 38, wx: 0.09, wy: 0.12, phase: 0.0, pull: 0.45 },
  { color: "#66e7d8", size: 50, bx: 76, by: 38, ax: 52, ay: 44, wx: 0.08, wy: 0.10, phase: 1.7, pull: 0.32 },
  { color: "#f995b6", size: 54, bx: 52, by: 78, ax: 58, ay: 36, wx: 0.06, wy: 0.09, phase: 3.1, pull: 0.38 },
  { color: "#72b8ff", size: 30, bx: 50, by: 50, ax: 0, ay: 0, wx: 0, wy: 0, phase: 0.0, pull: 1, cursor: true },
];

function blobStyle(b: BlobDef): React.CSSProperties {
  return {
    width: `${b.size}vmax`,
    height: `${b.size}vmax`,
    background: `radial-gradient(circle at center, ${b.color} 0%, transparent 68%)`,
    // First-paint position before rAF takes over (avoids a 0,0 flash). vw/vh is
    // close enough to the px math the loop uses.
    transform: `translate3d(${b.bx}vw, ${b.by}vh, 0) translate(-50%, -50%)`,
  };
}

export function FluidBackground() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [bloom, setBloom] = useState<"pending" | "in">("pending");

  // Hide the cursor blob on touch devices (no meaningful pointer to follow).
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Intro handoff: bloom in when the loader dismisses, with a fallback timer in
  // case the event is missed (or the loader never shows). Reduced motion lands
  // settled immediately.
  useEffect(() => {
    if (reduce) {
      setBloom("in");
      return;
    }
    const onDismiss = () => setBloom("in");
    window.addEventListener("hyp3:intro-dismissed", onDismiss);
    const fallback = window.setTimeout(() => setBloom("in"), 1400);
    return () => {
      window.removeEventListener("hyp3:intro-dismissed", onDismiss);
      window.clearTimeout(fallback);
    };
  }, [reduce]);

  // The drift + cursor-follow loop. Skipped entirely under reduced motion.
  useEffect(() => {
    if (reduce) return;

    let raf = 0;
    let running = true;
    // Eased pointer position in px; target jumps to the real pointer, eased
    // value chases it (this is the spring-feel for the background).
    let epx = window.innerWidth / 2;
    let epy = window.innerHeight / 2;
    let tpx = epx;
    let tpy = epy;

    const onPointer = (e: PointerEvent) => {
      tpx = e.clientX;
      tpy = e.clientY;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Cap to ~30fps: this is heavily-blurred ambient motion, so halving the
    // blurred-layer recompositing is invisible but meaningfully cheaper.
    const MIN_DT = 1000 / 30;
    let lastFrame = 0;
    const loop = (nowMs: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (nowMs - lastFrame < MIN_DT) return;
      lastFrame = nowMs;
      const t = nowMs / 1000;
      const W = window.innerWidth;
      const H = window.innerHeight;

      epx += (tpx - epx) * 0.07;
      epy += (tpy - epy) * 0.07;
      const nx = epx / W - 0.5;
      const ny = epy / H - 0.5;

      for (let i = 0; i < BLOBS.length; i++) {
        const b = BLOBS[i];
        const el = blobRefs.current[i];
        if (!el) continue;
        let x: number;
        let y: number;
        if (b.cursor) {
          x = epx;
          y = epy;
        } else {
          x = (b.bx / 100) * W + Math.sin(t * b.wx + b.phase) * b.ax + nx * b.pull * 90;
          y = (b.by / 100) * H + Math.cos(t * b.wy + b.phase) * b.ay + ny * b.pull * 90;
        }
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduce]);

  const visibleBlobs = useMemo(
    () => BLOBS.filter((b) => !(b.cursor && coarse)),
    [coarse],
  );

  return (
    <div
      ref={rootRef}
      className="fluid-root"
      data-bloom={bloom}
      aria-hidden
    >
      <div className="fluid-field">
        {visibleBlobs.map((b, i) => (
          <div
            key={b.color + i}
            ref={(el) => {
              blobRefs.current[i] = el;
            }}
            className="fluid-blob"
            style={blobStyle(b)}
          />
        ))}
      </div>
      {/* Global texture layer. TweaksPanel toggles dots/lines/off and drives
          --grid-opacity; starts as dots to match the prior hero treatment. */}
      <div data-bg-grid className="fluid-grid bg-dotgrid" />
    </div>
  );
}
