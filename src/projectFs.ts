// Shared project-fs utilities. Hoisted from add.ts to eliminate circular-import
// risk between fontsInstaller.ts and add.ts (add.ts may import fontsInstaller
// for regenerateFontsMarkerBlock; fontsInstaller must NOT pull add.ts back in).

import fs from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { detectPackageManager, type PackageManager } from "./prompts.js";
import { fileExists, log } from "./util.js";

// Re-export so callers can do `import { fileExists } from "./projectFs.js";`
// while util.ts stays the single implementation source.
export { fileExists };

export function hasExpoSplashScreenDep(target: string): boolean {
  const pkgPath = path.join(target, "package.json");
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return Boolean(pkg.dependencies?.["expo-splash-screen"] || pkg.devDependencies?.["expo-splash-screen"]);
  } catch {
    return false;
  }
}

export function assertExpoApp(target: string): void {
  const pkgPath = path.join(target, "package.json");
  if (!fileExists(pkgPath)) {
    throw new Error(
      `Not an Expo project: package.json missing in ${target}. ` +
        `Run from the project root.`,
    );
  }
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as typeof pkg;
  } catch {
    throw new Error(`Not an Expo project: package.json in ${target} is not valid JSON.`);
  }
  if (!pkg.dependencies?.expo && !pkg.devDependencies?.expo) {
    throw new Error(
      `Not an Expo project: "expo" not found in dependencies or devDependencies in ${target}/package.json. ` +
        `Run from the project root.`,
    );
  }
}

export async function detectProjectPm(target: string): Promise<PackageManager> {
  if (fileExists(path.join(target, "yarn.lock"))) return "yarn";
  if (fileExists(path.join(target, "package-lock.json"))) return "npm";
  log.warn("No lockfile detected; falling back to host PM probe.");
  return detectPackageManager();
}

/**
 * Single-package `expo install` wrapper. Matches the original inline behavior
 * from add.ts exactly:
 *   - `--yes` first arg to npx — suppresses "Ok to proceed?" prompt when
 *     expo isn't cached (load-bearing for non-TTY / CI).
 *   - PM flag as `--yarn` or `--npm` (not `--<pm>`) — historical convention.
 *   - execa default reject (no `reject: false`) → throws on non-zero exit.
 */
export async function expoInstall(
  target: string,
  pkg: string,
  pm: PackageManager,
): Promise<void> {
  const args = ["--yes", "expo", "install", pkg, pm === "yarn" ? "--yarn" : "--npm"];
  const result = await execa("npx", args, { cwd: target, stdio: "inherit" });
  if (result.exitCode !== 0) {
    throw new Error(`expo install ${pkg} failed (exit ${result.exitCode}).`);
  }
}
