// Post-scaffold `add` / `generate` subcommands — retrofit a **recipe** into
// an already-scaffolded project without re-running the full scaffolder.
//
// Vocabulary: this dispatcher handles **recipes** — packaged units of change.
// A recipe is one of:
//   - **library recipe** — third-party package + boilerplate (component
//     overlay / constants splice / app.json plugin).
//     Examples: `bottom-sheet`, `image-picker`.
//   - **asset recipe** — interactive prompts for project assets / native config.
//     Examples: `app-icon`, `splash`.
// The word "feature" is reserved for a future namespace covering app modules
// (`auth`, `home`, …).
//
// Surfaces (CLI dispatch in src/index.ts) — `add`, `generate`, `g` are
// aliases of the same dispatcher (short forms for user ergonomics):
//   codingpixel-expo-app add bottom-sheet
//   codingpixel-expo-app generate bottom-sheet
//   codingpixel-expo-app g bottom-sheet
//   codingpixel-expo-app add image-picker
//   codingpixel-expo-app g app-icon
//   codingpixel-expo-app g splash
//
// Cwd-based: each call treats `process.cwd()` as the target project. Refuses
// to run if `app.json` is missing (best-effort guard against running outside
// an Expo project).
//
// Idempotent:
//   - File overlays use `copySync({ overwrite: true })` — re-running clobbers
//     user edits to the template files (same semantics as initial scaffold).
//   - Plugin entry guards on `nameOf` equality (skipped if user already added).
//   - Constants splice guards on `MEDIA_TYPES` regex (skipped if already spliced).
//   - `expo install` is a no-op when the dep is already at SDK-compatible version.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import prompts from "prompts";
import { applyBottomSheet, applyImagePicker } from "./overlay.js";
import type { PackageManager } from "./prompts.js";
import { detectPackageManager } from "./prompts.js";
import { ensureDir, fileExists, log } from "./util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveTemplatesRoot(): string {
  return path.resolve(__dirname, "..", "templates");
}

/**
 * Reject early if the target is not an Expo project. `app.json` is the
 * minimum signal; we don't require `src/` because the user may have moved
 * things around — only the constants splice (image-picker only) hard-depends
 * on `src/core/utils/constants.ts`, and it errors loudly if that's missing.
 */
function assertExpoApp(target: string): void {
  if (!fileExists(path.join(target, "app.json"))) {
    throw new Error(
      `Not an Expo project: app.json missing in ${target}. ` +
        `Run \`add\` from the project root.`,
    );
  }
}

/**
 * Determine PM from the project's lockfile. Authoritative — `detectPackageManager`
 * probes the host machine, not the target project. Falls back to host probe
 * only when neither lockfile is present (shouldn't happen post-scaffold).
 */
async function detectProjectPm(target: string): Promise<PackageManager> {
  if (fileExists(path.join(target, "yarn.lock"))) return "yarn";
  if (fileExists(path.join(target, "package-lock.json"))) return "npm";
  log.warn("No lockfile detected; falling back to host PM probe.");
  return detectPackageManager();
}

/**
 * Single-package `expo install` wrapper. Passes the PM flag — modern Expo CLI
 * honors it; older versions may produce a mismatched lockfile, in which case
 * the user already has the issue from initial scaffold and is on their own.
 */
/**
 * Print the dev-client rebuild reminder. Both libraries ship native modules
 * (`@gorhom/bottom-sheet` and `expo-image-picker` both link native code) — the
 * JS dep install is not enough; the existing dev-client built before this `add`
 * command does not contain the new module's autolink, so Metro will fail at
 * runtime with "unable to resolve native module" until the user rebuilds.
 *
 * PM-aware: prints `yarn ios` vs `npm run ios` based on the project's lockfile.
 */
function printRebuildReminder(pm: PackageManager): void {
  const cmd = pm === "yarn" ? "yarn" : "npm run";
  log.raw("");
  log.warn("Rebuild the dev-client so the new native module links:");
  log.raw(`  ${cmd} ios       # builds + installs dev-client + launches (iOS)`);
  log.raw(`  ${cmd} android   # same for Android (needs emulator/device + Android SDK)`);
  log.raw("");
  log.info(
    "Skipping the rebuild leaves the old dev-client in place — the bundler will fail " +
      "at runtime with 'unable to resolve native module'.",
  );
}

async function expoInstall(
  target: string,
  pkg: string,
  pm: PackageManager,
): Promise<void> {
  const args = [
    "--yes",
    "expo",
    "install",
    pkg,
    pm === "yarn" ? "--yarn" : "--npm",
  ];
  const result = await execa("npx", args, { cwd: target, stdio: "inherit" });
  if (result.exitCode !== 0) {
    throw new Error(`expo install ${pkg} failed (exit ${result.exitCode}).`);
  }
}

// ---------- bottom-sheet ----------

export async function addBottomSheet(target: string): Promise<void> {
  assertExpoApp(target);
  const pm = await detectProjectPm(target);
  log.info(`Package manager: ${pm}`);

  log.step("Overlaying templates/bottom-sheet/ …");
  applyBottomSheet(target, resolveTemplatesRoot());

  log.step("Installing @gorhom/bottom-sheet via expo install …");
  await expoInstall(target, "@gorhom/bottom-sheet", pm);

  log.success("bottom-sheet added.");
  log.raw("");
  log.raw("Components available under @appComponents:");
  log.raw("  customBottomSheetModal");
  log.raw("  appBottomSheetView");
  log.raw("  appBottomSheetBackdrop");
  log.raw("  appBottomSheetScrollView");
  log.raw("  BottomSheetKeyboardAwareScrollView");
  printRebuildReminder(pm);
}

// ---------- image-picker ----------

type AppJsonPlugin = string | [string, Record<string, unknown>];
type ExpoAppJson = {
  expo?: {
    plugins?: AppJsonPlugin[];
    [k: string]: unknown;
  };
};

const pluginName = (entry: AppJsonPlugin): string =>
  Array.isArray(entry) ? String(entry[0]) : String(entry);

/**
 * Inline plugin patcher — same logic as `patchAppJsonPlugins` in patch.ts but
 * narrowed to image-picker and decoupled from `Answers`. Idempotent: skip if
 * an `expo-image-picker` entry (string OR array form) is already present.
 */
export function ensureImagePickerPlugin(target: string): void {
  const p = path.join(target, "app.json");
  const raw = fs.readFileSync(p, "utf8");
  const json = JSON.parse(raw) as ExpoAppJson;
  json.expo ??= {};
  json.expo.plugins ??= [];
  if (json.expo.plugins.some((e) => pluginName(e) === "expo-image-picker")) {
    log.info("expo-image-picker plugin already in app.json; skipping.");
    return;
  }
  json.expo.plugins.push([
    "expo-image-picker",
    {
      photosPermission:
        "The app accesses your photos to let you share them with your friends.",
      cameraPermission:
        "The app accesses your camera to let you take photos to share.",
    },
  ]);
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + "\n");
}

/**
 * Splice media constants into `src/core/utils/constants.ts`.
 *
 * Three states the file may be in:
 *   1. Sentinel `// @@MEDIA_CONSTANTS@@` still present (initial scaffold ran
 *      with imagePicker=false on an older CLI that left the sentinel) —
 *      replace the sentinel line with the snippet. (Legacy path.)
 *   2. `MEDIA_TYPES` already exported (image-picker previously added) —
 *      no-op.
 *   3. Otherwise (sentinel was dropped during scaffold per current behavior)
 *      — append snippet at EOF separated by blank line.
 */
export function spliceMediaConstants(target: string, templatesRoot: string): void {
  const p = path.join(target, "src/core/utils/constants.ts");
  if (!fileExists(p)) {
    throw new Error(
      `addImagePicker: ${p} missing — is this an unmodified scaffold?`,
    );
  }
  const current = fs.readFileSync(p, "utf8");
  if (/export\s+const\s+MEDIA_TYPES\b/.test(current)) {
    log.info("MEDIA_TYPES already present in constants.ts; skipping splice.");
    return;
  }
  const snippet = fs
    .readFileSync(
      path.join(templatesRoot, "image-picker/media-constants.snippet.ts"),
      "utf8",
    )
    .trimEnd();

  let out: string;
  if (/\/\/\s*@@MEDIA_CONSTANTS@@/.test(current)) {
    out = current.replace(/\/\/\s*@@MEDIA_CONSTANTS@@\s*$/m, snippet);
  } else {
    out = current.trimEnd() + "\n\n" + snippet + "\n";
  }
  fs.writeFileSync(p, out);
}

export async function addImagePicker(target: string): Promise<void> {
  assertExpoApp(target);
  const pm = await detectProjectPm(target);
  log.info(`Package manager: ${pm}`);

  const templatesRoot = resolveTemplatesRoot();

  log.step("Overlaying templates/image-picker/ …");
  applyImagePicker(target, templatesRoot);

  log.step("Splicing media constants into src/core/utils/constants.ts …");
  spliceMediaConstants(target, templatesRoot);

  log.step("Adding expo-image-picker plugin to app.json …");
  ensureImagePickerPlugin(target);

  log.step("Installing expo-image-picker via expo install …");
  await expoInstall(target, "expo-image-picker", pm);

  log.success("image-picker added.");
  log.raw("");
  log.raw("Service available: @services/PermissionService");
  log.raw("Constants available: @utils/constants → MEDIA_TYPES, IMAGE_PICKER_OPTIONS, CAMERA_OPTIONS");
  printRebuildReminder(pm);
}

// ---------- shared helpers for asset recipes (app-icon, splash) ----------

/**
 * Generic app.json mutator. Reads, applies `mut`, writes back with trailing
 * newline. All asset recipes go through this so the file format stays uniform
 * (2-space indent, trailing newline) — matches the writer in `writeJson` in
 * patch.ts.
 */
function mutateAppJson(target: string, mut: (json: ExpoAppJson) => void): void {
  const p = path.join(target, "app.json");
  const json = JSON.parse(fs.readFileSync(p, "utf8")) as ExpoAppJson;
  mut(json);
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + "\n");
}

/**
 * Read PNG width × height by parsing IHDR. PNG header layout:
 *   bytes 0–7   : magic `\x89PNG\r\n\x1a\n`
 *   bytes 8–11  : IHDR chunk length (always 13)
 *   bytes 12–15 : chunk type "IHDR"
 *   bytes 16–19 : width  (big-endian uint32)
 *   bytes 20–23 : height (big-endian uint32)
 *
 * Returns `null` on non-PNG input (we still copy the file in that case — Expo
 * will validate at build time and produce a more authoritative error).
 */
export function readPngDimensions(
  filePath: string,
): { width: number; height: number } | null {
  const buf = Buffer.alloc(24);
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, "r");
    const n = fs.readSync(fd, buf, 0, 24, 0);
    if (n < 24) return null;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(PNG_MAGIC)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Reject filenames containing whitespace. Surrounding directories may have
 * spaces (e.g. `/Users/Mac User/icons/...` on macOS) — we don't touch those —
 * but the **basename** must be whitespace-free.
 *
 * Rationale: although we rename to canonical destinations (`icon.png`,
 * `splash-icon.png`) on copy, native build tooling (Xcode resource bundles,
 * Gradle resource indexing, CocoaPods scripts) is historically fragile around
 * whitespace in asset filenames — better to reject up front with a clear
 * remediation than ship a broken native build hours later.
 *
 * Exported for testing.
 */
export function assertSafeAssetFilename(absPath: string): void {
  const base = path.basename(absPath);
  if (/\s/.test(base)) {
    throw new Error(
      `Asset filename contains whitespace: "${base}". ` +
        `Rename the source file to remove spaces (e.g. "app-icon.png", not "app icon.png") and try again. ` +
        `Native build tooling (Xcode, Gradle, CocoaPods) is fragile around whitespace in asset filenames.`,
    );
  }
}

/**
 * Resolve a user-supplied path (absolute or relative-to-cwd) and verify it
 * exists + has a whitespace-free filename. Throws with a clear message on
 * either failure — `prompts` returns the path verbatim and we want the
 * failure mode to be obvious BEFORE any copy happens.
 */
function resolveUserPath(target: string, raw: string): string {
  const abs = path.isAbsolute(raw) ? raw : path.resolve(target, raw);
  if (!fileExists(abs)) {
    throw new Error(`File not found: ${abs}`);
  }
  assertSafeAssetFilename(abs);
  return abs;
}

/**
 * Print the asset-config rebuild reminder. Distinct from the native-module
 * rebuild reminder — these recipes change app.json + assets, which Expo bakes
 * into `ios/` + `android/` during `expo prebuild`. `expo run:ios` /
 * `expo run:android` (= `yarn ios` / `yarn android`) call prebuild
 * incrementally, but a Pods cache or stale resource directory can swallow
 * changes — `--clean` is the safe option.
 */
function printAssetRebuildReminder(pm: PackageManager): void {
  const cmd = pm === "yarn" ? "yarn" : "npm run";
  log.raw("");
  log.warn("Re-bake native projects to apply the asset / config changes:");
  log.raw(`  npx expo prebuild --clean   # regenerates ios/ + android/ from app.json`);
  log.raw(`  ${cmd} ios                  # build + launch (iOS)`);
  log.raw(`  ${cmd} android              # build + launch (Android)`);
}

// ---------- app-icon ----------

const DEFAULT_ICON_SIZE = 1024;

/**
 * Validation helper exposed for testing — same constraints we enforce on the
 * source PNG: must exist, must be ≥ `targetSize` on both axes, square.
 * Warnings only (we still copy), but surfaced to the user as actionable logs.
 */
export function validateIconSource(
  filePath: string,
  targetSize: number,
): { dims: { width: number; height: number } | null; warnings: string[] } {
  const dims = readPngDimensions(filePath);
  const warnings: string[] = [];
  if (!dims) {
    warnings.push("Could not read PNG header — source may not be a valid PNG. Copying anyway.");
    return { dims, warnings };
  }
  if (dims.width !== dims.height) {
    warnings.push(
      `Source is non-square (${dims.width}×${dims.height}). Expo expects a square icon; result will be letterboxed or distorted.`,
    );
  }
  if (dims.width < targetSize || dims.height < targetSize) {
    warnings.push(
      `Source (${dims.width}×${dims.height}) is smaller than requested size ${targetSize}. Stores will upscale; quality will suffer.`,
    );
  }
  return { dims, warnings };
}

const DEFAULT_ADAPTIVE_BG = "#ffffff";

/**
 * Mutator for `app.json` icon fields — exposed for testing.
 *
 * Sets per Expo SDK 54 schema (see
 * https://docs.expo.dev/versions/latest/config/app/#adaptiveicon):
 *   - `expo.icon`                                     → `./src/assets/icon.png`
 *   - `expo.android.adaptiveIcon.foregroundImage`     → `./src/assets/adaptive-icon.png`
 *   - `expo.android.adaptiveIcon.backgroundColor`     → `#ffffff` (only if absent —
 *     user-set value preserved; pairs with `foregroundImage`, required for the
 *     Android adaptive icon to render at all).
 *
 * Does NOT touch `monochromeImage` (Android 13+ themed icons) — user can add
 * later from a transparent-background variant of the foreground.
 *
 * Idempotent: setting the same values twice yields the same file.
 */
export function setIconConfig(target: string): void {
  mutateAppJson(target, (json) => {
    json.expo ??= {};
    (json.expo as Record<string, unknown>).icon = "./src/assets/icon.png";
    const expo = json.expo as Record<string, Record<string, unknown>>;
    expo.android ??= {};
    expo.android.adaptiveIcon ??= {};
    const adaptive = expo.android.adaptiveIcon as Record<string, unknown>;
    adaptive.foregroundImage = "./src/assets/adaptive-icon.png";
    if (typeof adaptive.backgroundColor !== "string") {
      adaptive.backgroundColor = DEFAULT_ADAPTIVE_BG;
    }
  });
}

/**
 * `add app-icon` recipe. Interactive — prompts for source path + target size.
 * Copies the source to `src/assets/icon.png` AND `src/assets/adaptive-icon.png`
 * (Expo expects both; the user can replace `adaptive-icon.png` later for a
 * platform-tailored foreground). Updates `app.json` paths.
 *
 * Does NOT resize — Expo handles platform-specific resizing during prebuild
 * from the single source PNG. The `size` answer is used only to validate the
 * source is large enough; we warn on undersized input.
 */
export async function addAppIcon(target: string): Promise<void> {
  assertExpoApp(target);
  if (!process.stdin.isTTY) {
    throw new Error(
      "app-icon needs an interactive terminal (TTY). Run it from a real shell, " +
        "not a piped or slash-command context.",
    );
  }

  const pathAns = await prompts(
    {
      type: "text",
      name: "iconPath",
      message: "Path to source icon (PNG, absolute or relative to project root)",
      validate: (v: string) => (v.trim() === "" ? "Required" : true),
    },
    { onCancel: () => process.exit(1) },
  );
  const iconPath = String(pathAns.iconPath ?? "").trim();
  if (!iconPath) throw new Error("Aborted.");

  const sizeAns = await prompts(
    {
      type: "number",
      name: "size",
      message: `Target icon size in pixels (square). Stores recommend ${DEFAULT_ICON_SIZE}`,
      initial: DEFAULT_ICON_SIZE,
      validate: (v: number) =>
        Number.isInteger(v) && v >= 64 ? true : "Must be an integer ≥ 64",
    },
    { onCancel: () => process.exit(1) },
  );
  const size = Number(sizeAns.size ?? DEFAULT_ICON_SIZE);

  const absSrc = resolveUserPath(target, iconPath);
  const { dims, warnings } = validateIconSource(absSrc, size);
  if (dims) log.info(`Source dimensions: ${dims.width}×${dims.height}`);
  for (const w of warnings) log.warn(w);

  const assetsDir = path.join(target, "src/assets");
  ensureDir(assetsDir);
  const iconDest = path.join(assetsDir, "icon.png");
  const adaptiveDest = path.join(assetsDir, "adaptive-icon.png");
  log.step(`Copying source → ${path.relative(target, iconDest)}`);
  fs.copyFileSync(absSrc, iconDest);
  log.step(`Copying source → ${path.relative(target, adaptiveDest)}`);
  fs.copyFileSync(absSrc, adaptiveDest);

  log.step("Updating app.json icon paths …");
  setIconConfig(target);

  log.success("app-icon set.");
  log.raw("");
  log.raw("Updated:");
  log.raw("  src/assets/icon.png             (used by iOS + Android + favicon fallback)");
  log.raw("  src/assets/adaptive-icon.png    (Android adaptive icon foreground)");
  log.raw("  app.json expo.icon");
  log.raw("  app.json expo.android.adaptiveIcon.foregroundImage");
  log.raw(`  app.json expo.android.adaptiveIcon.backgroundColor  (defaults to ${DEFAULT_ADAPTIVE_BG} if absent)`);
  log.raw("");
  log.info(
    `Expo resizes the ${DEFAULT_ICON_SIZE}px source to all required platform sizes at ` +
      "prebuild time — no manual resize needed. Replace `adaptive-icon.png` later if " +
      "you want a different Android foreground (transparent background, padded).",
  );
  const pm = await detectProjectPm(target);
  printAssetRebuildReminder(pm);
}

// ---------- splash ----------

const DEFAULT_SPLASH_COLOR = "#ffffff";
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Mutator for `app.json` splash config — exposed for testing.
 *
 * Writes the modern `expo-splash-screen` plugin entry (SDK 50+). If a legacy
 * `expo.splash` field is present (from older create-expo-app templates), it's
 * updated to match so a downgraded SDK still picks up the change. Idempotent:
 * re-running with the same values is a no-op; running with new values updates
 * in place (merges into existing plugin options).
 */
export function setSplashConfig(
  target: string,
  color: string,
  imageRelPath: string,
): void {
  mutateAppJson(target, (json) => {
    json.expo ??= {};
    json.expo.plugins ??= [];
    const options: Record<string, unknown> = {
      image: imageRelPath,
      imageWidth: 200,
      resizeMode: "contain",
      backgroundColor: color,
    };
    const idx = json.expo.plugins.findIndex(
      (e) => pluginName(e) === "expo-splash-screen",
    );
    if (idx === -1) {
      json.expo.plugins.push(["expo-splash-screen", options]);
    } else {
      const existing = json.expo.plugins[idx];
      const prevOpts: Record<string, unknown> =
        Array.isArray(existing) && existing[1] ? existing[1] : {};
      json.expo.plugins[idx] = ["expo-splash-screen", { ...prevOpts, ...options }];
    }

    // Defensive: also update legacy `expo.splash` if present.
    const expo = json.expo as Record<string, unknown>;
    const legacy = expo.splash as Record<string, unknown> | undefined;
    if (legacy) {
      legacy.image = imageRelPath;
      legacy.backgroundColor = color;
    }
  });
}

/**
 * `add splash` recipe. Interactive — prompts for background color (hex) +
 * source image path. Copies the source to `src/assets/splash-icon.png` and
 * writes the `expo-splash-screen` plugin entry to `app.json` with
 * `resizeMode: "contain"` + `imageWidth: 200` (image centered, scaled to fit
 * within 200px on the smaller axis; full surrounding area filled with color).
 */
export async function addSplash(target: string): Promise<void> {
  assertExpoApp(target);
  if (!process.stdin.isTTY) {
    throw new Error(
      "splash needs an interactive terminal (TTY). Run it from a real shell, " +
        "not a piped or slash-command context.",
    );
  }

  const colorAns = await prompts(
    {
      type: "text",
      name: "color",
      message: `Background color (hex, e.g. ${DEFAULT_SPLASH_COLOR})`,
      initial: DEFAULT_SPLASH_COLOR,
      validate: (v: string) =>
        HEX_COLOR_RE.test(v.trim())
          ? true
          : "Expected hex like #ffffff or #ffffffff",
    },
    { onCancel: () => process.exit(1) },
  );
  const color = String(colorAns.color ?? "").trim();
  if (!color) throw new Error("Aborted.");

  const imageAns = await prompts(
    {
      type: "text",
      name: "imagePath",
      message:
        "Path to splash image (PNG, shown centered, absolute or relative to project root)",
      validate: (v: string) => (v.trim() === "" ? "Required" : true),
    },
    { onCancel: () => process.exit(1) },
  );
  const imagePath = String(imageAns.imagePath ?? "").trim();
  if (!imagePath) throw new Error("Aborted.");

  const absSrc = resolveUserPath(target, imagePath);
  const dims = readPngDimensions(absSrc);
  if (dims) log.info(`Splash image dimensions: ${dims.width}×${dims.height}`);

  const assetsDir = path.join(target, "src/assets");
  ensureDir(assetsDir);
  const splashDest = path.join(assetsDir, "splash-icon.png");
  log.step(`Copying source → ${path.relative(target, splashDest)}`);
  fs.copyFileSync(absSrc, splashDest);

  log.step("Writing expo-splash-screen plugin entry to app.json …");
  setSplashConfig(target, color, "./src/assets/splash-icon.png");

  log.success("splash set.");
  log.raw("");
  log.raw(`  backgroundColor : ${color}`);
  log.raw(`  image           : src/assets/splash-icon.png`);
  log.raw(`  imageWidth      : 200 (centered, contain)`);
  log.raw("");
  log.info(
    'Adjust `imageWidth` / `resizeMode` in app.json plugins["expo-splash-screen"] ' +
      "if the centered image renders too small or too large.",
  );
  const pm = await detectProjectPm(target);
  printAssetRebuildReminder(pm);
}

// ---------- dispatcher ----------

const KNOWN_RECIPES = [
  "bottom-sheet",
  "image-picker",
  "app-icon",
  "splash",
] as const;
type Recipe = (typeof KNOWN_RECIPES)[number];

export async function runAdd(recipe: string | undefined): Promise<void> {
  if (!recipe) {
    throw new Error(
      `Missing recipe. Usage: codingpixel-expo-app <add|generate|g> <${KNOWN_RECIPES.join("|")}>`,
    );
  }
  if (!(KNOWN_RECIPES as readonly string[]).includes(recipe)) {
    throw new Error(
      `Unknown recipe "${recipe}". Supported: ${KNOWN_RECIPES.join(", ")}`,
    );
  }
  const target = process.cwd();
  log.info(`Target project: ${target}`);
  switch (recipe as Recipe) {
    case "bottom-sheet":
      return addBottomSheet(target);
    case "image-picker":
      return addImagePicker(target);
    case "app-icon":
      return addAppIcon(target);
    case "splash":
      return addSplash(target);
  }
}
