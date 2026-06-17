"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PLAYBACK_RATE = 1.25;
const FADE_MS = 700;

export function IntroLoader() {
  const [done, setDone] = useState(false);
  const [fading, setFading] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const fadingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    setIsMobile(mobile);
    setSrc(mobile ? "/media/loader-mobile.mp4" : "/media/loader.mp4");
  }, []);

  const beginFade = useCallback(() => {
    if (fadingRef.current) return;
    fadingRef.current = true;
    setFading(true);
    // Hand off to the fluid background: it blooms in while we fade out, so the
    // intro reads as one continuous liquid entrance rather than two cuts.
    try {
      window.dispatchEvent(new CustomEvent("hyp3:intro-dismissed"));
    } catch {
      // CustomEvent unavailable in some very old engines; the background has a
      // timed fallback, so this is non-fatal.
    }
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setDone(true), FADE_MS);
  }, []);

  useEffect(() => {
    if (done) return;
    rootRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" ||
        e.key === "Enter" ||
        e.key === "Return" ||
        e.code === "Enter" ||
        e.code === "NumpadEnter"
      ) {
        e.preventDefault();
        e.stopPropagation();
        beginFade();
      }
    };
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [done, beginFade]);

  useEffect(() => {
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);

  // Lock document scroll while the loader is up. Without this, mobile Safari
  // scrolls the body under the fixed overlay; address-bar collapse then
  // resizes the visual viewport mid-scroll and the `inset-0` video reframes.
  useEffect(() => {
    if (done) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevOverscroll = body.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.overscrollBehavior = prevOverscroll;
    };
  }, [done]);

  if (done) return null;

  return (
    <div
      data-hyp3-loader
      ref={rootRef}
      onClick={beginFade}
      onTouchStart={beginFade}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape" || e.key === "Return") {
          e.preventDefault();
          beginFade();
        }
      }}
      tabIndex={0}
      autoFocus
      role="button"
      aria-label="Dismiss intro"
      style={{
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        willChange: "opacity",
        outline: "none",
        touchAction: "none",
        overscrollBehavior: "none",
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black"
    >
      {src && (
        <video
          ref={(el) => {
            videoRef.current = el;
            if (el) el.playbackRate = PLAYBACK_RATE;
          }}
          src={src}
          autoPlay
          muted
          playsInline
          webkit-playsinline="true"
          preload="auto"
          tabIndex={-1}
          disablePictureInPicture
          poster="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
          controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            v.playbackRate = PLAYBACK_RATE;
            const p = v.play();
            if (p && typeof p.catch === "function") {
              p.catch(() => {
                if (isMobile) beginFade();
              });
            }
          }}
          onEnded={beginFade}
          onError={beginFade}
          className="pointer-events-none h-full w-full object-cover"
        />
      )}
    </div>
  );
}
