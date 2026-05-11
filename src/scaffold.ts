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
 * Delete `App.tsx` shipped by blank-typescript — collides with expo-router's
 * auto-detection of `src/app/`. Idempotent (no-op if already absent).
 */
export function cleanupBlankTemplate(target: string): void {
  const appTsx = path.join(target, "App.tsx");
  if (fileExists(appTsx)) {
    fs.rmSync(appTsx);
    log.step("Removed blank-typescript App.tsx (replaced by expo-router src/app/).");
  }
}
