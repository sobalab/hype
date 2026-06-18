"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

import { buildRegionTree } from "@/components/bracket-tree";
import { Region, REGIONS, StoryTag, TAG_LABEL, Team } from "@/lib/data";

const COL: Record<StoryTag, number> = {
  overhyped: 0xf995b6,
  underhyped: 0x66e7d8,
  as_expected: 0xefecaf,
  noise: 0xb4b4ef,
};
const HEX: Record<StoryTag, string> = {
  overhyped: "#f995b6",
  underhyped: "#66e7d8",
  as_expected: "#efecaf",
  noise: "#b4b4ef",
};
const TAGS: StoryTag[] = ["overhyped", "underhyped", "as_expected", "noise"];
const ROUND_LABEL = [
  "First round exit",
  "Round of 32",
  "Sweet 16",
  "Elite Eight",
  "Final Four",
  "Runner-up",
  "Champion",
];

const REGION_ANGLE: Record<Region, number> = {
  East: 0,
  West: Math.PI / 2,
  South: Math.PI,
  Midwest: (3 * Math.PI) / 2,
};
const APEX_Y = 20;
const SAMP = 16;
const WINDOW = 1.6;

function posFor(region: Region, round: number, i: number, count: number): THREE.Vector3 {
  const ang = REGION_ANGLE[region];
  const dx = Math.cos(ang);
  const dz = Math.sin(ang);
  const tx = -Math.sin(ang);
  const tz = Math.cos(ang);
  const radius = 27 - round * 5.0;
  const y = round * 4.0;
  const spacing = 22 / Math.max(1, count);
  const off = (i - (count - 1) / 2) * spacing;
  return new THREE.Vector3(dx * radius + tx * off, y, dz * radius + tz * off);
}

type Tile = {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  base: THREE.Color;
  baseEm: number;
  round: number;
  team: Team;
  spark: number;
};
type ChainPt = { pos: THREE.Vector3; tile?: Tile; apex?: boolean };
type Pulse = {
  line: THREE.Line;
  g: THREE.BufferGeometry;
  arr: Float32Array;
  m: THREE.LineBasicMaterial;
  chain: ChainPt[] | null;
  e: number;
  lastN: number;
  respawn: number;
};
type Built = {
  objects: THREE.Object3D[];
  tiles: Tile[];
  champMesh: THREE.Mesh;
  champMat: THREE.MeshStandardMaterial;
  lmat: LineMaterial;
  chains: ChainPt[][];
  pulses: Pulse[];
};

function labelSprite(text: string, color: string, scale: number): THREE.Sprite {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 64;
  const ctx = cv.getContext("2d")!;
  ctx.font = '600 26px "Alpha Lyrae", ui-monospace, monospace';
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }),
  );
  sp.scale.set(scale, scale * 0.25, 1);
  return sp;
}

function build(teams: Team[], reduce: boolean): Built {
  const objects: THREE.Object3D[] = [];
  objects.push(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(-10, 20, 14);
  objects.push(key);
  const fill = new THREE.DirectionalLight(0x88b4ff, 0.35);
  fill.position.set(12, 6, -10);
  objects.push(fill);
  objects.push(new THREE.PointLight(0x72b8ff, 30, 40, 2).translateY(APEX_Y));

  const champion = teams.find((t) => t.wins >= 6) ?? null;
  const tileGeo = new RoundedBoxGeometry(3.0, 0.4, 0.92, 2, 0.1);
  const tiles: Tile[] = [];
  const tileByKey = new Map<string, Tile>();
  const segPos: number[] = [];
  const segCol: number[] = [];
  const cb = new THREE.Color(0.62, 0.74, 1.0);
  const cd = new THREE.Color(0.13, 0.16, 0.22);

  for (const region of REGIONS) {
    const tree = buildRegionTree(teams, region);
    const rounds: (Team | null)[][] = [tree.r64, tree.r32, tree.s16, tree.e8, [tree.champion]];

    rounds.forEach((arr, round) => {
      const count = arr.length;
      arr.forEach((team, i) => {
        const p = posFor(region, round, i, count);
        if (team) {
          const base = new THREE.Color(COL[team.story_tag]);
          const adv = team.wins > round;
          const baseEm = adv ? 0.22 : 0.12;
          const mat = new THREE.MeshStandardMaterial({
            color: base,
            emissive: base.clone().multiplyScalar(0.9),
            emissiveIntensity: baseEm,
            metalness: 0.3,
            roughness: 0.5,
            transparent: true,
            opacity: 1,
          });
          const mesh = new THREE.Mesh(tileGeo, mat);
          mesh.position.set(p.x, p.y + 0.25, p.z);
          if (!reduce) mesh.scale.setScalar(0.001);
          objects.push(mesh);
          const tile: Tile = { mesh, mat, base, baseEm, round, team, spark: 0 };
          tiles.push(tile);
          tileByKey.set(`${region}-${round}-${i}`, tile);
        }
        // Structural connector to the parent slot in the next round.
        if (round < 4) {
          const parent = posFor(region, round + 1, i >> 1, count >> 1);
          const advanced =
            arr[i] != null && rounds[round + 1][i >> 1] != null && arr[i] === rounds[round + 1][i >> 1];
          const c = advanced ? cb : cd;
          segPos.push(p.x, p.y + 0.25, p.z, parent.x, parent.y + 0.25, parent.z);
          segCol.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
      });
    });

    // Region champion -> national apex.
    const rc = tree.champion;
    const rcPos = posFor(region, 4, 0, 1);
    const advanced = rc != null && rc.wins >= 5;
    const c = advanced ? cb : cd;
    segPos.push(rcPos.x, rcPos.y + 0.25, rcPos.z, 0, APEX_Y, 0);
    segCol.push(c.r, c.g, c.b, c.r, c.g, c.b);

    objects.push(labelSprite(region.toUpperCase(), "rgba(251,253,254,0.5)", 7).translateOnAxis(
      new THREE.Vector3(Math.cos(REGION_ANGLE[region]), 0, Math.sin(REGION_ANGLE[region])),
      30,
    ));
  }

  // Connector lines (fat, vertex-colored).
  const lgeo = new LineSegmentsGeometry();
  lgeo.setPositions(segPos);
  lgeo.setColors(segCol);
  const lmat = new LineMaterial({ vertexColors: true, linewidth: 1.6, transparent: true, opacity: reduce ? 0.85 : 0 });
  const lines = new LineSegments2(lgeo, lmat);
  lines.frustumCulled = false;
  objects.push(lines);

  // Champion apex.
  const cbase = new THREE.Color(0x72b8ff);
  const champMat = new THREE.MeshStandardMaterial({
    color: 0xeaf4ff,
    emissive: cbase,
    emissiveIntensity: 0.9,
    metalness: 0.4,
    roughness: 0.25,
  });
  const champMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), champMat);
  champMesh.position.set(0, APEX_Y, 0);
  if (!reduce) champMesh.scale.setScalar(0.001);
  objects.push(champMesh);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, APEX_Y, 8),
    new THREE.MeshBasicMaterial({ color: 0x72b8ff, transparent: true, opacity: 0.16 }),
  );
  beam.position.set(0, APEX_Y / 2, 0);
  objects.push(beam);
  if (champion) {
    const cl = labelSprite(`CHAMPION  ${champion.team}`, "rgba(114,184,255,0.95)", 9);
    cl.position.set(0, APEX_Y + 2.4, 0);
    objects.push(cl);
  }

  // Winning-path chains for the electric pulses.
  const chains: ChainPt[][] = [];
  for (const region of REGIONS) {
    const tree = buildRegionTree(teams, region);
    for (let i = 0; i < tree.r64.length; i++) {
      const team = tree.r64[i];
      if (!team || team.wins < 1) continue;
      const reached = Math.min(team.wins, 4);
      const chain: ChainPt[] = [];
      for (let r = 0; r <= reached; r++) {
        const slot = i >> r;
        chain.push({ pos: posFor(region, r, slot, 16 >> r), tile: tileByKey.get(`${region}-${r}-${slot}`) });
      }
      if (team.wins >= 5) chain.push({ pos: new THREE.Vector3(0, APEX_Y, 0), apex: true });
      if (chain.length >= 2) chains.push(chain);
    }
  }

  // Pulse pool.
  const EC = new THREE.Color(0.66, 0.93, 1.0);
  const pulses: Pulse[] = [];
  for (let i = 0; i < 12; i++) {
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
    pulses.push({ line, g, arr, m, chain: null, e: 0, lastN: -1, respawn: i * 0.18 });
  }

  return { objects, tiles, champMesh, champMat, lmat, chains, pulses };
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

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function Scene({
  teams,
  activeTagRef,
  hoverRef,
  tooltipRef,
}: {
  teams: Team[];
  activeTagRef: React.RefObject<StoryTag | null>;
  hoverRef: React.RefObject<Team | null>;
  tooltipRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { scene, size } = useThree();
  const reduce = useReducedMotion() ?? false;
  const built = useMemo(() => build(teams, reduce), [teams, reduce]);
  const crackle = useRef(0);
  const lastHover = useRef<THREE.Mesh | null>(null);
  const tmp = useRef({ a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3(), u: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(), pt: new THREE.Vector3() });

  useEffect(() => {
    built.objects.forEach((o) => scene.add(o));
    const prevFog = scene.fog;
    scene.fog = new THREE.FogExp2(0x06070a, 0.0075);
    return () => {
      built.objects.forEach((o) => {
        scene.remove(o);
        disposeObject(o);
      });
      scene.fog = prevFog;
    };
  }, [scene, built]);

  useEffect(() => {
    built.lmat.resolution.set(size.width, size.height);
  }, [size, built]);

  useFrame((state, deltaRaw) => {
    const dt = Math.min(0.05, deltaRaw);
    const el = state.clock.getElapsedTime();
    const T = tmp.current;
    const activeTag = activeTagRef.current;
    if (!reduce) {
      built.champMesh.rotation.y += 0.012;
      built.lmat.opacity += (0.85 - built.lmat.opacity) * 0.05;
    }
    const electricOn = !reduce && el > 1.0 && built.chains.length > 0;

    // Hover pick.
    let hoveredMesh: THREE.Mesh | null = null;
    if (el > 0.6) {
      state.raycaster.setFromCamera(state.pointer, state.camera);
      const hits = state.raycaster.intersectObjects(built.tiles.map((t) => t.mesh));
      hoveredMesh = (hits[0]?.object as THREE.Mesh) ?? null;
    }
    hoverRef.current = hoveredMesh
      ? built.tiles.find((t) => t.mesh === hoveredMesh)?.team ?? null
      : null;

    for (const t of built.tiles) {
      if (!reduce) {
        const delay = t.round * 0.22;
        const p = Math.max(0, Math.min(1, (el - delay) / 0.55));
        t.mesh.scale.setScalar(p <= 0 ? 0.001 : Math.max(0.001, easeOutBack(p)));
      }
      if (t.spark > 0) t.spark *= 0.85;
      const dim = activeTag !== null && t.team.story_tag !== activeTag;
      t.mat.opacity += ((dim ? 0.12 : 1) - t.mat.opacity) * 0.15;
      const isHover = t.mesh === hoveredMesh;
      const tgt = dim ? 0.03 : (isHover ? 0.6 : t.baseEm) + t.spark;
      t.mat.emissiveIntensity += (tgt - t.mat.emissiveIntensity) * 0.25;
    }

    crackle.current *= 0.9;
    if (!reduce) built.champMat.emissiveIntensity = 0.9 + crackle.current;

    if (electricOn) {
      for (const p of built.pulses) {
        if (!p.chain) {
          p.respawn -= dt;
          if (p.respawn <= 0) {
            p.chain = built.chains[Math.floor(Math.random() * built.chains.length)];
            p.e = 0;
            p.lastN = -1;
          }
          continue;
        }
        p.e += dt * 4.2;
        const head = p.e;
        const ni = Math.floor(head);
        if (ni > p.lastN) {
          p.lastN = ni;
          const node = p.chain[Math.min(ni, p.chain.length - 1)];
          if (node?.apex) crackle.current = Math.max(crackle.current, 1.1);
          else if (node?.tile) node.tile.spark = 0.7;
        }
        if (head >= p.chain.length - 1 + 0.5) {
          p.chain = null;
          p.m.opacity = 0;
          p.respawn = 0.1 + Math.random() * 0.6;
          continue;
        }
        // jagged trail
        const ch = p.chain;
        const i0 = Math.max(0, Math.min(ch.length - 2, Math.floor(head)));
        T.a.copy(ch[i0].pos);
        T.b.copy(ch[i0 + 1].pos);
        T.d.copy(T.b).sub(T.a).normalize();
        T.u.set(0, 1, 0);
        if (Math.abs(T.d.y) > 0.9) T.u.set(1, 0, 0);
        T.p1.crossVectors(T.d, T.u).normalize();
        T.p2.crossVectors(T.d, T.p1).normalize();
        const L = ch.length - 1;
        for (let s = 0; s < SAMP; s++) {
          const f = s / (SAMP - 1);
          let idx = head - WINDOW * (1 - f);
          idx = Math.max(0, Math.min(L, idx));
          const j0 = Math.floor(idx);
          const j1 = Math.min(j0 + 1, L);
          const ff = idx - j0;
          T.pt.set(
            ch[j0].pos.x + (ch[j1].pos.x - ch[j0].pos.x) * ff,
            ch[j0].pos.y + (ch[j1].pos.y - ch[j0].pos.y) * ff,
            ch[j0].pos.z + (ch[j1].pos.z - ch[j0].pos.z) * ff,
          );
          const amp = 0.75 * Math.sin(f * Math.PI) * (0.6 + 0.4 * Math.random());
          const r1 = (Math.random() - 0.5) * amp * 2;
          const r2 = (Math.random() - 0.5) * amp * 2;
          p.arr[s * 3] = T.pt.x + T.p1.x * r1 + T.p2.x * r2;
          p.arr[s * 3 + 1] = T.pt.y + T.p1.y * r1 + T.p2.y * r2;
          p.arr[s * 3 + 2] = T.pt.z + T.p1.z * r1 + T.p2.z * r2;
        }
        p.g.attributes.position.needsUpdate = true;
        const fade = head > L - 0.4 ? Math.max(0, (L + 0.5 - head) / 0.9) : 1;
        p.m.opacity = (0.7 + 0.3 * Math.random()) * fade;
      }
    } else {
      for (const p of built.pulses) {
        p.m.opacity = 0;
        p.chain = null;
      }
    }

    // Tooltip.
    const tip = tooltipRef.current;
    if (tip) {
      if (hoveredMesh) {
        const t = built.tiles.find((x) => x.mesh === hoveredMesh)!.team;
        if (hoveredMesh !== lastHover.current) {
          const gs = t.gap >= 0 ? `+${t.gap}` : `${t.gap}`;
          tip.innerHTML =
            `<div class="font-display text-sm font-bold text-ink">${t.team}</div>` +
            `<div class="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-2">${t.seed} seed / ${t.region}</div>` +
            `<div class="mt-1 font-mono text-[10px] text-ink-1">${ROUND_LABEL[Math.min(6, t.wins)]} / GAP ${gs}</div>`;
          lastHover.current = hoveredMesh;
        }
        T.pt.copy(hoveredMesh.position).project(state.camera);
        tip.style.left = `${(T.pt.x * 0.5 + 0.5) * size.width}px`;
        tip.style.top = `${(-T.pt.y * 0.5 + 0.5) * size.height}px`;
        tip.style.opacity = "1";
      } else {
        tip.style.opacity = "0";
        lastHover.current = null;
      }
    }
  });

  return null;
}

export function Bracket3D({
  teams,
  onSelect,
}: {
  teams: Team[];
  onSelect: (t: Team) => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const [activeTag, setActiveTag] = useState<StoryTag | null>(null);
  const activeTagRef = useRef<StoryTag | null>(null);
  activeTagRef.current = activeTag;
  const hoverRef = useRef<Team | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      className="relative w-full overflow-hidden rounded-[14px] border border-border bg-[#06070a]"
      style={{ height: "min(74vh, 680px)" }}
      onClick={() => {
        if (hoverRef.current) onSelect(hoverRef.current);
      }}
    >
      <Canvas
        dpr={[1, 2]}
        frameloop={reduce ? "demand" : "always"}
        camera={{ position: [0, 33, 46], fov: 42, near: 0.1, far: 400 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => gl.setClearColor(0x06070a, 1)}
      >
        <Scene teams={teams} activeTagRef={activeTagRef} hoverRef={hoverRef} tooltipRef={tooltipRef} />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={28}
          maxDistance={92}
          target={[0, 4.5, 0]}
          maxPolarAngle={1.4}
          autoRotate={!reduce}
          autoRotateSpeed={0.4}
        />
      </Canvas>

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

      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[120%] whitespace-nowrap rounded-lg border border-border-hi bg-bg-2/95 px-3 py-2 opacity-0 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.8)] backdrop-blur-md transition-opacity"
        style={{ left: 0, top: 0 }}
      />

      <div className="pointer-events-none absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
        Drag to orbit
      </div>
    </div>
  );
}
