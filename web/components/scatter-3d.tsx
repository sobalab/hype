"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { GapMode, StoryTag, TAG_LABEL, Team } from "@/lib/data";

const COL: Record<StoryTag, [number, number, number]> = {
  overhyped: [0.976, 0.584, 0.714],
  underhyped: [0.4, 0.906, 0.847],
  as_expected: [0.937, 0.925, 0.686],
  noise: [0.706, 0.706, 0.937],
};
const HEX: Record<StoryTag, string> = {
  overhyped: "#f995b6",
  underhyped: "#66e7d8",
  as_expected: "#efecaf",
  noise: "#b4b4ef",
};
const TAGS: StoryTag[] = ["overhyped", "underhyped", "as_expected", "noise"];

const EX = 14;
const EY = 7.6;
const EZ = 11;
const SUB = 7;
const HOPS = 3;
const MAXPTS = HOPS * SUB + 1;
const NBOLTS = 9;

const VERT = `
attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
varying vec3 vColor; varying float vAlpha; uniform float uScale;
void main(){
  vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (uScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying vec3 vColor; varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - vec2(0.5); float d = length(c);
  if (d > 0.5) discard;
  float a = (1.0 - smoothstep(0.18, 0.5, d)) * vAlpha;
  float hot = 1.0 - smoothstep(0.0, 0.32, d);
  gl_FragColor = vec4(vColor * (0.82 + 0.5 * hot), a);
}`;

type Bolt = {
  line: THREE.Line;
  g: THREE.BufferGeometry;
  arr: Float32Array;
  m: THREE.LineBasicMaterial;
  active: boolean;
  path: number[];
  life: number;
  dur: number;
  respawn: number;
};

type Built = {
  objects: THREE.Object3D[];
  points: THREE.Points;
  geo: THREE.BufferGeometry;
  mat: THREE.ShaderMaterial;
  staticLines: THREE.LineSegments;
  basePos: THREE.Vector3[];
  curPos: Float32Array;
  baseSize: Float32Array;
  sizes: Float32Array;
  alphas: Float32Array;
  spark: Float32Array;
  adj: number[][];
  bolts: Bolt[];
  N: number;
};

function build(teams: Team[], reduce: boolean): Built {
  const N = teams.length;
  let aMin = Infinity;
  let aMax = 0;
  for (const t of teams) {
    const a = Math.max(0.1, t.hype_acceleration);
    aMin = Math.min(aMin, a);
    aMax = Math.max(aMax, a);
  }
  const laMin = Math.log(aMin);
  const laMax = Math.log(Math.max(aMax, aMin * 1.0001));
  const pos = (t: Team) =>
    new THREE.Vector3(
      (Math.sqrt(Math.min(100, t.hype_normalized) / 100) - 0.5) * EX,
      (Math.min(7, t.wins) / 7) * EY,
      ((Math.log(Math.max(0.1, t.hype_acceleration)) - laMin) / (laMax - laMin || 1) - 0.5) * EZ,
    );

  const objects: THREE.Object3D[] = [];
  const grid = new THREE.GridHelper(EX, 10, 0x1b2230, 0x12161e);
  objects.push(grid);
  const ramp = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-EX / 2, 0.02, 0),
      new THREE.Vector3(EX / 2, EY, 0),
    ]),
    new THREE.LineBasicMaterial({ color: 0x72b8ff, transparent: true, opacity: 0.5 }),
  );
  objects.push(ramp);

  const basePos: THREE.Vector3[] = [];
  const curPos = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const sizes = new Float32Array(N);
  const baseSize = new Float32Array(N);
  const alphas = new Float32Array(N);
  const spark = new Float32Array(N);
  teams.forEach((t, i) => {
    const p = pos(t);
    basePos.push(p);
    const c = COL[t.story_tag];
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
    baseSize[i] = 0.14 + t.wins * 0.008;
    sizes[i] = baseSize[i];
    alphas[i] = 1;
    if (reduce) {
      curPos[i * 3] = p.x;
      curPos[i * 3 + 1] = p.y;
      curPos[i * 3 + 2] = p.z;
    }
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(curPos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  objects.push(points);

  // Nearest-neighbor network (3 nearest each).
  const adj: number[][] = Array.from({ length: N }, () => []);
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const ds: [number, number][] = [];
    for (let j = 0; j < N; j++) if (j !== i) ds.push([basePos[i].distanceTo(basePos[j]), j]);
    ds.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < Math.min(3, ds.length); k++) {
      const j = ds[k][1];
      adj[i].push(j);
      const key = Math.min(i, j) + "-" + Math.max(i, j);
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push([i, j]);
      }
    }
  }
  for (const [i, j] of edges) if (!adj[j].includes(i)) adj[j].push(i);

  const netPos: number[] = [];
  for (const [i, j] of edges) {
    const a = basePos[i];
    const b = basePos[j];
    netPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const netGeo = new THREE.BufferGeometry();
  netGeo.setAttribute("position", new THREE.Float32BufferAttribute(netPos, 3));
  const staticLines = new THREE.LineSegments(
    netGeo,
    new THREE.LineBasicMaterial({ color: 0x2a4866, transparent: true, opacity: 0.14 }),
  );
  staticLines.frustumCulled = false;
  objects.push(staticLines);

  // Electric bolt pool.
  const EC = new THREE.Color(0.66, 0.93, 1.0);
  const bolts: Bolt[] = [];
  for (let b = 0; b < NBOLTS; b++) {
    const arr = new Float32Array(MAXPTS * 3);
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
    bolts.push({ line, g, arr, m, active: false, path: [], life: 0, dur: 0.5, respawn: b * 0.12 });
  }

  return {
    objects, points, geo, mat, staticLines,
    basePos, curPos, baseSize, sizes, alphas, spark, adj, bolts, N,
  };
}

function disposeObject(o: THREE.Object3D) {
  const any = o as unknown as {
    geometry?: { dispose?: () => void };
    material?: { dispose?: () => void };
  };
  any.geometry?.dispose?.();
  any.material?.dispose?.();
}

function Scene({
  teams,
  activeTagRef,
  hoverRef,
  tooltipRef,
}: {
  teams: Team[];
  activeTagRef: React.RefObject<StoryTag | null>;
  hoverRef: React.RefObject<number>;
  tooltipRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { scene, size, gl, camera } = useThree();
  const reduce = useReducedMotion() ?? false;
  const built = useMemo(() => build(teams, reduce), [teams, reduce]);
  const lastHover = useRef(-1);

  useEffect(() => {
    built.objects.forEach((o) => scene.add(o));
    const prevFog = scene.fog;
    scene.fog = new THREE.FogExp2(0x06070a, 0.018);
    return () => {
      built.objects.forEach((o) => {
        scene.remove(o);
        disposeObject(o);
      });
      scene.fog = prevFog;
    };
  }, [scene, built]);

  useEffect(() => {
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 46;
    built.mat.uniforms.uScale.value =
      (size.height * gl.getPixelRatio()) / (2 * Math.tan((fov * Math.PI) / 180 / 2));
  }, [size, gl, camera, built]);

  const tmp = useRef({
    v: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(), up: new THREE.Vector3(),
  });

  useFrame((state, deltaRaw) => {
    const dt = Math.min(0.05, deltaRaw);
    const now = state.clock.getElapsedTime() * 1000;
    const intro = reduce ? 1 : Math.min(1, now / 1400);
    const ease = 1 - Math.pow(1 - intro, 3);
    const electricOn = !reduce && intro > 0.98;
    const { basePos, curPos, baseSize, sizes, alphas, spark, adj, bolts, N, geo } = built;
    const activeTag = activeTagRef.current;

    for (let i = 0; i < N; i++) spark[i] *= 0.86;

    // Bolts traversing the network.
    if (electricOn) {
      const T = tmp.current;
      for (const bolt of bolts) {
        if (!bolt.active) {
          bolt.respawn -= dt;
          if (bolt.respawn <= 0) {
            let cur = Math.floor(Math.random() * N);
            const path = [cur];
            let prev = -1;
            for (let h = 0; h < HOPS; h++) {
              const nb = adj[cur].filter((x) => x !== prev);
              if (!nb.length) break;
              const nx = nb[Math.floor(Math.random() * nb.length)];
              path.push(nx);
              prev = cur;
              cur = nx;
            }
            bolt.path = path;
            bolt.active = path.length > 1;
            bolt.life = 0;
            bolt.dur = 0.42 + Math.random() * 0.3;
          }
          continue;
        }
        bolt.life += dt;
        const p = bolt.life / bolt.dur;
        if (p >= 1) {
          bolt.active = false;
          bolt.m.opacity = 0;
          bolt.respawn = 0.08 + Math.random() * 0.5;
          continue;
        }
        // jag
        const path = bolt.path;
        const arr = bolt.arr;
        let n = 0;
        for (let k = 0; k < path.length - 1; k++) {
          const A = basePos[path[k]];
          const B = basePos[path[k + 1]];
          T.v.copy(B).sub(A).normalize();
          T.up.set(0, 1, 0);
          if (Math.abs(T.v.y) > 0.9) T.up.set(1, 0, 0);
          T.p1.crossVectors(T.v, T.up).normalize();
          T.p2.crossVectors(T.v, T.p1).normalize();
          const s0 = k === 0 ? 0 : 1;
          for (let s = s0; s <= SUB; s++) {
            const tt = s / SUB;
            let ox = 0;
            let oy = 0;
            let oz = 0;
            if (s > 0 && s < SUB) {
              const amp = 0.32 * Math.sin(tt * Math.PI);
              const r1 = (Math.random() - 0.5) * amp * 2;
              const r2 = (Math.random() - 0.5) * amp * 2;
              ox = T.p1.x * r1 + T.p2.x * r2;
              oy = T.p1.y * r1 + T.p2.y * r2;
              oz = T.p1.z * r1 + T.p2.z * r2;
            }
            arr[n * 3] = A.x + (B.x - A.x) * tt + ox;
            arr[n * 3 + 1] = A.y + (B.y - A.y) * tt + oy;
            arr[n * 3 + 2] = A.z + (B.z - A.z) * tt + oz;
            n++;
          }
        }
        bolt.g.setDrawRange(0, n);
        bolt.g.attributes.position.needsUpdate = true;
        let env: number;
        if (p < 0.12) env = p / 0.12;
        else if (p > 0.7) env = (1 - p) / 0.3;
        else env = 0.7 + 0.3 * Math.random();
        bolt.m.opacity = Math.max(0, env) * 0.95;
        for (const di of path) spark[di] = Math.max(spark[di], 0.13 * env);
      }
    } else {
      for (const bolt of bolts) {
        bolt.m.opacity = 0;
        bolt.active = false;
      }
    }

    // Hover pick (only once revealed).
    let hovered = -1;
    if (intro > 0.98) {
      state.raycaster.params.Points!.threshold = 0.55;
      state.raycaster.setFromCamera(state.pointer, state.camera);
      const hits = state.raycaster.intersectObject(built.points);
      const v = hits.find((h) => h.index != null && alphas[h.index] > 0.5);
      hovered = v?.index ?? -1;
    }
    hoverRef.current = hovered;

    // Per-point update.
    for (let i = 0; i < N; i++) {
      const tgtA = activeTag === null || teams[i].story_tag === activeTag ? 1 : 0.08;
      alphas[i] += (tgtA - alphas[i]) * 0.12;
      const wob = reduce ? 0 : Math.sin(now * 0.0011 + i * 1.7) * 0.06;
      curPos[i * 3] = basePos[i].x * ease;
      curPos[i * 3 + 1] = basePos[i].y * ease + wob;
      curPos[i * 3 + 2] = basePos[i].z * ease;
      const tgtS = i === hovered ? baseSize[i] * 1.7 : baseSize[i];
      sizes[i] += (tgtS - sizes[i]) * 0.2;
      (geo.attributes.aSize.array as Float32Array)[i] = sizes[i] + spark[i];
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;

    // Tooltip (DOM, imperative).
    const tip = tooltipRef.current;
    if (tip) {
      if (hovered >= 0) {
        const t = teams[hovered];
        if (hovered !== lastHover.current) {
          const gs = t.gap >= 0 ? `+${t.gap}` : `${t.gap}`;
          tip.innerHTML =
            `<div class="font-display text-sm font-bold text-ink">${t.team}</div>` +
            `<div class="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-2">${t.seed} seed / ${t.region}</div>` +
            `<div class="mt-1 flex gap-3 font-mono text-[10px] text-ink-1"><span>HYPE ${t.hype_normalized.toFixed(1)}</span><span>W ${t.wins}</span><span>×${t.hype_acceleration.toFixed(1)}</span><span>GAP ${gs}</span></div>`;
          lastHover.current = hovered;
        }
        const proj = tmp.current.v
          .set(curPos[hovered * 3], curPos[hovered * 3 + 1], curPos[hovered * 3 + 2])
          .project(state.camera);
        tip.style.left = `${(proj.x * 0.5 + 0.5) * size.width}px`;
        tip.style.top = `${(-proj.y * 0.5 + 0.5) * size.height}px`;
        tip.style.opacity = "1";
      } else {
        tip.style.opacity = "0";
        lastHover.current = -1;
      }
    }
  });

  return null;
}

export function Scatter3D({
  teams,
  mode: _mode,
  onSelect,
}: {
  teams: Team[];
  mode: GapMode;
  onSelect: (t: Team) => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const [activeTag, setActiveTag] = useState<StoryTag | null>(null);
  const activeTagRef = useRef<StoryTag | null>(null);
  activeTagRef.current = activeTag;
  const hoverRef = useRef<number>(-1);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      className="relative w-full overflow-hidden rounded-[14px] border border-border bg-[#06070a]"
      style={{ height: "min(72vh, 640px)" }}
      onClick={() => {
        const i = hoverRef.current;
        if (i >= 0 && i < teams.length) onSelect(teams[i]);
      }}
    >
      <Canvas
        dpr={[1, 2]}
        frameloop={reduce ? "demand" : "always"}
        camera={{ position: [12, 8.5, 16], fov: 46, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => gl.setClearColor(0x06070a, 1)}
      >
        <Scene teams={teams} activeTagRef={activeTagRef} hoverRef={hoverRef} tooltipRef={tooltipRef} />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={10}
          maxDistance={38}
          target={[0, 3.4, 0]}
          autoRotate={!reduce}
          autoRotateSpeed={0.55}
        />
      </Canvas>

      {/* Story-tag chips. */}
      <div className="pointer-events-auto absolute left-3 top-3 flex flex-wrap gap-1.5">
        {TAGS.map((tag) => {
          const dimmed = activeTag !== null && activeTag !== tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTag((a) => (a === tag ? null : tag));
              }}
              aria-pressed={activeTag === tag}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-all"
              style={{
                borderColor: activeTag === tag ? HEX[tag] : "var(--border)",
                background: activeTag === tag ? `${HEX[tag]}22` : "rgba(0,0,0,0.35)",
                color: activeTag === tag ? HEX[tag] : "var(--ink-1)",
                opacity: dimmed ? 0.45 : 1,
              }}
            >
              <span className="size-1.5 rounded-full" style={{ background: HEX[tag] }} />
              {TAG_LABEL[tag]}
            </button>
          );
        })}
      </div>

      {/* Hover tooltip (positioned imperatively). */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[120%] whitespace-nowrap rounded-lg border border-border-hi bg-bg-2/95 px-3 py-2 opacity-0 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.8)] backdrop-blur-md transition-opacity"
        style={{ left: 0, top: 0 }}
      />

      <div className="pointer-events-none absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
        X hype / Y wins / Z surge
      </div>
    </div>
  );
}
