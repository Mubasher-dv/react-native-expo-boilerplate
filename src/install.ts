// Phase 7 step 2 — `installNativeDeps` + `retryWithIsolation`.
// Phase 8 step 1 — `ensureLockfile`.

import fs from "node:fs";
import path from "node:path";
import { execa } from "execa";
import type { Answers, PackageManager } from "./prompts.js";
import { log } from "./util.js";

// ---------- always-installed list (SPEC §7 + Deviation #4) ----------

export function buildAlwaysInstalledList(workletsPkg: string): string[] {
  return [
    // From plan §7
    "@reduxjs/toolkit",
    "react-redux",
    "redux-persist",
    "react-native-mmkv",
    "@tanstack/react-query",
    "axios",
    "formik",
    "yup",
    "expo-router",
    "expo-dev-client",
    "react-native-safe-area-context",
    "react-native-gesture-handler",
    "react-native-screens",
    "react-native-reanimated",
    workletsPkg, // react-native-worklets or -core per Phase 0 Probe 3
    "react-native-keyboard-controller",
    "react-error-boundary",
    "react-native-responsive-fontsize",
    "@expo/vector-icons",
    "@shopify/flash-list",
    // Deviation #4 (docs/MIRROR_NOTES.md) — needed by mirrored components
    "expo-device",
    "expo-image",
    "expo-font",
    "expo-linear-gradient",
    "react-native-logs",
    "react-native-reanimated-skeleton",
    // Deviation #7 — Phase 7 patchBabel injects ["module-resolver", { alias }];
    // Metro fails on first bundle if the plugin pkg isn't installed.
    "babel-plugin-module-resolver",
    // Deviation #11 — expo-router peer deps that `expo install expo-router`
    // does NOT auto-install (Metro fails at bundle time with "Unable to
    // resolve 'expo-linking' from .../expo-router/build/views/Unmatched.js").
    "expo-linking",
    "expo-constants",
    // Deviation #18 — react-native-mmkv 3.x+ peer deps + system-ui.
    // mmkv was rewritten on Nitro Modules; without `react-native-nitro-modules`,
    // gradle fails with "Project with path ':react-native-nitro-modules' could
    // not be found in project ':react-native-mmkv'" and CocoaPods fails with
    // "Unable to find a specification for `NitroModules` depended upon by `NitroMmkv`".
    "react-native-nitro-modules",
    // expo-system-ui is required by `expo prebuild` for `userInterfaceStyle`
    // in app.json (default value "light"). Without it, prebuild warns:
    // "Install expo-system-ui in your project to enable this feature."
    "expo-system-ui",
    // expo-build-properties — config plugin that pins iOS `deploymentTarget`
    // (and android minSdkVersion) at prebuild time. Required to silence
    // CocoaPods deployment-version-mismatch warnings on transitive pods that
    // declare older iOS minimums (e.g. SDWebImage 5.x — pulled by expo-image —
    // declares iOS 9.0 vs the Expo SDK 54 project default of 15.1). Plugin
    // entry is wired in `patchAppJsonBuildProperties` (patch.ts).
    "expo-build-properties",
  ];
}

export function buildConditionalDeps(answers: Answers): string[] {
  const out: string[] = [];
  if (answers.bottomSheet) out.push("@gorhom/bottom-sheet");
  if (answers.imagePicker) out.push("expo-image-picker");
  return out;
}

// ---------- error classification ----------

const TRANSIENT_MARKERS = [
  "ETIMEDOUT",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "socket hang up",
  "network",
  "registry returned 5",
  "503",
  "502",
];

export function isTransientError(stderr: string): boolean {
  const lower = stderr.toLowerCase();
  return TRANSIENT_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

const FAILING_DEP_PATTERNS: RegExp[] = [
  /(?:Cannot find|Could not resolve|No matching version for|Conflicting peer dependency for)\s+["']?([@\w/.-]+)["']?/i,
  /version resolution failed for\s+["']?([@\w/.-]+)["']?/i,
];

/**
 * Extract the name of the failing dep from Expo CLI stderr. Returns the name
 * only if it matches one of `remaining` (defends against false positives like
 * package names mentioned in surrounding diagnostic context). Returns null on
 * unparseable input.
 */
export function parseFailingDep(stderr: string, remaining: string[]): string | null {
  for (const re of FAILING_DEP_PATTERNS) {
    const m = stderr.match(re);
    if (m && remaining.includes(m[1])) return m[1];
  }
  // Last-mention fallback: scan stderr for any `remaining` package name; return the last one mentioned.
  // No `\b` boundary — scoped package names start with `@`, which is non-word so
  // `\b@tanstack` would never match. Use `(^|[^@\w/-])` instead so we don't
  // accidentally match a substring inside another package path.
  let lastIdx = -1;
  let lastDep: string | null = null;
  for (const dep of remaining) {
    const escaped = dep.replace(/[/\-^$.*+?()[\]{}|\\]/g, "\\$&");
    const re = new RegExp(`(^|[^@\\w/-])${escaped}([^@\\w/-]|$)`, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(stderr)) !== null) {
      if (match.index > lastIdx) {
        lastIdx = match.index;
        lastDep = dep;
      }
    }
  }
  return lastDep;
}

// ---------- expo install with retry ----------

export type InstallResult = { ok: true } | { ok: false; reason: string };

export async function retryWithIsolation(
  target: string,
  deps: string[],
  pmFlag: string | null,
): Promise<void> {
  let remaining = [...deps];
  const failedTwice = new Set<string>();
  let lastStderr = "";

  while (remaining.length > 0) {
    const args = ["--yes", "expo", "install", ...remaining];
    if (pmFlag) args.push(pmFlag);
    const result = await execa("npx", args, { cwd: target, reject: false });
    if (result.exitCode === 0) return;
    lastStderr = result.stderr ?? "";
    if (isTransientError(lastStderr)) {
      throw new Error(
        `Network failure during expo install — check connection and retry. ` +
          `Target dir preserved; re-run CLI to retry.\n${lastStderr}`,
      );
    }
    const culprit = parseFailingDep(lastStderr, remaining);
    if (!culprit) {
      throw new Error(`Install failed with unparseable stderr:\n${lastStderr}`);
    }
    if (failedTwice.has(culprit)) {
      throw new Error(`'${culprit}' failed twice; aborting.\n${lastStderr}`);
    }
    failedTwice.add(culprit);
    remaining = remaining.filter((d) => d !== culprit);
    log.warn(`expo install: dropping '${culprit}' and retrying remaining ${remaining.length}`);
  }
  if (failedTwice.size > 0) {
    throw new Error(
      `Could not install: ${[...failedTwice].join(", ")}\n${lastStderr}`,
    );
  }
}

// ---------- main entry ----------

export type InstallNativeDepsOpts = {
  flagsOk: boolean; // Phase 0 Probe 5
  workletsPkg: "react-native-worklets" | "react-native-worklets-core";
};

/**
 * Phase 7 step 2 — single `expo install` call (with PM-flag or pre-seeded
 * lockfile per Phase 0 probe outcome). On atomic failure, falls back to
 * `retryWithIsolation` for deterministic errors only.
 */
export async function installNativeDeps(
  target: string,
  answers: Answers,
  opts: InstallNativeDepsOpts,
): Promise<void> {
  const allDeps = [
    ...buildAlwaysInstalledList(opts.workletsPkg),
    ...buildConditionalDeps(answers),
  ];

  // Branch A: pass --yarn / --npm flag.
  // Branch B: pre-seed lockfile, run without flag.
  let pmFlag: string | null = null;
  if (opts.flagsOk) {
    pmFlag = answers.packageManager === "yarn" ? "--yarn" : "--npm";
  } else {
    seedLockfile(target, answers.packageManager);
  }

  // Pre-install: materialize `expo` package so `expo install` can read SDK
  // version. create-expo-app was invoked with `--no-install`, so node_modules
  // is empty at this point. `expo install` itself shells out to `expo` (a
  // local module) and refuses to run without it.
  const pmCmd = answers.packageManager === "yarn" ? "yarn" : "npm";
  log.step(`Materializing template deps via ${pmCmd} install…`);
  await execa(pmCmd, ["install"], { cwd: target, stdio: "inherit" });

  log.step(`Installing ${allDeps.length} native deps via expo install (${answers.packageManager})…`);
  const args = ["--yes", "expo", "install", ...allDeps];
  if (pmFlag) args.push(pmFlag);

  const result = await execa("npx", args, {
    cwd: target,
    stdio: "inherit",
    reject: false,
  });

  if (result.exitCode !== 0) {
    // stdio: inherit means we don't have stderr captured. Re-run silently to capture.
    const verbose = await execa("npx", args, { cwd: target, reject: false });
    const stderr = verbose.stderr ?? "";
    if (isTransientError(stderr)) {
      throw new Error(
        `Network failure during expo install — check connection and retry. ` +
          `Target dir preserved; re-run CLI to retry.\n${stderr}`,
      );
    }
    log.warn("expo install failed atomically — falling back to retryWithIsolation");
    await retryWithIsolation(target, allDeps, pmFlag);
  }
}

/**
 * Phase 7 step 2 Branch B — pre-seed the chosen PM's lockfile so Expo CLI
 * auto-detects PM from lockfile presence (when `--yarn`/`--npm` flag is absent
 * in installed @expo/cli).
 */
export function seedLockfile(target: string, pm: PackageManager): void {
  if (pm === "yarn") {
    const p = path.join(target, "yarn.lock");
    if (!fs.existsSync(p)) fs.writeFileSync(p, "");
  } else {
    const p = path.join(target, "package-lock.json");
    if (!fs.existsSync(p)) {
      const minimalNpmLock = {
        name: path.basename(target),
        version: "1.0.0",
        lockfileVersion: 3,
        requires: true,
        packages: {},
      };
      fs.writeFileSync(p, JSON.stringify(minimalNpmLock, null, 2) + "\n");
    }
  }
}

// ---------- Phase 8 step 1: ensureLockfile ----------

export type EnsureLockfileOpts = {
  /** Phase 0 Probe 7 — when false, run explicit `<pm> install` before verifying. */
  probePass: boolean;
  /** Phase 0 Probe 5 — affects which Branch error message fires on dual lockfile. */
  flagsOk: boolean;
};

export type EnsureLockfileOutcome = {
  /** The PM Expo CLI actually produced a lockfile for. May differ from `answers.packageManager` (mismatch case). */
  producedPm: PackageManager;
  /** True when produced PM differs from requested PM (loud non-fatal warning emitted). */
  mismatch: boolean;
};

export async function ensureLockfile(
  target: string,
  answers: Answers,
  opts: EnsureLockfileOpts,
): Promise<EnsureLockfileOutcome> {
  if (!opts.probePass) {
    const installCmd = answers.packageManager === "yarn" ? "yarn" : "npm";
    log.step(`Phase 0 probe indicated explicit ${installCmd} install needed; running…`);
    await execa(installCmd, ["install"], { cwd: target, stdio: "inherit" });
  }

  const yarnLock = path.join(target, "yarn.lock");
  const npmLock = path.join(target, "package-lock.json");
  const yarnExists = fs.existsSync(yarnLock);
  const npmExists = fs.existsSync(npmLock);

  if (!yarnExists && !npmExists) {
    throw new Error(
      "ensureLockfile: install completed but no lockfile present. " +
        "expo install may have failed silently — check stderr above.",
    );
  }

  if (yarnExists && npmExists) {
    if (opts.flagsOk) {
      throw new Error(
        "Both yarn.lock and package-lock.json present after expo install --<pm> succeeded. " +
          "Installed Expo CLI version is not honoring the PM flag. " +
          "File an issue with Expo CLI version (npx expo --version) + this CLI's version.",
      );
    } else {
      throw new Error(
        "Both yarn.lock and package-lock.json present after lockfile pre-seed. " +
          "expo install created the other PM's lockfile, ignoring the seed. " +
          `Re-run with EXPO_PACKAGE_MANAGER=${answers.packageManager === "yarn" ? "npm" : "yarn"} as a workaround; file an issue.`,
      );
    }
  }

  const producedPm: PackageManager = yarnExists ? "yarn" : "npm";
  const mismatch = producedPm !== answers.packageManager;
  if (mismatch) {
    const other = answers.packageManager === "yarn" ? "package-lock.json" : "yarn.lock";
    log.warn(
      `⚠️  PM MISMATCH: requested ${answers.packageManager} but Expo CLI produced ${other}.\n` +
        `Installed Expo CLI version likely ignored the PM flag/seed.\n` +
        `Recovery options:\n` +
        `  (1) Accept the produced PM — your project is functional.\n` +
        `  (2) Re-run with EXPO_PACKAGE_MANAGER=${producedPm} to align config with reality.\n` +
        `  (3) Delete ${other}, then run \`${answers.packageManager} install\` manually.`,
    );
  }
  return { producedPm, mismatch };
}
