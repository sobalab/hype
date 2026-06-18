"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

// Electric current for the divergent spectrum. A 2D canvas overlay (additive
// glow, no WebGL) on the gap chart: charges flow down the center zero-axis
// "spine", and periodic jagged bolts strike the spine and arc between the most
// overhyped (top-left) and most underhyped (bottom-right) extremes. Reduced
// motion renders a single settled spine with no animation; the loop pauses
// when the tab is hidden. pointer-events:none so it never blocks the rows.
export function SpectrumCurrent() {
  const reduce = useReducedMotion() ?? false;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    const drawSpine = (alpha: number) => {
      const cx = w / 2;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(114,184,255,0)");
      g.addColorStop(0.5, `rgba(114,184,255,${alpha})`);
      g.addColorStop(1, "rgba(114,184,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, h);
      ctx.stroke();
    };

    if (reduce) {
      ctx.clearRect(0, 0, w, h);
      drawSpine(0.18);
      return () => ro.disconnect();
    }

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    // Charges traveling down the spine (fractional y + length).
    const charges = Array.from({ length: 4 }, () => ({
      y: Math.random(),
      v: 0.07 + Math.random() * 0.06,
      len: 0.1 + Math.random() * 0.1,
    }));

    let nextBolt = 1.2;
    let boltLife = 0;
    let boltActive = false;

    const jagged = (
      ax: number, ay: number, bx: number, by: number, segs: number, amp: number,
    ) => {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const j = rand(-amp, amp);
        const k = rand(-amp, amp);
        ctx.lineTo(ax + (bx - ax) * t + j, ay + (by - ay) * t + k);
      }
      ctx.lineTo(bx, by);
      ctx.stroke();
    };

    let raf = 0;
    let running = true;
    let last = performance.now();
    const onVis = () => {
      if (document.hidden) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // ~30fps cap: ambient current, and each frame fully redraws the canvas
    // with shadowBlur, so halving the rate roughly halves the paint cost.
    const MIN_DT = 1000 / 30;
    const loop = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (now - last < MIN_DT) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cx = w / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      drawSpine(0.12);

      // Traveling charges along the spine.
      ctx.shadowBlur = 14;
      ctx.shadowColor = "rgba(102,231,216,0.9)";
      for (const c of charges) {
        c.y += c.v * dt;
        if (c.y > 1 + c.len) c.y = -c.len;
        const y0 = c.y * h;
        const y1 = (c.y + c.len) * h;
        const cg = ctx.createLinearGradient(0, y0, 0, y1);
        cg.addColorStop(0, "rgba(102,231,216,0)");
        cg.addColorStop(0.5, "rgba(102,231,216,0.8)");
        cg.addColorStop(1, "rgba(102,231,216,0)");
        ctx.strokeStyle = cg;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, y0);
        ctx.lineTo(cx, y1);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Periodic bolt: strike down the spine + arc between the extremes.
      nextBolt -= dt;
      if (!boltActive && nextBolt <= 0) {
        boltActive = true;
        boltLife = 0;
      }
      if (boltActive) {
        boltLife += dt;
        const dur = 0.42;
        const p = boltLife / dur;
        if (p >= 1) {
          boltActive = false;
          nextBolt = 2.4 + Math.random() * 2.6;
        } else {
          const env = p < 0.25 ? p / 0.25 : (1 - p) / 0.75;
          ctx.shadowBlur = 16;
          ctx.shadowColor = "rgba(114,184,255,0.9)";
          ctx.strokeStyle = `rgba(160,210,255,${Math.max(0, env)})`;
          ctx.lineWidth = 1.4;
          // down the spine
          jagged(cx, 0, cx, h, 16, 9);
          // arc: top-left overhyped extreme -> bottom-right underhyped extreme
          ctx.strokeStyle = `rgba(120,200,255,${Math.max(0, env) * 0.7})`;
          jagged(w * 0.14, h * 0.12, w * 0.86, h * 0.88, 20, 13);
          ctx.shadowBlur = 0;
        }
      }

      ctx.globalCompositeOperation = "source-over";
    };
    raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduce]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[2]"
    />
  );
}
