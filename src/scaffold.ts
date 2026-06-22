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
 * Why `--yes` + `@latest`:
 *   - `@latest` dist-tag: npx re-resolves against the registry every run, so
 *     each scaffold pulls the newest `create-expo-app` (which ships the
 *     current Expo SDK template — `blank-typescript`'s `package.json` pins
 *     `"expo": "~<SDK>.0.0"` for the current SDK). No version pinning in
 *     this CLI; SDK bumps come "free" via the next `create-expo-app` release.
 *   - `--yes`: auto-accepts npx's "install X?" prompt for non-TTY contexts
 *     (slash-command flows). Does NOT itself force freshness — `@latest` does.
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
 * Move EVERYTHING create-expo-app drops in the root `assets/` directory into
 * `src/assets/` so the project has a single unified assets layout (Deviation
 * #22). Caller rewrites `app.json` paths separately (see
 * `patchAppJsonAssetPaths` in patch.ts).
 *
 * Moves all top-level entries rather than a hardcoded filename list: Expo
 * changes its template icon set across SDKs (e.g. SDK 56 replaced
 * `adaptive-icon.png` with `android-icon-foreground/background/monochrome.png`),
 * and a stale list left the new files behind in `assets/` while app.json was
 * rewritten to `src/assets/` — prebuild then failed with `ENOENT`. Moving the
 * whole directory's contents keeps disk + app.json in sync for any icon set.
 *
 * Idempotent — skips an entry whose destination already exists; if `assets/`
 * ends up empty it is removed.
 */
export function moveExpoIconsIntoSrcAssets(target: string): void {
  const rootAssets = path.join(target, "assets");
  const srcAssets = path.join(target, "src", "assets");
  if (!fs.existsSync(rootAssets)) return;
  fs.mkdirSync(srcAssets, { recursive: true });

  let moved = 0;
  for (const entry of fs.readdirSync(rootAssets)) {
    const from = path.join(rootAssets, entry);
    const to = path.join(srcAssets, entry);
    if (fs.existsSync(to)) continue; // collision — leave source in place
    fs.renameSync(from, to);
    moved++;
  }

  // If root `assets/` is now empty (everything moved), remove it.
  try {
    if (fs.readdirSync(rootAssets).length === 0) fs.rmdirSync(rootAssets);
  } catch {
    // Not empty (user-added content survived a collision) → leave alone.
  }
  if (moved > 0) {
    log.step(`Moved ${moved} asset(s) from assets/ to src/assets/.`);
  }
}
