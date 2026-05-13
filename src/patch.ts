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

/**
 * Build a reverse-DNS bundle identifier segment from the app name.
 *
 * Android `package` + iOS `bundleIdentifier` constraints:
 *   - Lowercase letters / digits only per segment.
 *   - No dashes, dots, or other punctuation INSIDE a segment.
 *   - Each segment must START with a letter (no leading digits).
 *   - At least two segments separated by dots.
 *
 * `my-test-app` → `mytestapp` → final ID `com.mytestapp`.
 * `1pp` → `app1pp` (leading-digit guard).
 */
export function bundleIdSegment(name: string): string {
  let seg = slugify(name).replace(/-/g, "");
  if (!/^[a-z]/.test(seg)) seg = `app${seg}`;
  return seg || "app";
}

/** Compose the full bundle identifier — `com.<safeName>` (no app-author namespace). */
export function bundleIdFor(name: string): string {
  return `com.${bundleIdSegment(name)}`;
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
    icon?: string;
    splash?: { image?: string; [k: string]: unknown };
    android?: {
      package?: string;
      adaptiveIcon?: { foregroundImage?: string; [k: string]: unknown };
      [k: string]: unknown;
    };
    ios?: { bundleIdentifier?: string; [k: string]: unknown };
    web?: { favicon?: string; [k: string]: unknown };
    plugins?: Array<string | [string, Record<string, unknown>]>;
    [key: string]: unknown;
  };
};

const nameOf = (entry: unknown): string =>
  Array.isArray(entry) ? String(entry[0]) : String(entry);

/**
 * Phase 4 step 7 — set `expo.name`, `expo.slug`, `expo.scheme = slugify(name)`,
 * add `"expo-router"` to `expo.plugins` if missing. Uses `nameOf` equality
 * predicate so a user-customized `["expo-router", {...options}]` entry is
 * preserved (matches Phase 5 step 5).
 *
 * `expo.name` + `expo.slug` are also set by create-expo-app from the positional
 * dir arg — we set them again here (defense in depth) so the values are
 * guaranteed even if upstream changes its naming heuristic.
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
  json.expo.name = name;
  json.expo.slug = slugify(name);
  json.expo.scheme = slugify(name);

  // android.package + ios.bundleIdentifier — required to launch the app on
  // either platform (Expo CLI errors with "Required property ... is not found"
  // otherwise). Preserve any user-set value; only fill when missing.
  const bundleId = bundleIdFor(name);
  json.expo.ios ??= {};
  if (!json.expo.ios.bundleIdentifier) json.expo.ios.bundleIdentifier = bundleId;
  json.expo.android ??= {};
  if (!json.expo.android.package) json.expo.android.package = bundleId;

  json.expo.plugins ??= [];
  if (!json.expo.plugins.some((e) => nameOf(e) === "expo-router")) {
    json.expo.plugins.push("expo-router");
  }
  writeJson(p, json);
}

/**
 * Rewrite `app.json` asset paths from create-expo-app's `./assets/<file>`
 * defaults to `./src/assets/<file>` (Deviation #22 — unified asset layout).
 *
 * Pairs with `moveExpoIconsIntoSrcAssets` in scaffold.ts (which moves the
 * actual PNG files). Idempotent: only rewrites paths that start with `./assets/`,
 * so re-running on an already-patched app.json is a no-op.
 */
export function patchAppJsonAssetPaths(target: string): void {
  const p = path.join(target, "app.json");
  if (!fileExists(p)) return;
  const json = readJson<ExpoAppJson>(p);
  json.expo ??= {};

  const rewrite = (value: string | undefined): string | undefined => {
    if (!value) return value;
    if (value.startsWith("./assets/")) {
      return value.replace(/^\.\/assets\//, "./src/assets/");
    }
    return value;
  };

  if (json.expo.icon) json.expo.icon = rewrite(json.expo.icon)!;
  if (json.expo.splash?.image) {
    json.expo.splash.image = rewrite(json.expo.splash.image)!;
  }
  if (json.expo.android?.adaptiveIcon?.foregroundImage) {
    json.expo.android.adaptiveIcon.foregroundImage = rewrite(
      json.expo.android.adaptiveIcon.foregroundImage,
    )!;
  }
  if (json.expo.web?.favicon) {
    json.expo.web.favicon = rewrite(json.expo.web.favicon)!;
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
      cameraPermission:
        "The app accesses your camera to let you take photos to share.",
      // microphone optional — only set if app records video. Add manually:
      //   "microphonePermission": "...",
    },
  ];
  if (!json.expo.plugins.some((e) => nameOf(e) === nameOf(entry))) {
    json.expo.plugins.push(entry);
  }
  writeJson(p, json);
}

/**
 * Pin iOS / Android native build properties at prebuild time via the
 * `expo-build-properties` config plugin.
 *
 * Why: CocoaPods (Xcode 26+ toolchain) emits a deployment-version-mismatch
 * warning when a transitive pod declares an older iOS minimum than the
 * project's effective target. `expo-image` (always installed — see
 * `buildAlwaysInstalledList`) pulls `SDWebImage` 5.x, whose podspec declares
 * `platform :ios, '9.0'`, well below the Expo SDK 54 default of 15.1. Setting
 * `ios.deploymentTarget` here makes `expo prebuild` emit a Podfile that
 * normalizes every pod to the same minimum, silencing the warning.
 *
 * Values:
 * - `ios.deploymentTarget: "15.1"` — matches Expo SDK 54's default. Explicit
 *   so the value is stable across SDK bumps (and visible in app.json review).
 * - `android.minSdkVersion: 24` — also Expo SDK 54 default; pinned for parity.
 *
 * Idempotent via `nameOf` equality (preserves a user-customized entry).
 */
export function patchAppJsonBuildProperties(target: string): void {
  const p = path.join(target, "app.json");
  const json = readJson<ExpoAppJson>(p);
  json.expo ??= {};
  json.expo.plugins ??= [];
  const entry: [string, Record<string, unknown>] = [
    "expo-build-properties",
    {
      ios: { deploymentTarget: "15.1" },
      android: { minSdkVersion: 24 },
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

// ---------- layout splice (Phase 6 step 4) ----------
// Deviation #10: `fonts.ts` ships as a static enum file (no FONTS_OBJECT
// sentinel), so this only touches `_layout.tsx`.

export function patchLayout(
  target: string,
  replacements: SentinelReplacements,
): void {
  const layoutPath = path.join(target, "src/app/_layout.tsx");
  if (!fileExists(layoutPath)) {
    throw new Error(`patchLayout: ${layoutPath} missing — was applyBase run first?`);
  }
  const before = fs.readFileSync(layoutPath, "utf8");
  const after = applySentinels(before, replacements, layoutPath);
  fs.writeFileSync(layoutPath, after);
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
  // Use `run:android` / `run:ios` so first invocation builds + installs the
  // custom dev-client (we ship `expo-dev-client` + `react-native-mmkv`, both
  // Expo-Go-incompatible). `expo start --android` would error with "No
  // development build for this project is installed" otherwise.
  // `start` uses `--dev-client` so subsequent runs (after first build)
  // connect to the installed client correctly.
  const want: Record<string, string> = {
    start: "expo start --dev-client",
    android: "expo run:android",
    ios: "expo run:ios",
    web: "expo start --web",
    lint: "expo lint",
    prebuild: "expo prebuild",
  };
  for (const [k, v] of Object.entries(want)) {
    if (!(k in pkg.scripts)) pkg.scripts[k] = v;
  }
  // Force-update if upstream defaults from create-expo-app are present (so
  // existing scaffolds re-running the CLI also get the corrected scripts).
  const stale: Record<string, string> = {
    "expo start": "expo start --dev-client",
    "expo start --android": "expo run:android",
    "expo start --ios": "expo run:ios",
  };
  for (const [scriptName, current] of Object.entries(pkg.scripts)) {
    if (scriptName in want && stale[current] === want[scriptName]) {
      pkg.scripts[scriptName] = want[scriptName];
    }
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
  "@assets": ["src/assets"],
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

// ---------- generated-app README ----------

/**
 * Patch the `README.md` overlaid by `applyBase` (templates/base/README.md):
 * replaces the app-name placeholder with the resolved app name.
 *
 * Supports two placeholder variants so markdown autoformatters can't break
 * the template:
 *   - `**APP_NAME**`  — current template form (bold-asterisk syntax)
 *   - `__APP_NAME__`  — legacy form (bold-underscore syntax). Some editors /
 *     Prettier configs auto-rewrite `__X__` → `**X**` on save, which would
 *     silently break the placeholder — supporting both keeps generators
 *     functional across template revisions.
 *
 * Idempotent: if neither placeholder is present (already patched, or user
 * replaced the file), this is a no-op. Safe to re-run mid-scaffold without
 * clobbering user edits to the README body.
 */
export function patchReadme(target: string, name: string): void {
  const p = path.join(target, "README.md");
  if (!fileExists(p)) return;
  const before = fs.readFileSync(p, "utf8");
  const after = before
    .replaceAll("**APP_NAME**", name)
    .replaceAll("__APP_NAME__", name);
  if (after === before) return;
  fs.writeFileSync(p, after);
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
