/**
 * Build both the main process and the renderer with esbuild.
 *
 * Outputs:
 *   dist/main.js          ← Electron main process (CommonJS, Node target)
 *   dist/preload.js       ← Electron preload script (CommonJS, Node target)
 *   dist/renderer/panel.js ← Browser renderer (ESM-compatible, browser target)
 *
 * Usage:
 *   node esbuild.config.mjs          ← one-shot build
 *   node esbuild.config.mjs --watch  ← rebuild on file change (dev)
 */

import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "fs";

const watch = process.argv.includes("--watch");

const baseOpts = {
  bundle: true,
  sourcemap: watch ? "inline" : false,
  logLevel: "info",
};

// Main process
const mainCtx = await esbuild.context({
  ...baseOpts,
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  platform: "node",
  target: "node20",
  // Electron built-ins must not be bundled
  external: ["electron"],
  format: "cjs",
});

// Preload
const preloadCtx = await esbuild.context({
  ...baseOpts,
  entryPoints: ["src/preload.ts"],
  outfile: "dist/preload.js",
  platform: "node",
  target: "node20",
  external: ["electron"],
  format: "cjs",
});

// Renderer — runs in Chromium, NOT Node
const rendererCtx = await esbuild.context({
  ...baseOpts,
  entryPoints: ["src/renderer/panel.ts"],
  outfile: "dist/renderer/panel.js",
  platform: "browser",
  target: "chrome120", // Electron 29 ships Chromium 120
  format: "iife",
});

// Copy panel.html into dist/renderer/ so it lives next to panel.js
function copyHtml() {
  mkdirSync("dist/renderer", { recursive: true });
  copyFileSync("src/renderer/panel.html", "dist/renderer/panel.html");
}

if (watch) {
  await Promise.all([
    mainCtx.watch(),
    preloadCtx.watch(),
    rendererCtx.watch(),
  ]);
  copyHtml();
  console.log("Watching for changes…");
} else {
  await Promise.all([
    mainCtx.rebuild(),
    preloadCtx.rebuild(),
    rendererCtx.rebuild(),
  ]);
  copyHtml();
  await Promise.all([
    mainCtx.dispose(),
    preloadCtx.dispose(),
    rendererCtx.dispose(),
  ]);
}
