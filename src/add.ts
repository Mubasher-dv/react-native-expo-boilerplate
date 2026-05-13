// Post-scaffold `add` subcommand — retrofit a **recipe** into an
// already-scaffolded project without re-running the full scaffolder.
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
// Surfaces (CLI dispatch in src/index.ts):
//   react-native-expo-boilerplate add bottom-sheet
//   react-native-expo-boilerplate add image-picker
//   react-native-expo-boilerplate add app-icon
//   react-native-expo-boilerplate add splash
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
import prompts from "prompts";
import { applyBottomSheet, applyImagePicker } from "./overlay.js";
import type { PackageManager } from "./prompts.js";
import { ensureDir, log } from "./util.js";
import {
  assertExpoApp,
  detectProjectPm,
  expoInstall,
  fileExists,
} from "./projectFs.js";
import { regenerateFontsMarkerBlock } from "./fontsInstaller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveTemplatesRoot(): string {
  return path.resolve(__dirname, "..", "templates");
}

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
  log.raw(
    `  ${cmd} android   # same for Android (needs emulator/device + Android SDK)`,
  );
  log.raw("");
  log.info(
    "Skipping the rebuild leaves the old dev-client in place — the bundler will fail " +
      "at runtime with 'unable to resolve native module'.",
  );
}

/**
 * Print a uniform "Files changed:" block so the user sees exactly what the
 * recipe touched in their project. Lockfile name is PM-aware. Lines for
 * removed files are tagged "(removed)" so they stand out from creates/updates.
 *
 * Empty `written` + empty `removed` falls back to "(none)" — happens when
 * every patch in the recipe was an idempotent no-op (e.g. re-running
 * `add image-picker` on an already-patched project).
 */
export function printFilesChanged(
  written: string[],
  removed: string[] = [],
): void {
  log.raw("");
  log.raw("Files changed in your project:");
  if (written.length === 0 && removed.length === 0) {
    log.raw("  (none — recipe was an idempotent no-op)");
    return;
  }
  for (const p of written) log.raw(`  ${p}`);
  for (const p of removed) log.raw(`  ${p}    (removed)`);
}

/** PM-correct lockfile basename for the "Files changed" list. */
function lockfileFor(pm: PackageManager): string {
  return pm === "yarn" ? "yarn.lock" : "package-lock.json";
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

  printFilesChanged([
    "src/ui/appComponents/customBottomSheetModal/index.tsx",
    "src/ui/appComponents/appBottomSheetView/index.tsx",
    "src/ui/appComponents/appBottomSheetBackdrop/index.tsx",
    "src/ui/appComponents/appBottomSheetScrollView/index.tsx",
    "src/ui/appComponents/BottomSheetKeyboardAwareScrollView/index.tsx",
    "package.json",
    lockfileFor(pm),
  ]);

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
export function spliceMediaConstants(
  target: string,
  templatesRoot: string,
): void {
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
  log.raw(
    "Constants available: @utils/constants → MEDIA_TYPES, IMAGE_PICKER_OPTIONS, CAMERA_OPTIONS",
  );

  printFilesChanged([
    "src/core/services/PermissionService.ts",
    "src/core/utils/constants.ts",
    "app.json",
    "package.json",
    lockfileFor(pm),
  ]);

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
  const PNG_MAGIC = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
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
  log.raw(
    `  npx expo prebuild --clean   # regenerates ios/ + android/ from app.json`,
  );
  log.raw(`  ${cmd} ios                  # build + launch (iOS)`);
  log.raw(`  ${cmd} android              # build + launch (Android)`);
}

// ---------- app-icon ----------

/** Recommended source dimensions per App Store / Play Store guidelines. */
const DEFAULT_ICON_SIZE = 1024;

/**
 * Allowed icon source formats.
 *
 * Per Expo SDK 54 docs (https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/):
 *   "Use .png files."
 *
 * Android adaptive icon foreground specifically requires PNG — JPG / JPEG
 * silently fail to render in `expo.android.adaptiveIcon.foregroundImage`,
 * leaving the launcher with no app icon (the user-reported bug fixed in
 * v0.2.2). PNG is also required for transparency, which the adaptive icon
 * foreground typically needs to render correctly within the launcher's mask.
 *
 * iOS is more permissive (will render JPG) but we enforce PNG for the whole
 * recipe to keep cross-platform behavior consistent — a single source feeds
 * both `expo.icon` (iOS) and the Android adaptive paths.
 */
export const ALLOWED_ICON_EXTS = ["png"] as const;
export type IconExt = (typeof ALLOWED_ICON_EXTS)[number];

/**
 * Minimum recommended pixel dimensions for the Android adaptive icon foreground
 * (per [Android Adaptive Icon Guidelines](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)).
 *
 * Adaptive icon canvas is 108dp × 108dp; at xxxhdpi (4×) that's 432 × 432 px.
 * Sources smaller than this get upscaled by the launcher and look fuzzy.
 */
const ANDROID_ADAPTIVE_MIN = 432;

/**
 * Extract + validate the icon source extension. Returns the lower-cased
 * extension without the leading dot. Throws when the file has no extension or
 * an unsupported one — caller surfaces directly to the user.
 *
 * Case-insensitive (`.PNG` is valid).
 */
export function assertIconExtension(absPath: string): IconExt {
  const raw = path.extname(absPath).toLowerCase().replace(/^\./, "");
  if (!(ALLOWED_ICON_EXTS as readonly string[]).includes(raw)) {
    const display = raw === "" ? "<none>" : `.${raw}`;
    const reason =
      raw === "jpg" || raw === "jpeg"
        ? "Android adaptive icon foreground requires PNG — JPG/JPEG silently fails to render. " +
          "Convert the source to PNG (preserve transparency where possible) and try again."
        : `App icons must be PNG per Expo SDK 54 docs.`;
    throw new Error(
      `Unsupported icon extension: "${display}" (file: "${path.basename(absPath)}"). ${reason}`,
    );
  }
  return raw as IconExt;
}

/**
 * Validation helper exposed for testing. PNG-header check only (JPG/JPEG
 * sources return `null` dims — we still copy; Expo will validate the source
 * at build time and surface an authoritative error if anything's malformed).
 *
 * Warnings only — never throws. Caller surfaces them as `log.warn` lines.
 */
export function validateIconSource(filePath: string): {
  dims: { width: number; height: number } | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const dims = readPngDimensions(filePath);
  if (!dims) {
    warnings.push(
      "Source claims `.png` but the header is not a valid PNG signature. Copying anyway — Expo will surface the build-time error.",
    );
    return { dims, warnings };
  }
  if (dims.width !== dims.height) {
    warnings.push(
      `Source is non-square (${dims.width}×${dims.height}). Expo expects a square icon; the result will be letterboxed or distorted.`,
    );
  }
  if (dims.width < ANDROID_ADAPTIVE_MIN || dims.height < ANDROID_ADAPTIVE_MIN) {
    warnings.push(
      `Source (${dims.width}×${dims.height}) is below the Android adaptive-icon minimum of ${ANDROID_ADAPTIVE_MIN}×${ANDROID_ADAPTIVE_MIN} (per Android launcher guidelines — foreground canvas at xxxhdpi). The Android icon may render fuzzy or not at all.`,
    );
  }
  if (dims.width < DEFAULT_ICON_SIZE || dims.height < DEFAULT_ICON_SIZE) {
    warnings.push(
      `Source (${dims.width}×${dims.height}) is smaller than the App Store / Play Store recommendation of ${DEFAULT_ICON_SIZE}×${DEFAULT_ICON_SIZE}. Stores will upscale; quality will suffer.`,
    );
  }
  return { dims, warnings };
}

const DEFAULT_ADAPTIVE_BG = "#ffffff";

/**
 * Resolved icon destination paths — exposed so the recipe can copy the source
 * to the right place before `setIconConfig` writes app.json fields pointing
 * at those paths.
 */
export type IconDests = {
  /** Where to copy the icon source. Relative to `target` root (e.g. `src/assets/icon.png`). */
  iconRel: string;
  /** Where to copy the adaptive-icon source. Relative to `target` root. */
  adaptiveRel: string;
  /** Value written to `expo.icon` and `expo.android.icon` (with `./` prefix). */
  iconAppJson: string;
  /** Value written to `expo.android.adaptiveIcon.foregroundImage` (with `./` prefix). */
  adaptiveAppJson: string;
};

/**
 * Strip leading `./` if present. app.json paths typically include it; on-disk
 * paths shouldn't.
 */
function stripDotSlash(p: string): string {
  return p.replace(/^\.\//, "");
}

/**
 * Derive the icon destination paths from the user's existing app.json.
 *
 * Rationale: the user may have a non-default project layout, especially
 * projects scaffolded from stock `create-expo-app` (which uses
 * `./assets/images/icon.png`) rather than this CLI's `./src/assets/icon.png`.
 * Forcing canonical paths used to clobber the user's `expo.icon` and copy the
 * source to a location iOS never reads — the iOS app icon would update
 * accidentally if app.json happened to be re-read, but the file lived in the
 * wrong place. Preserving the user's existing paths fixes this.
 *
 * Resolution rules:
 *   1. `expo.icon` (top-level) — if a string, use it verbatim. Else default
 *      `./src/assets/icon.<ext>` (this CLI's convention).
 *   2. `expo.android.adaptiveIcon.foregroundImage` — if a string, use it
 *      verbatim. Else derive from the resolved icon path:
 *      - If basename is `icon.<ext>`, sibling becomes `adaptive-icon.<ext>`.
 *      - Otherwise sibling becomes `adaptive-<basename>.<ext>`.
 *
 * Exported for testing.
 */
export function deriveIconDests(
  target: string,
  ext: IconExt = "png",
): IconDests {
  const appJsonPath = path.join(target, "app.json");
  const json = JSON.parse(fs.readFileSync(appJsonPath, "utf8")) as ExpoAppJson;
  const expo = (json.expo ?? {}) as Record<string, unknown>;
  const existingIcon =
    typeof expo.icon === "string" ? (expo.icon as string) : undefined;
  const android = (expo.android as Record<string, unknown> | undefined) ?? {};
  const adaptive =
    (android.adaptiveIcon as Record<string, unknown> | undefined) ?? {};
  const existingFg =
    typeof adaptive.foregroundImage === "string"
      ? (adaptive.foregroundImage as string)
      : undefined;

  const iconAppJson = existingIcon ?? `./src/assets/icon.${ext}`;

  // Derive adaptive path: respect existing, else sibling-of-icon.
  let adaptiveAppJson: string;
  if (existingFg) {
    adaptiveAppJson = existingFg;
  } else {
    // path.posix.join normalizes away the leading "./" — manage it manually.
    const iconWithoutDotSlash = stripDotSlash(iconAppJson);
    const iconDir = path.posix.dirname(iconWithoutDotSlash);
    const iconExt = path.extname(iconWithoutDotSlash) || `.${ext}`;
    const iconBase = path.posix.basename(iconWithoutDotSlash, iconExt);
    const adaptiveBase =
      iconBase === "icon" ? "adaptive-icon" : `adaptive-${iconBase}`;
    const joined =
      iconDir === "." || iconDir === ""
        ? `${adaptiveBase}${iconExt}`
        : `${iconDir}/${adaptiveBase}${iconExt}`;
    adaptiveAppJson = `./${joined}`;
  }

  return {
    iconAppJson,
    adaptiveAppJson,
    iconRel: stripDotSlash(iconAppJson),
    adaptiveRel: stripDotSlash(adaptiveAppJson),
  };
}

/**
 * Mutator for `app.json` icon fields — exposed for testing.
 *
 * Sets per Expo SDK 54 docs (https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/):
 *
 *   - `expo.icon`                                     → `dests.iconAppJson`
 *       Top-level icon, used by iOS + web favicon + Android non-adaptive fallback default.
 *   - `expo.android.icon`                             → `dests.iconAppJson`
 *       Non-adaptive Android fallback for older devices (< Android 8.0 /
 *       API 26 — pre-adaptive-icon era). Per docs: "You may also want to
 *       provide a separate icon for older Android devices that do not
 *       support Adaptive Icons. You can do so with the `android.icon`
 *       property." Without this, older Android devices show no app icon.
 *   - `expo.android.adaptiveIcon.foregroundImage`     → `dests.adaptiveAppJson`
 *       Android adaptive icon foreground layer (Android 8.0+).
 *   - `expo.android.adaptiveIcon.backgroundColor`     → `#ffffff` (only if absent —
 *     user-set value preserved; pairs with `foregroundImage`. Without it the
 *     Android adaptive icon doesn't render at all).
 *
 * `dests` is typically produced by `deriveIconDests(target, ext)`, which
 * preserves any existing user-configured paths. Pass an explicit `IconDests`
 * here to override (e.g. tests).
 *
 * Idempotent: setting the same values twice yields the same file.
 */
export function setIconConfig(
  target: string,
  destsOrExt: IconDests | IconExt = "png",
): void {
  const dests: IconDests =
    typeof destsOrExt === "string"
      ? deriveIconDests(target, destsOrExt)
      : destsOrExt;

  mutateAppJson(target, (json) => {
    json.expo ??= {};
    (json.expo as Record<string, unknown>).icon = dests.iconAppJson;
    const expo = json.expo as Record<string, Record<string, unknown>>;
    expo.android ??= {};
    // Non-adaptive fallback for older Android (< 8.0). Same source — single
    // pre-rendered layer combining foreground + background.
    (expo.android as Record<string, unknown>).icon = dests.iconAppJson;
    expo.android.adaptiveIcon ??= {};
    const adaptive = expo.android.adaptiveIcon as Record<string, unknown>;
    adaptive.foregroundImage = dests.adaptiveAppJson;
    if (typeof adaptive.backgroundColor !== "string") {
      adaptive.backgroundColor = DEFAULT_ADAPTIVE_BG;
    }
  });
}

/**
 * Sibling extensions we check for cleanup. Superset of `ALLOWED_ICON_EXTS` —
 * includes formats no longer accepted as INPUT (`.jpg`, `.jpeg`) so users
 * upgrading from v0.2.0 / v0.2.1 (which did accept JPG/JPEG) get their stale
 * sibling files cleaned up on first re-run of `add app-icon` under the new
 * PNG-only constraint.
 */
const SIBLING_ICON_EXTS = ["png", "jpg", "jpeg"] as const;

/**
 * Remove sibling icon files with non-matching extensions so app.json + disk
 * don't drift. Skips the file we're keeping. No-op when no siblings exist.
 *
 * Exported for testing.
 */
export function removeStaleIconSiblings(
  assetsDir: string,
  baseName: "icon" | "adaptive-icon",
  keepExt: IconExt,
): string[] {
  const removed: string[] = [];
  for (const e of SIBLING_ICON_EXTS) {
    if (e === keepExt) continue;
    const p = path.join(assetsDir, `${baseName}.${e}`);
    if (fileExists(p)) {
      fs.rmSync(p);
      removed.push(`${baseName}.${e}`);
    }
  }
  return removed;
}

/**
 * `add app-icon` recipe. Interactive — single prompt for the source path.
 *
 * Flow:
 *   1. Prompt for source path.
 *   2. Validate path exists, basename has no whitespace, extension is one of
 *      `.png` / `.jpg` / `.jpeg`. Throw before any copy on any failure.
 *   3. Run dimension validation (PNG-only) — warnings on non-square /
 *      undersized; never throws.
 *   4. Copy source to BOTH `src/assets/icon.<ext>` (iOS + Android + favicon
 *      fallback) and `src/assets/adaptive-icon.<ext>` (Android adaptive
 *      foreground), preserving the source extension.
 *   5. Remove sibling files with other allowed extensions (e.g. stale
 *      `icon.png` when writing `icon.jpg`) so app.json + disk stay in sync.
 *   6. Write app.json icon paths matching the chosen extension.
 *   7. Print rebuild reminder.
 *
 * Does NOT prompt for size and does NOT resize — Expo regenerates all
 * platform sizes from the single source during prebuild. The 1024 px standard
 * is documented as a soft warning only.
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
      message: `Path to source icon (.png, absolute or relative to project root) — ${DEFAULT_ICON_SIZE}×${DEFAULT_ICON_SIZE} recommended`,
      validate: (v: string) => (v.trim() === "" ? "Required" : true),
    },
    { onCancel: () => process.exit(1) },
  );
  const iconPath = String(pathAns.iconPath ?? "").trim();
  if (!iconPath) throw new Error("Aborted.");

  // All up-front validation: existence, whitespace, extension. Throws before
  // any side effect on any failure.
  const absSrc = resolveUserPath(target, iconPath);
  const ext = assertIconExtension(absSrc);

  // Informational dimension check (PNG only) — warnings, never throws.
  const { dims, warnings } = validateIconSource(absSrc);
  if (dims) log.info(`Source dimensions: ${dims.width}×${dims.height}`);
  for (const w of warnings) log.warn(w);

  // Derive destination paths from existing app.json (preserves user's project
  // layout — e.g. stock create-expo-app's `./assets/images/icon.png` rather
  // than this CLI's default `./src/assets/icon.png`).
  const dests = deriveIconDests(target, ext);
  const iconAbsDest = path.join(target, dests.iconRel);
  const adaptiveAbsDest = path.join(target, dests.adaptiveRel);

  // Ensure destination directories exist (creates `assets/images/` etc. if missing).
  ensureDir(path.dirname(iconAbsDest));
  ensureDir(path.dirname(adaptiveAbsDest));

  log.step(`Copying source → ${path.relative(target, iconAbsDest)}`);
  fs.copyFileSync(absSrc, iconAbsDest);
  log.step(`Copying source → ${path.relative(target, adaptiveAbsDest)}`);
  fs.copyFileSync(absSrc, adaptiveAbsDest);

  // Clean up sibling files in other extensions so app.json + disk don't drift.
  // Scans BOTH the canonical `src/assets/` location AND the resolved icon dir
  // (which may be different, e.g. `assets/images/`). Dedupe on path.
  const removedFiles: string[] = [];
  const cleanupDirs = new Set<string>([
    path.join(target, "src/assets"),
    path.dirname(iconAbsDest),
    path.dirname(adaptiveAbsDest),
  ]);
  for (const dir of cleanupDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const baseDest of [iconAbsDest, adaptiveAbsDest]) {
      const baseExt = path.extname(baseDest);
      const baseName = path.basename(baseDest, baseExt);
      if (
        !fs.existsSync(path.join(dir, `${baseName}${baseExt}`)) &&
        dir !== path.dirname(baseDest)
      ) {
        // No corresponding file in this dir; skip wholesale cleanup.
        continue;
      }
      const removed = removeStaleIconSiblings(
        dir,
        baseName as "icon" | "adaptive-icon",
        ext,
      );
      for (const r of removed) {
        const rel = path.relative(target, path.join(dir, r));
        log.info(`Removed stale ${rel} (replaced by .${ext} variant).`);
        removedFiles.push(rel);
      }
    }
  }

  log.step("Updating app.json icon paths …");
  setIconConfig(target, dests);

  log.success("app-icon set.");
  log.raw("");
  log.raw(
    `Expo resizes the source to all required platform sizes at prebuild time — no manual resize needed. ` +
      `Replace ${dests.adaptiveRel} later if you want a different Android foreground ` +
      `(transparent background, padded — see https://developer.android.com/develop/ui/views/launch/icon_design_adaptive).`,
  );
  log.raw("");
  log.info(
    "app.json fields written:\n" +
      `  expo.icon                                       → ${dests.iconAppJson}  (iOS + favicon fallback)\n` +
      `  expo.android.icon                               → ${dests.iconAppJson}  (Android < 8.0 non-adaptive fallback)\n` +
      `  expo.android.adaptiveIcon.foregroundImage       → ${dests.adaptiveAppJson}  (Android 8.0+ adaptive foreground)\n` +
      `  expo.android.adaptiveIcon.backgroundColor       → #ffffff  (only-if-absent — user value preserved)`,
  );

  printFilesChanged(
    [dests.iconRel, dests.adaptiveRel, "app.json"],
    removedFiles,
  );

  const pm = await detectProjectPm(target);
  printAssetRebuildReminder(pm);
  log.raw("");
  log.warn(
    "If the Android icon doesn't update after rebuild, the cause is almost always one of:\n" +
      "  1. Skipped `npx expo prebuild --clean` — without --clean, android/app/src/main/res/mipmap-* " +
      "stays stale and the new icon never gets baked into the APK.\n" +
      "  2. Emulator / device cached the old icon. Long-press app → Uninstall (or " +
      "`adb uninstall <expo.android.package>`), then `yarn android` again.\n" +
      "  3. Source PNG is below 432×432 — Android adaptive icon may upscale fuzzy or fall back to default. " +
      "Provide a 1024×1024 square PNG for clean results.",
  );
}

// ---------- splash ----------

const DEFAULT_SPLASH_COLOR = "#ffffff";
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Default `imageWidth` (in dp) for the splash icon.
 *
 * Sized for the Android 12+ Material You adaptive splash icon canvas, which
 * is 192dp × 192dp. Values > 192 overflow the canvas and Android crops the
 * left + right edges (the user-reported "cutting" bug in v0.2.2). iOS has no
 * equivalent canvas constraint, so it would have rendered fine at 200 — the
 * historic Expo example default — which is exactly why the user saw the
 * issue on Android but not iOS.
 *
 * Matches Expo's own Android-platform-specific docs example (uses 150 for
 * Android). 150 sits comfortably inside the 192dp canvas with breathing room
 * for the launcher's circular / squircle mask on edge-bleed devices.
 */
const DEFAULT_SPLASH_IMAGE_WIDTH = 150;
const MIN_SPLASH_IMAGE_WIDTH = 50;
const MAX_SPLASH_IMAGE_WIDTH = 400;

/**
 * Mutator for `app.json` splash config — exposed for testing.
 *
 * Writes the modern `expo-splash-screen` plugin entry (SDK 50+). If a legacy
 * `expo.splash` field is present (from older create-expo-app templates), it's
 * updated to match so a downgraded SDK still picks up the change. Idempotent:
 * re-running with the same values is a no-op; running with new values updates
 * in place (merges into existing plugin options).
 *
 * `imageWidth` defaults to `DEFAULT_SPLASH_IMAGE_WIDTH` (150) — Android 12+
 * splash icon canvas safe value. Callers (the recipe) prompt the user for
 * this and pass it through.
 */
export function setSplashConfig(
  target: string,
  color: string,
  imageRelPath: string,
  imageWidth: number = DEFAULT_SPLASH_IMAGE_WIDTH,
): void {
  mutateAppJson(target, (json) => {
    json.expo ??= {};
    json.expo.plugins ??= [];

    // Light/default options.
    const options: Record<string, unknown> = {
      image: imageRelPath,
      imageWidth,
      resizeMode: "contain",
      backgroundColor: color,
    };

    // Dark-mode block — Expo docs example pairs `backgroundColor` (always) with
    // optional `image` (dark variant). We mirror the light backgroundColor by
    // default so dark-mode devices don't get a black or white default that
    // clashes with the light theme. Users who want a different dark color
    // edit `dark.backgroundColor` post-recipe.
    //
    // If the user had a pre-existing `dark` block with `image` set, we PRESERVE
    // those keys via merge below — only `backgroundColor` gets mirrored.
    const newDark: Record<string, unknown> = {
      backgroundColor: color,
    };

    const idx = json.expo.plugins.findIndex(
      (e) => pluginName(e) === "expo-splash-screen",
    );
    if (idx === -1) {
      json.expo.plugins.push([
        "expo-splash-screen",
        { ...options, dark: newDark },
      ]);
    } else {
      const existing = json.expo.plugins[idx];
      const prevOpts: Record<string, unknown> =
        Array.isArray(existing) && existing[1] ? existing[1] : {};
      const prevDark =
        (prevOpts.dark as Record<string, unknown> | undefined) ?? {};
      json.expo.plugins[idx] = [
        "expo-splash-screen",
        {
          ...prevOpts,
          ...options,
          dark: { ...prevDark, ...newDark },
        },
      ];
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
 * Splice `expo-splash-screen` wiring into `src/app/_layout.tsx`:
 *
 *   - `import * as SplashScreen from "expo-splash-screen";` (added after the
 *     existing import block).
 *   - `import { useEffect } from "react";` (added unless an existing react
 *     import already lists `useEffect`; if a `from "react"` import exists, we
 *     merge `useEffect` into its named imports rather than adding a duplicate
 *     line).
 *   - `SplashScreen.preventAutoHideAsync();` at module scope, immediately
 *     before `export default function RootLayout(`. Required for the
 *     `useEffect → hideAsync` pair to do anything visible — without it Expo
 *     auto-hides the splash the moment the JS bundle finishes loading, before
 *     the layout has mounted, making the rest of this wiring a no-op.
 *   - `useEffect(() => { SplashScreen.hideAsync(); }, []);` as the first
 *     statement of the `RootLayout` body, so the native splash is dismissed
 *     once the JS-driven layout mounts.
 *
 * Idempotent — detects `SplashScreen.hideAsync` already present and skips.
 *
 * Defensive — if the file's RootLayout structure doesn't match expectations
 * (user has heavily edited the layout), we log the snippets to paste manually
 * rather than throw. Splash recipe shouldn't abort on a customized layout.
 *
 * Exported for testing.
 */
export function patchLayoutForSplash(target: string): void {
  const p = path.join(target, "src/app/_layout.tsx");
  if (!fileExists(p)) {
    log.warn(
      `Cannot wire splash hide-on-mount: ${p} not found — skipping splice. ` +
        "Wire it up manually (see snippets logged at end of splash recipe).",
    );
    return;
  }
  const original = fs.readFileSync(p, "utf8");

  // Sanity: must have a RootLayout function to splice into.
  if (!/export\s+default\s+function\s+RootLayout\s*\(/.test(original)) {
    log.warn(
      "Could not locate `export default function RootLayout(` in _layout.tsx. " +
        "Skipping automatic splice — wire up manually:",
    );
    log.raw('  import { useEffect } from "react";');
    log.raw('  import * as SplashScreen from "expo-splash-screen";');
    log.raw("  SplashScreen.preventAutoHideAsync();");
    log.raw("  // inside RootLayout, first line:");
    log.raw("  useEffect(() => { SplashScreen.hideAsync(); }, []);");
    return;
  }

  // C1 (rev 3): substring guard `original.includes("SplashScreen.hideAsync")`
  // REMOVED. Per-insert idempotency below handles re-runs.

  const markerBlockPresent = original.includes("// codingpixel:fonts-start");

  if (markerBlockPresent) {
    // Defer the useEffect to fonts module's marker block. regenerateFontsMarkerBlock
    // re-detects hasSplashScreen (now true after splash install) and rewrites in place.
    // If sidecar is missing (e.g. user wiped fonts manually), fall back to standalone.
    const regenResult = regenerateFontsMarkerBlock(target);
    if (regenResult.reason === "no-sidecar") {
      insertStandaloneSplashUseEffect(target);
    }
  } else {
    insertStandaloneSplashUseEffect(target);
  }

  ensureSplashImportsAndModuleCall(target);
}

// ---------- splash private helpers ----------

/** Splash recipe's original useEffect splice. Only invoked when no marker block. */
function insertStandaloneSplashUseEffect(target: string): void {
  const p = path.join(target, "src/app/_layout.tsx");
  const original = fs.readFileSync(p, "utf8");
  // Precise idempotency: standalone empty-deps useEffect-with-hideAsync.
  if (/useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?SplashScreen\.hideAsync\(\)/.test(original)) {
    return;
  }
  const lines = original.split("\n");
  let rootIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/export\s+default\s+function\s+RootLayout\s*\(/.test(lines[i])) {
      rootIdx = i;
      break;
    }
  }
  if (rootIdx === -1) return;
  const block = [
    "  // Splash recipe — pair with SplashScreen.preventAutoHideAsync() above.",
    "  useEffect(() => {",
    "    SplashScreen.hideAsync();",
    "  }, []);",
    "",
  ];
  lines.splice(rootIdx + 1, 0, ...block);
  fs.writeFileSync(p, lines.join("\n"));
}

/** Insert SplashScreen import + useEffect import + preventAutoHideAsync(). Each guarded by its own precondition. */
function ensureSplashImportsAndModuleCall(target: string): void {
  const p = path.join(target, "src/app/_layout.tsx");
  let content = fs.readFileSync(p, "utf8");

  // useEffect import.
  const reactNamedRe = /^\s*import\s+\{([^}]*)\}\s+from\s+["']react["']\s*;?\s*$/m;
  const m = content.match(reactNamedRe);
  if (m && !/\buseEffect\b/.test(m[1])) {
    const inner = m[1].trim().replace(/,\s*$/, "");
    const merged = inner.length === 0 ? "useEffect" : `${inner}, useEffect`;
    content = content.replace(reactNamedRe, `import { ${merged} } from "react";`);
  } else if (!m && !/import\s+\{[^}]*\buseEffect\b[^}]*\}\s+from\s+["']react["']/.test(content)) {
    content = insertAfterLastImport(content, `import { useEffect } from "react";`);
  }

  // SplashScreen import.
  if (!/from\s+["']expo-splash-screen["']/.test(content)) {
    content = insertAfterLastImport(content, `import * as SplashScreen from "expo-splash-screen";`);
  }

  // preventAutoHideAsync() module-scope call.
  if (!/^SplashScreen\.preventAutoHideAsync\(\)/m.test(content)) {
    const lines = content.split("\n");
    let rootIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/export\s+default\s+function\s+RootLayout\s*\(/.test(lines[i])) {
        rootIdx = i;
        break;
      }
    }
    if (rootIdx >= 0) {
      const moduleBlock = [
        "// Splash recipe — keep the native splash visible until the JS layout has",
        "// mounted, then hide it from the useEffect inside RootLayout.",
        "SplashScreen.preventAutoHideAsync();",
        "",
      ];
      if (lines[rootIdx - 1] !== undefined && lines[rootIdx - 1].trim() === "") {
        lines.splice(rootIdx, 0, ...moduleBlock);
      } else {
        lines.splice(rootIdx, 0, "", ...moduleBlock);
      }
      content = lines.join("\n");
    }
  }

  fs.writeFileSync(p, content);
}

function insertAfterLastImport(content: string, lineToInsert: string): string {
  const lines = content.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImportIdx = i;
  }
  if (lastImportIdx === -1) return `${lineToInsert}\n${content}`;
  lines.splice(lastImportIdx + 1, 0, lineToInsert);
  return lines.join("\n");
}

/**
 * `add splash` recipe. Interactive — prompts for background color (hex) +
 * source image path. Then:
 *
 *   1. `expo install expo-splash-screen` — MANDATORY. The `expo-splash-screen`
 *      config plugin entry in app.json fails to resolve at `expo prebuild` /
 *      `expo run:*` time if the package isn't installed, with
 *      `PluginError: Failed to resolve plugin for module "expo-splash-screen"`.
 *      Initial scaffold doesn't include this package, so this recipe brings it
 *      in lazily.
 *   2. Copy source → `src/assets/splash-icon.png`.
 *   3. Write `expo-splash-screen` plugin entry to app.json.
 *   4. Splice `SplashScreen.preventAutoHideAsync()` + `useEffect → hideAsync`
 *      into `src/app/_layout.tsx` so the splash actually dismisses on mount
 *      (without this the JS bundle's auto-hide fires too early and the
 *      configured splash never gets a chance to render).
 *   5. Print rebuild reminder.
 */
export async function addSplash(target: string): Promise<void> {
  assertExpoApp(target);
  if (!process.stdin.isTTY) {
    throw new Error(
      "splash needs an interactive terminal (TTY). Run it from a real shell, " +
        "not a piped or slash-command context.",
    );
  }

  const pm = await detectProjectPm(target);
  log.info(`Package manager: ${pm}`);

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

  const widthAns = await prompts(
    {
      type: "number",
      name: "imageWidth",
      message: `Splash image width in dp (Android 12+ icon canvas is 192dp — values above this crop on newer Android; iOS is unconstrained). Default ${DEFAULT_SPLASH_IMAGE_WIDTH}`,
      initial: DEFAULT_SPLASH_IMAGE_WIDTH,
      validate: (v: number) =>
        Number.isInteger(v) &&
        v >= MIN_SPLASH_IMAGE_WIDTH &&
        v <= MAX_SPLASH_IMAGE_WIDTH
          ? true
          : `Must be an integer between ${MIN_SPLASH_IMAGE_WIDTH} and ${MAX_SPLASH_IMAGE_WIDTH}`,
    },
    { onCancel: () => process.exit(1) },
  );
  const imageWidth = Number(widthAns.imageWidth ?? DEFAULT_SPLASH_IMAGE_WIDTH);
  if (imageWidth > 192) {
    log.warn(
      `imageWidth=${imageWidth} > 192dp — may crop on Android 12+ Material You splash canvas. ` +
        "Drop to 150–192 if you see left/right edges cut on Android.",
    );
  }

  const absSrc = resolveUserPath(target, imagePath);
  const dims = readPngDimensions(absSrc);
  if (dims) log.info(`Splash image dimensions: ${dims.width}×${dims.height}`);

  // Install BEFORE we mutate app.json so that on install failure the user is
  // left with a working app.json (no orphaned plugin entry pointing at a
  // missing package).
  log.step("Installing expo-splash-screen via expo install …");
  await expoInstall(target, "expo-splash-screen", pm);

  const assetsDir = path.join(target, "src/assets");
  ensureDir(assetsDir);
  const splashDest = path.join(assetsDir, "splash-icon.png");
  log.step(`Copying source → ${path.relative(target, splashDest)}`);
  fs.copyFileSync(absSrc, splashDest);

  log.step("Writing expo-splash-screen plugin entry to app.json …");
  setSplashConfig(target, color, "./src/assets/splash-icon.png", imageWidth);

  log.step("Wiring SplashScreen.hideAsync() into src/app/_layout.tsx …");
  patchLayoutForSplash(target);

  log.success("splash set.");
  log.raw("");
  log.raw(`  backgroundColor : ${color}`);
  log.raw(`  image           : src/assets/splash-icon.png`);
  log.raw(`  imageWidth      : ${imageWidth}dp (centered, contain)`);
  log.raw("");
  log.info(
    'Adjust `imageWidth` / `resizeMode` in app.json plugins["expo-splash-screen"] ' +
      "if the centered image renders too small or too large. Source image content " +
      "should sit within the central ~66% of the canvas — content too close to the " +
      "edges gets clipped by Android's launcher mask regardless of imageWidth.",
  );

  printFilesChanged([
    "src/assets/splash-icon.png",
    "app.json",
    "src/app/_layout.tsx",
    "package.json",
    lockfileFor(pm),
  ]);

  printAssetRebuildReminder(pm);
  log.raw("");
  log.warn(
    "If the splash doesn't update after rebuild: native splash assets cache " +
      "aggressively. Delete the app from the simulator / emulator first (iOS: " +
      "long-press → Remove App; Android: long-press → Uninstall, or " +
      "`adb uninstall <package>`), then `yarn ios` / `yarn android` again.",
  );
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
      `Missing recipe. Usage: react-native-expo-boilerplate add <${KNOWN_RECIPES.join("|")}>`,
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
