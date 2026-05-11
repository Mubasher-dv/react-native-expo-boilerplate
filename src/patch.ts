// Patcher set per PLAN_V5.md Phases 4 (app.json, expo-router entry),
// 5 (constants, app.json plugins), 6 (layout/fonts sentinels), 7 (package.json
// scripts, tsconfig, babel.config).
//
// Patches MUST be idempotent — re-running the CLI on the same target after a
// mid-phase failure must converge (Phase 7 "Cross-cutting" subsection).

import fs from "node:fs";
import path from "node:path";
import fse from "fs-extra";
import { applySentinels, type SentinelReplacements } from "./overlay.js";
import type { Answers } from "./prompts.js";
import { fileExists, log } from "./util.js";

// ---------- helpers ----------

/** Convert a free-form app name to an Expo `scheme` (lower-kebab-case, alnum + `-`). */
export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip diacritics
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "app"
  );
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function writeJson(p: string, value: unknown): void {
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + "\n");
}

// ---------- app.json ----------

type ExpoAppJson = {
  expo: {
    name?: string;
    slug?: string;
    scheme?: string;
    plugins?: Array<string | [string, Record<string, unknown>]>;
    [key: string]: unknown;
  };
};

const nameOf = (entry: unknown): string =>
  Array.isArray(entry) ? String(entry[0]) : String(entry);

/**
 * Phase 4 step 7 — set `expo.scheme = slugify(name)`, add `"expo-router"` to
 * `expo.plugins` if missing. Uses `nameOf` equality predicate so a user-customized
 * `["expo-router", {...options}]` entry is preserved (matches Phase 5 step 5).
 */
export function patchAppJson(
  target: string,
  name: string,
  _answers: Answers,
): void {
  const p = path.join(target, "app.json");
  if (!fileExists(p)) {
    throw new Error(`patchAppJson: ${p} not found.`);
  }
  const json = readJson<ExpoAppJson>(p);
  json.expo ??= {};
  json.expo.scheme = slugify(name);
  json.expo.plugins ??= [];
  if (!json.expo.plugins.some((e) => nameOf(e) === "expo-router")) {
    json.expo.plugins.push("expo-router");
  }
  writeJson(p, json);
}

/**
 * Phase 5 step 5 — add image-picker plugin entry conditionally. Idempotent via
 * `nameOf` equality (user-customized options object preserved).
 */
export function patchAppJsonPlugins(target: string, answers: Answers): void {
  if (!answers.imagePicker) return;
  const p = path.join(target, "app.json");
  const json = readJson<ExpoAppJson>(p);
  json.expo ??= {};
  json.expo.plugins ??= [];
  const entry: [string, Record<string, unknown>] = [
    "expo-image-picker",
    {
      photosPermission:
        "The app accesses your photos to let you share them with your friends.",
    },
  ];
  if (!json.expo.plugins.some((e) => nameOf(e) === nameOf(entry))) {
    json.expo.plugins.push(entry);
  }
  writeJson(p, json);
}

// ---------- expo-router entry + tsconfig.extends ----------

/**
 * Phase 4 step 8 — set `package.json#main` to `expo-router/entry` + ensure
 * tsconfig extends `expo/tsconfig.base`.
 */
export function patchExpoRouterEntry(target: string): void {
  const pkgPath = path.join(target, "package.json");
  const pkg = readJson<{ main?: string; [k: string]: unknown }>(pkgPath);
  pkg.main = "expo-router/entry";
  writeJson(pkgPath, pkg);

  const tsPath = path.join(target, "tsconfig.json");
  if (fileExists(tsPath)) {
    const ts = readJson<{ extends?: string; [k: string]: unknown }>(tsPath);
    if (!ts.extends) ts.extends = "expo/tsconfig.base";
    writeJson(tsPath, ts);
  }
}

// ---------- constants splice (Phase 5 step 4) ----------

/**
 * Always runs — drops the `@@MEDIA_CONSTANTS@@` sentinel line cleanly even
 * when `imagePicker === false` (fixes v3 orphan-sentinel bug). Splices the
 * media-constants snippet on `imagePicker === true`.
 */
export function patchConstants(
  target: string,
  templatesRoot: string,
  answers: Answers,
): void {
  const p = path.join(target, "src/core/utils/constants.ts");
  if (!fileExists(p)) {
    throw new Error(`patchConstants: ${p} missing — was applyBase run first?`);
  }
  const source = fs.readFileSync(p, "utf8");
  let replacement = "";
  if (answers.imagePicker) {
    const sp = path.join(
      templatesRoot,
      "image-picker/media-constants.snippet.ts",
    );
    replacement = fs.readFileSync(sp, "utf8").trimEnd();
  }
  const out = applySentinels(source, { MEDIA_CONSTANTS: replacement }, p);
  fs.writeFileSync(p, out);
}

// ---------- layout + fonts splice (Phase 6 step 4) ----------

export function patchLayout(
  target: string,
  replacements: SentinelReplacements,
): void {
  const layoutPath = path.join(target, "src/app/_layout.tsx");
  const fontsPath = path.join(target, "src/ui/theme/fonts.ts");
  for (const p of [layoutPath, fontsPath]) {
    if (!fileExists(p)) {
      throw new Error(`patchLayout: ${p} missing — was applyBase run first?`);
    }
    const before = fs.readFileSync(p, "utf8");
    const after = applySentinels(before, replacements, p);
    fs.writeFileSync(p, after);
  }
}

// ---------- package.json scripts (Phase 7 step 1) ----------

export function patchPackageJsonScripts(target: string): void {
  const p = path.join(target, "package.json");
  const pkg = readJson<{
    main?: string;
    expo?: unknown;
    scripts?: Record<string, string>;
    [k: string]: unknown;
  }>(p);
  pkg.scripts ??= {};
  const want: Record<string, string> = {
    start: "expo start",
    android: "expo start --android",
    ios: "expo start --ios",
    web: "expo start --web",
    lint: "expo lint",
  };
  for (const [k, v] of Object.entries(want)) {
    if (!(k in pkg.scripts)) pkg.scripts[k] = v;
  }
  writeJson(p, pkg);
}

// ---------- tsconfig paths (Phase 7 step 3) ----------

type TsConfig = {
  extends?: string;
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

/**
 * SPEC §9 path aliases.
 * `@/*` is a catchall resolving to `src/*`; longer specifics map to their
 * concrete dirs. Identity-mirrored from MyRoster naming so mirrored imports
 * resolve unchanged in the generated app.
 */
const SPEC_PATHS: Record<string, string[]> = {
  "@/*": ["src/*"],
  "@theme/*": ["src/ui/theme/*"],
  "@utils/*": ["src/core/utils/*"],
  "@redux/*": ["src/core/redux/*"],
  "@core/*": ["src/core/*"],
  "@services/*": ["src/core/services/*"],
  "@hooks/*": ["src/core/hooks/*"],
  "@appComponents/*": ["src/ui/appComponents/*"],
  "@components/*": ["src/ui/components/*"],
  "@icons/*": ["src/ui/iconComponents/*"],
  "@features/*": ["src/features/*"],
  "@assets": ["assets"],
};

/**
 * Phase 7 step 3 — patch tsconfig:
 *   - Preserve `extends: "expo/tsconfig.base"`.
 *   - baseUrl resolution (3-tier):
 *       1. user already set → preserve.
 *       2. expo/tsconfig.base provides one (Phase 0 probe `EXPO_TSCONFIG_BASEURL` ≠ null) → no-op.
 *       3. else → set "." here.
 *   - Deep-merge `compilerOptions.paths` with SPEC §9 aliases; preserve user's existing aliases.
 *   - Detect `@/*` collision (user already mapped `@/*` to non-`src/*` target) → warn + skip our `@/*`.
 *
 * `expoBaseUrlInherited` is read from Phase 0 SDK_NOTES at runtime by the caller.
 */
export function patchTsconfig(
  target: string,
  opts: { expoBaseUrlInherited: boolean },
): void {
  const p = path.join(target, "tsconfig.json");
  const ts = fileExists(p) ? readJson<TsConfig>(p) : {};
  if (!ts.extends) ts.extends = "expo/tsconfig.base";
  ts.compilerOptions ??= {};

  // baseUrl 3-tier resolution.
  const userBaseUrl = ts.compilerOptions.baseUrl;
  if (!userBaseUrl && !opts.expoBaseUrlInherited) {
    ts.compilerOptions.baseUrl = ".";
  }

  // paths deep-merge with collision detection.
  ts.compilerOptions.paths ??= {};
  for (const [alias, defaultTargets] of Object.entries(SPEC_PATHS)) {
    if (alias in ts.compilerOptions.paths) {
      // User-defined value — only warn on the `@/*` catchall collision case.
      const existing = ts.compilerOptions.paths[alias];
      if (alias === "@/*" && JSON.stringify(existing) !== JSON.stringify(defaultTargets)) {
        log.warn(
          `tsconfig.json compilerOptions.paths["@/*"] already set to ${JSON.stringify(
            existing,
          )}; preserving user value (template imports assume "src/*").`,
        );
      }
      continue;
    }
    ts.compilerOptions.paths[alias] = defaultTargets;
  }

  writeJson(p, ts);
}

// ---------- babel.config.js (Phase 7 step 4) ----------
// Implemented in src/babel.ts to keep AST plumbing in one file.

// ---------- file copy helpers (for tests) ----------

/** Copy a single file into the target dir (preserving relative path). */
export function copyInto(target: string, srcAbs: string, relInside: string): void {
  const dst = path.join(target, relInside);
  fse.ensureDirSync(path.dirname(dst));
  fse.copySync(srcAbs, dst);
}
