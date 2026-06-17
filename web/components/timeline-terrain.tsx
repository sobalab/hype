"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

import { GapMode, StoryTag, TAG_LABEL, Team } from "@/lib/data";

const COL: Record<StoryTag, number> = {
  overhyped: 0xf995b6,
  underhyped: 0x66e7d8,
  as_expected: 0xefecaf,
  noise: 0xb4b4ef,
};
const TAGS: StoryTag[] = ["overhyped", "underhyped", "as_expected", "noise"];

// Terrain dimensions (mirrors the prototype).
const SPANX = 42;
const SPANZ = 46;
const HY = 9;
const SS_INDEX = 5; // Selection Sunday sits at window_start + 5 days.
const PULSES = 15;
const SAMP = 16; // samples per electric pulse trail
const WIN = 2.4; // pulse trail length in day-units

type Ridge = {
  line: Line2;
  m: LineMaterial;
  pts: THREE.Vector3[];
  tag: StoryTag;
  loud: number;
  baseOp: number;
  peak: number;
  spark: number;
  reveal: number;
  label?: THREE.Sprite;
};
type Pulse = {
  line: THREE.Line;
  g: THREE.BufferGeometry;
  arr: Float32Array;
  m: THREE.LineBasicMaterial;
  ridge: Ridge | null;
  e: number;
  lastN: number;
  respawn: number;
};
type Built = {
  objects: THREE.Object3D[];
  lineMats: LineMaterial[];
  ridges: Ridge[];
  pulses: Pulse[];
  days: number;
};

function labelSprite(text: string): THREE.Sprite {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 64;
  const ctx = cv.getContext("2d")!;
  ctx.font = '600 26px "Alpha Lyrae", ui-monospace, monospace';
  ctx.fillStyle = "rgba(251,253,254,0.82)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }),
  );
  sp.scale.set(8, 2, 1);
  return sp;
}

function build(teams: Team[], mode: GapMode, reduce: boolean): Built {
  const rankOf = (t: Team) => (mode === "season" ? t.season_hype_rank : t.hype_rank);
  const ordered = [...teams].sort((a, b) => rankOf(a) - rankOf(b));
  const days = ordered[0]?.hype_daily.length ?? 15;
  const N = Math.max(1, ordered.length);

  let maxAll = 1;
  for (const t of ordered) for (const d of t.hype_daily) maxAll = Math.max(maxAll, d.value);

  const X = (i: number) => (i / (days - 1) - 0.5) * SPANX;
  const Y = (v: number) => Math.sqrt(Math.max(0, v) / maxAll) * HY;
  const Z = (i: number) => SPANZ / 2 - (i / Math.max(1, N - 1)) * SPANZ;

  const objects: THREE.Object3D[] = [];
  const lineMats: LineMaterial[] = [];
  const ridges: Ridge[] = [];

  // Floor grid.
  const grid = new THREE.GridHelper(SPANX, 14, 0x18202c, 0x10151d);
  objects.push(grid);

  // Selection Sunday plane + baseline.
  const ssX = X(SS_INDEX);
  const ss = new THREE.Mesh(
    new THREE.PlaneGeometry(SPANZ, HY * 1.25),
    new THREE.MeshBasicMaterial({
      color: 0x72b8ff,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ss.rotation.y = Math.PI / 2;
  ss.position.set(ssX, HY * 0.6, 0);
  objects.push(ss);
  const ssLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(ssX, 0, SPANZ / 2),
      new THREE.Vector3(ssX, 0, -SPANZ / 2),
    ]),
    new THREE.LineBasicMaterial({ color: 0x72b8ff, transparent: true, opacity: 0.35 }),
  );
  objects.push(ssLine);

  // Ridgelines.
  ordered.forEach((t, ti) => {
    const z = Z(ti);
    const loud = 1 - ti / Math.max(1, N - 1);
    const pts: THREE.Vector3[] = [];
    const flat: number[] = [];
    for (let i = 0; i < days; i++) {
      const x = X(i);
      const y = Y(t.hype_daily[i]?.value ?? 0);
      pts.push(new THREE.Vector3(x, y, z));
      flat.push(x, y, z);
    }
    const g = new LineGeometry();
    g.setPositions(flat);
    const baseOp = 0.22 + loud * 0.6;
    const m = new LineMaterial({
      color: COL[t.story_tag],
      linewidth: 1.1 + loud * 1.7,
      transparent: true,
      opacity: reduce ? baseOp : 0,
      depthWrite: false,
    });
    const line = new Line2(g, m);
    line.computeLineDistances();
    line.frustumCulled = false;
    if (!reduce) line.scale.y = 0.001;
    objects.push(line);
    lineMats.push(m);

    let pk = 0;
    let pi = 0;
    t.hype_daily.forEach((d, i) => {
      if (d.value > pk) {
        pk = d.value;
        pi = i;
      }
    });
    ridges.push({ line, m, pts, tag: t.story_tag, loud, baseOp, peak: pi, spark: 0, reveal: ti * 0.018 });
  });

  // Peak labels for the 3 loudest ridges.
  ridges.slice(0, 3).forEach((r, idx) => {
    const p = r.pts[r.peak];
    const sp = labelSprite(ordered[idx].team);
    sp.position.set(p.x, p.y + 1.6, p.z);
    sp.material.opacity = reduce ? 1 : 0;
    objects.push(sp);
    r.label = sp;
  });

  // Electric pulses.
  const EC = new THREE.Color(0.66, 0.93, 1.0);
  const pulses: Pulse[] = [];
  for (let i = 0; i < PULSES; i++) {
    const arr = new Float32Array(SAMP * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const m = new THREE.LineBasicMaterial({
      color: EC,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(g, m);
    line.frustumCulled = false;
    objects.push(line);
    pulses.push({ line, g, arr, m, ridge: null, e: 0, lastN: -1, respawn: i * 0.12 });
  }

  return { objects, lineMats, ridges, pulses, days };
}

function disposeObject(o: THREE.Object3D) {
  const any = o as unknown as {
    geometry?: { dispose?: () => void };
    material?: { dispose?: () => void; map?: { dispose?: () => void } };
  };
  any.geometry?.dispose?.();
  any.material?.map?.dispose?.();
  any.material?.dispose?.();
}

function Scene({
  teams,
  mode,
  activeTagRef,
}: {
  teams: Team[];
  mode: GapMode;
  activeTagRef: React.RefObject<StoryTag | null>;
}) {
  const { scene, size } = useThree();
  const reduce = useReducedMotion() ?? false;
  const built = useMemo(() => build(teams, mode, reduce), [teams, mode, reduce]);

  useEffect(() => {
    built.objects.forEach((o) => scene.add(o));
    const prevFog = scene.fog;
    scene.fog = new THREE.FogExp2(0x06070a, 0.011);
    return () => {
      built.objects.forEach((o) => {
        scene.remove(o);
        disposeObject(o);
      });
      scene.fog = prevFog;
    };
  }, [scene, built]);

  useEffect(() => {
    built.lineMats.forEach((m) => m.resolution.set(size.width, size.height));
  }, [size, built]);

  const tmp = useRef(new THREE.Vector3());
  const cum = useRef<number[]>([]);
  const total = useRef(0);
  useEffect(() => {
    let tot = 0;
    const c: number[] = [];
    built.ridges.forEach((r) => {
      tot += 0.15 + r.loud * r.loud;
      c.push(tot);
    });
    cum.current = c;
    total.current = tot;
  }, [built]);

  useFrame((s, delta) => {
    const el = s.clock.getElapsedTime();
    const dt = Math.min(0.05, delta);
    const days = built.days;
    const activeTag = activeTagRef.current;
    const electricOn = !reduce && el > 1.2;

    for (const r of built.ridges) {
      if (!reduce) {
        const p = Math.max(0, Math.min(1, (el - r.reveal) / 0.7));
        r.line.scale.y = p <= 0 ? 0.001 : Math.max(0.001, 1 - Math.pow(1 - p, 3));
      }
      if (r.spark > 0) r.spark *= 0.86;
      const match = activeTag === null || r.tag === activeTag;
      const tgt = (match ? r.baseOp : 0.04) + r.spark;
      r.m.opacity += (tgt - r.m.opacity) * (reduce ? 1 : 0.15);
      if (r.label) {
        const lt = match ? Math.min(1, el - 1) : 0;
        r.label.material.opacity += (lt - r.label.material.opacity) * 0.1;
      }
    }

    if (!electricOn) {
      for (const p of built.pulses) {
        p.m.opacity = 0;
        p.ridge = null;
      }
      return;
    }

    const pickRidge = (): Ridge => {
      const x = Math.random() * total.current;
      const c = cum.current;
      for (let i = 0; i < c.length; i++) if (x <= c[i]) return built.ridges[i];
      return built.ridges[0];
    };
    const ridgePt = (r: Ridge, idx: number, out: THREE.Vector3) => {
      idx = Math.max(0, Math.min(days - 1, idx));
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, days - 1);
      const f = idx - i0;
      const a = r.pts[i0];
      const b = r.pts[i1];
      out.set(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f);
    };

    for (const p of built.pulses) {
      if (!p.ridge) {
        p.respawn -= dt;
        if (p.respawn <= 0) {
          p.ridge = pickRidge();
          p.e = -WIN * 0.5;
          p.lastN = -1;
        }
        continue;
      }
      p.e += dt * 7.5 * (0.7 + p.ridge.loud * 0.6);
      const ni = Math.floor(p.e);
      if (ni > p.lastN) {
        p.lastN = ni;
        if (ni === p.ridge.peak) p.ridge.spark = Math.max(p.ridge.spark, 0.5);
      }
      if (p.e >= days - 1 + WIN * 0.6) {
        p.ridge = null;
        p.m.opacity = 0;
        p.respawn = 0.1 + Math.random() * 0.5;
        continue;
      }
      for (let sIdx = 0; sIdx < SAMP; sIdx++) {
        const f = sIdx / (SAMP - 1);
        const idx = p.e - WIN * (1 - f);
        ridgePt(p.ridge, idx, tmp.current);
        const amp = 0.55 * Math.sin(f * Math.PI) * (0.5 + 0.5 * Math.random());
        p.arr[sIdx * 3] = tmp.current.x;
        p.arr[sIdx * 3 + 1] = tmp.current.y + (Math.random() - 0.5) * amp * 2;
        p.arr[sIdx * 3 + 2] = tmp.current.z + (Math.random() - 0.5) * amp * 1.2;
      }
      p.g.attributes.position.needsUpdate = true;
      const head = p.e;
      const fadeIn = Math.min(1, (head + WIN * 0.5) / WIN);
      const fadeOut = head > days - 2 ? Math.max(0, (days - 1 + WIN * 0.6 - head) / WIN) : 1;
      p.m.opacity = (0.7 + 0.3 * Math.random()) * Math.min(fadeIn, fadeOut) * (0.65 + p.ridge.loud * 0.45);
    }
  });

  return null;
}

export function TimelineTerrain({ teams, mode }: { teams: Team[]; mode: GapMode }) {
  const reduce = useReducedMotion() ?? false;
  const [activeTag, setActiveTag] = useState<StoryTag | null>(null);
  const activeTagRef = useRef<StoryTag | null>(null);
  activeTagRef.current = activeTag;

  return (
    <div
      className="relative w-full overflow-hidden rounded-[14px] border border-border bg-[#06070a]"
      style={{ height: "min(72vh, 640px)" }}
    >
      <Canvas
        dpr={[1, 2]}
        frameloop={reduce ? "demand" : "always"}
        camera={{ position: [2, 18, 52], fov: 40, near: 0.1, far: 300 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => gl.setClearColor(0x06070a, 1)}
      >
        <Scene teams={teams} mode={mode} activeTagRef={activeTagRef} />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={30}
          maxDistance={100}
          target={[0, 4, 0]}
          maxPolarAngle={1.45}
          autoRotate={!reduce}
          autoRotateSpeed={0.35}
        />
      </Canvas>

      {/* Story-tag chips — tap to spotlight one tag, dimming the rest. */}
      <div className="pointer-events-auto absolute left-3 top-3 flex flex-wrap gap-1.5">
        {TAGS.map((tag) => {
          const dimmed = activeTag !== null && activeTag !== tag;
          const c = `#${COL[tag].toString(16).padStart(6, "0")}`;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag((a) => (a === tag ? null : tag))}
              aria-pressed={activeTag === tag}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-all"
              style={{
                borderColor: activeTag === tag ? c : "var(--border)",
                background: activeTag === tag ? `${c}22` : "rgba(0,0,0,0.35)",
                color: activeTag === tag ? c : "var(--ink-1)",
                opacity: dimmed ? 0.45 : 1,
              }}
            >
              <span className="size-1.5 rounded-full" style={{ background: c }} />
              {TAG_LABEL[tag]}
            </button>
          );
        })}
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
        Drag to orbit
      </div>
    </div>
  );
}
