"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// One traceable line of provenance: a small label and its value.
export type ProvLine = { k: string; v: string };
export type ProvInfo = { label: string; lines: ProvLine[]; note?: string };

// Wraps a number/label so it traces back to exactly where it came from. Opens
// on hover, keyboard focus, or tap; the card is portaled to <body> with fixed
// positioning so it never clips inside the scrollable team sheet. This is the
// "trustless" web3 ideal rendered literally: here is the source and the window.
export function Provenance({
  info,
  children,
  className,
}: {
  info: ProvInfo;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const above = r.top > 230;
    setPos({
      x: r.left + r.width / 2,
      y: above ? r.top - 8 : r.bottom + 8,
      above,
    });
  };
  const show = () => {
    place();
    setOpen(true);
  };
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => hide();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (open ? hide() : show())}
        aria-label={`Source for ${info.label}`}
        className={`group/prov inline-flex items-center gap-1 text-left ${className ?? ""}`}
      >
        {children}
        <span
          aria-hidden
          className="inline-flex size-[13px] shrink-0 items-center justify-center rounded-full border border-ink-3 font-mono text-[8px] leading-none text-ink-3 transition-colors group-hover/prov:border-core-bright group-hover/prov:text-core-bright"
        >
          i
        </span>
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y,
              transform: `translate(-50%, ${pos.above ? "-100%" : "0"})`,
            }}
            className="pointer-events-none z-[200] w-[262px] rounded-lg border border-border-hi bg-bg-2/97 p-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)] backdrop-blur-xl"
          >
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-core-bright">
              {info.label}
            </div>
            <dl className="flex flex-col gap-1.5">
              {info.lines.map((l) => (
                <div key={l.k} className="grid grid-cols-[78px_1fr] gap-2">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
                    {l.k}
                  </dt>
                  <dd className="m-0 font-sans text-[12px] leading-[1.4] text-ink-1">
                    {l.v}
                  </dd>
                </div>
              ))}
            </dl>
            {info.note && (
              <p className="mt-2 mb-0 border-t border-border pt-2 font-mono text-[10px] tracking-[0.04em] text-ink-2">
                {info.note}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
