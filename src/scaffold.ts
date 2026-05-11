import path from "node:path";
import fs from "node:fs";
import { execa } from "execa";
import { fileExists, log } from "./util.js";

/**
 * Wrap `create-expo-app` to scaffold the blank-typescript template into `dir`.
 *
 * Why `--no-install`:
 *   The CLI runs its own install pass later (Phase 7 `installNativeDeps`) using
 *   the resolved `packageManager` answer + `expo install` (so versions match the
 *   target SDK). Letting create-expo-app install separately would risk
 *   dual-lockfile + version drift.
 *
 * Why `--yes`:
 *   Forces a fresh fetch of `create-expo-app@latest`; bypasses any stale global
 *   install that could ship an older template.
 *
 * NOTE: `dir` is passed as the positional arg. create-expo-app interprets the
 *   final segment as the app name (`expo.name`); we still patch `expo.scheme`
 *   ourselves later (Phase 4 step 7) so the in-package name + scheme stay in sync.
 */
export async function runCreateExpoApp(dir: string, _name: string): Promise<void> {
  log.step(`Scaffolding blank-typescript template into ${dir}…`);
  await execa(
    "npx",
    [
      "--yes",
      "create-expo-app@latest",
      dir,
      "--template",
      "blank-typescript",
      "--no-install",
    ],
    { stdio: "inherit" },
  );
}

/**
 * Delete blank-typescript leftovers that conflict with our expo-router setup:
 *
 *   - `App.tsx` — root component for non-expo-router apps; collides with
 *     expo-router's auto-detection of `src/app/`.
 *   - `index.ts` — root entry shipped by blank-typescript: imports `./App`
 *     and calls `registerRootComponent`. We set `package.json#main` to
 *     `expo-router/entry` so this file is unused at runtime, but TypeScript
 *     still type-checks it and errors with `Cannot find module './App'`
 *     after we delete the file above.
 *
 * Idempotent (no-op if already absent).
 */
export function cleanupBlankTemplate(target: string): void {
  const removable = ["App.tsx", "index.ts"];
  for (const rel of removable) {
    const p = path.join(target, rel);
    if (fileExists(p)) {
      fs.rmSync(p);
      log.step(`Removed blank-typescript ${rel} (replaced by expo-router src/app/).`);
    }
  }
}

/**
 * Move create-expo-app's root `assets/*.png` icons (icon, splash-icon,
 * adaptive-icon, favicon) into `src/assets/` so the project has a single
 * unified assets layout. Caller updates `app.json` paths separately (see
 * `patchAppJsonAssetPaths` in patch.ts).
 *
 * Idempotent — if the source file is missing (already moved or never existed),
 * skip it without erroring.
 */
export function moveExpoIconsIntoSrcAssets(target: string): void {
  const rootAssets = path.join(target, "assets");
  const srcAssets = path.join(target, "src", "assets");
  if (!fs.existsSync(rootAssets)) return;
  fs.mkdirSync(srcAssets, { recursive: true });

  const movableFiles = [
    "icon.png",
    "splash-icon.png",
    "adaptive-icon.png",
    "favicon.png",
  ];
  let moved = 0;
  for (const file of movableFiles) {
    const from = path.join(rootAssets, file);
    const to = path.join(srcAssets, file);
    if (fileExists(from) && !fileExists(to)) {
      fs.renameSync(from, to);
      moved++;
    }
  }

  // If root `assets/` is now empty (only icons lived there), remove it.
  try {
    const remaining = fs.readdirSync(rootAssets);
    if (remaining.length === 0) fs.rmdirSync(rootAssets);
  } catch {
    // Not empty (user-added content) → leave alone.
  }
  if (moved > 0) {
    log.step(`Moved ${moved} icon file(s) from assets/ to src/assets/.`);
  }
}
