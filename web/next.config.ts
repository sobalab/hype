import path from "node:path";
import type { NextConfig } from "next";

// This project lives under ~/Documents, which macOS syncs to iCloud. iCloud's
// sync daemon (`bird`) evicts/relocates Next's rapidly-churning dev artifacts
// mid-write, which corrupts the dev server (missing middleware-manifest.json,
// ENOENT on temp files, deleted `.next/dev`). Writing dev output to a
// ".nosync"-suffixed directory tells iCloud to skip it, so the dev server is
// stable. Production builds and Vercel keep the standard ".next" dir (and the
// separate dir also stops local `next build` from clobbering a running dev
// server). The `dev` script sets HYP3_DEV=1; see package.json.
const isDev = process.env.HYP3_DEV === "1";

const nextConfig: NextConfig = {
  // Pin the workspace root to /web so Turbopack doesn't pick up the
  // user's home-dir lockfile.
  turbopack: {
    root: path.join(__dirname),
  },
  ...(isDev ? { distDir: ".next.nosync" } : {}),
};

export default nextConfig;
