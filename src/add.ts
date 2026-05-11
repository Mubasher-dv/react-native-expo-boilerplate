// Post-scaffold `add` subcommands — retrofit a feature into an already-scaffolded
// project without re-running the full scaffolder.
//
// Surfaces (CLI dispatch in src/index.ts):
//   codingpixel-expo-app add bottom-sheet
//   codingpixel-expo-app add image-picker
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
import { applyBottomSheet, applyImagePicker } from "./overlay.js";
import type { PackageManager } from "./prompts.js";
import { detectPackageManager } from "./prompts.js";
import { fileExists, log } from "./util.js";

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
}

// ---------- dispatcher ----------

const KNOWN_FEATURES = ["bottom-sheet", "image-picker"] as const;
type Feature = (typeof KNOWN_FEATURES)[number];

export async function runAdd(feature: string | undefined): Promise<void> {
  if (!feature) {
    throw new Error(
      `Missing feature. Usage: codingpixel-expo-app add <${KNOWN_FEATURES.join("|")}>`,
    );
  }
  if (!(KNOWN_FEATURES as readonly string[]).includes(feature)) {
    throw new Error(
      `Unknown feature "${feature}". Supported: ${KNOWN_FEATURES.join(", ")}`,
    );
  }
  const target = process.cwd();
  log.info(`Target project: ${target}`);
  switch (feature as Feature) {
    case "bottom-sheet":
      return addBottomSheet(target);
    case "image-picker":
      return addImagePicker(target);
  }
}
