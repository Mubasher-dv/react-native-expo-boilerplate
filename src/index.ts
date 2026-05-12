// Entry point. Order per PLAN_V5.md (consolidated v5-r6):
//   validateEnvVars
//   → resolveTargetDir
//   → runCreateExpoApp + cleanupBlankTemplate
//   → gatherAnswers
//   → applyBase + applyBottomSheet + applyImagePicker
//   → patchAppJson + patchExpoRouterEntry + patchAppJsonPlugins
//   → patchConstants + patchLayout
//   → patchPackageJsonScripts + patchTsconfig + patchBabel
//   → installNativeDeps
//   → ensureLockfile
//   → success message

import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTargetDir } from "./bootstrap.js";
import { runAdd } from "./add.js";
import { gatherAnswers, validateEnvVars } from "./prompts.js";
import {
  cleanupBlankTemplate,
  moveExpoIconsIntoSrcAssets,
  runCreateExpoApp,
} from "./scaffold.js";
import { applyBase, applyBottomSheet, applyImagePicker } from "./overlay.js";
import {
  patchAppJson,
  patchAppJsonAssetPaths,
  patchAppJsonPlugins,
  patchConstants,
  patchExpoRouterEntry,
  patchLayout,
  patchPackageJsonScripts,
  patchReadme,
  patchTsconfig,
} from "./patch.js";
import { patchBabel } from "./babel.js";
import { buildLayoutReplacements } from "./fonts.js";
import { ensureLockfile, installNativeDeps } from "./install.js";
import { ensureDir, log } from "./util.js";
import { readSDKNotes } from "./sdkNotes.js";
import { SDK_PROBE_RESULTS } from "./sdkProbeResults.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Locate `templates/` directory. In the published package layout, it sits at
 * `<pkgRoot>/templates/`; this file lives at `<pkgRoot>/dist/index.js`. So one
 * level up from `dist/` reaches the package root.
 */
function resolveTemplatesRoot(): string {
  return path.resolve(__dirname, "..", "templates");
}

/**
 * Locate `docs/SDK_NOTES.md` for OPTIONAL out-of-tree dev runs (when the CLI
 * is invoked from its own source tree with fresh probe results). Production
 * runs from a published tarball read from `SDK_PROBE_RESULTS` instead.
 */
function resolveSdkNotesPath(): string {
  return path.resolve(__dirname, "..", "docs", "SDK_NOTES.md");
}

async function main(): Promise<void> {
  // Subcommand dispatch — MUST precede `validateEnvVars` (which is scoped to
  // the scaffold flow's env vars) and `resolveTargetDir` (which rejects an
  // existing `package.json` in cwd — the exact condition `add` requires).
  //
  // Single verb: `add`. (Earlier versions exposed `generate` + `g` aliases —
  // dropped to keep the surface minimal; only `add` remains supported.)
  const argv = process.argv.slice(2);
  if (argv[0] === "add" && argv[1] === "role") {
    const { addRole } = await import("./commands/role.js");
    await addRole(argv[2]);
    return;
  }
  if (argv[0] === "add" && argv[1] === "feature") {
    const { addFeature } = await import("./commands/feature.js");
    await addFeature(argv[2], argv[3]);
    return;
  }
  if (argv[0] === "add" && argv[1] === "screen") {
    const { addScreen } = await import("./commands/screen.js");
    await addScreen(argv[2], argv[3], argv[4]);
    return;
  }
  if (argv[0] === "add") {
    await runAdd(argv[1]);
    return;
  }

  validateEnvVars();

  const arg = argv[0];
  const target = await resolveTargetDir(arg);
  log.info(`Target dir: ${target.dir}`);
  log.info(`App name:   ${target.name}`);

  await runCreateExpoApp(target.dir, target.name);
  cleanupBlankTemplate(target.dir);
  moveExpoIconsIntoSrcAssets(target.dir);

  const answers = await gatherAnswers();
  log.info(
    `Answers: primaryFont="${answers.primaryFont}" secondaryFont="${answers.secondaryFont}" ` +
      `bottomSheet=${answers.bottomSheet} imagePicker=${answers.imagePicker} pm=${answers.packageManager}`,
  );

  // ---- Apply templates ----
  const templatesRoot = resolveTemplatesRoot();
  log.step("Overlaying templates/base/ …");
  applyBase(target.dir, templatesRoot);

  // Ensure empty dirs that npm strips from the tarball still exist in the
  // generated app (Deviation #22 + extension). All four are intentionally
  // empty placeholders apps fill as features grow / they drop fonts/images.
  // No `.gitkeep` is shipped — `ensureDir` creates the bare directory.
  for (const rel of [
    "src/features",
    "src/core/hooks",
    "src/assets/fonts",
    "src/assets/images",
  ]) {
    ensureDir(path.join(target.dir, rel));
  }

  if (answers.bottomSheet) {
    log.step("Overlaying templates/bottom-sheet/ …");
    applyBottomSheet(target.dir, templatesRoot);
  }
  if (answers.imagePicker) {
    log.step("Overlaying templates/image-picker/ …");
    applyImagePicker(target.dir, templatesRoot);
  }

  // ---- Patches ----
  log.step("Patching app.json + expo-router entry …");
  patchAppJson(target.dir, target.name, answers);
  patchAppJsonAssetPaths(target.dir);
  patchExpoRouterEntry(target.dir);
  patchAppJsonPlugins(target.dir, answers);

  log.step("Splicing constants + layout sentinels …");
  patchConstants(target.dir, templatesRoot, answers);
  patchLayout(target.dir, buildLayoutReplacements(answers));

  log.step("Patching README.md app-name placeholder …");
  patchReadme(target.dir, target.name);

  // ---- Resolve probe outcomes ----
  // Primary: baked-in `SDK_PROBE_RESULTS` (always available; ships in dist/).
  // Override: `docs/SDK_NOTES.md` if present in the CLI source tree (out-of-tree
  // development scenarios where probe was just re-run against a newer SDK).
  const sdk = readSDKNotes(resolveSdkNotesPath());
  const get = (key: string, fallback: string): string =>
    sdk.get(key) ?? fallback;
  const flagsOk = get("FLAGS_OK", SDK_PROBE_RESULTS.FLAGS_OK ? "1" : "0") === "1";
  const probePass = get("PROBE_PASS", SDK_PROBE_RESULTS.PROBE_PASS ? "1" : "0") === "1";
  const workletsAutoIncluded =
    get(
      "BABEL_PRESET_AUTO_INCLUDES_WORKLETS",
      SDK_PROBE_RESULTS.BABEL_PRESET_AUTO_INCLUDES_WORKLETS ? "1" : "0",
    ) === "1";
  const workletsPkg =
    get("WORKLETS_PKG", SDK_PROBE_RESULTS.WORKLETS_PKG) ===
    "react-native-worklets-core"
      ? "react-native-worklets-core"
      : "react-native-worklets";
  const baseUrlNoteRaw = get(
    "EXPO_TSCONFIG_BASEURL",
    SDK_PROBE_RESULTS.EXPO_TSCONFIG_BASEURL_INHERITED ? "." : "null",
  );
  const expoBaseUrlInherited = baseUrlNoteRaw !== "null";

  log.step("Patching package.json scripts + tsconfig + babel.config.js …");
  patchPackageJsonScripts(target.dir);
  patchTsconfig(target.dir, { expoBaseUrlInherited });
  patchBabel(target.dir, {
    workletsAutoIncluded,
    workletsPkg,
    aliasMap: {
      "@": "./src",
      "@theme": "./src/ui/theme",
      "@utils": "./src/core/utils",
      "@redux": "./src/core/redux",
      "@core": "./src/core",
      "@services": "./src/core/services",
      "@hooks": "./src/core/hooks",
      "@appComponents": "./src/ui/appComponents",
      "@components": "./src/ui/components",
      "@icons": "./src/ui/iconComponents",
      "@features": "./src/features",
      "@assets": "./src/assets",
    },
  });

  // ---- Install + verify ----
  await installNativeDeps(target.dir, answers, { flagsOk, workletsPkg });
  const lockOutcome = await ensureLockfile(target.dir, answers, { probePass, flagsOk });

  // ---- Success ----
  const cmdPm = lockOutcome.producedPm === "yarn" ? "yarn" : "npm run";
  log.success(`Project ready at ${target.dir}`);
  log.raw("");
  log.raw(`  cd ${path.relative(process.cwd(), target.dir) || target.name}`);
  log.raw(`  ${cmdPm} ios       # one-time: builds + installs custom dev-client + launches`);
  log.raw(`  ${cmdPm} android   # same for android (needs emulator/device + Android SDK)`);
  log.raw("");
  log.raw(`  ${cmdPm} start     # subsequent runs: faster — connects to installed dev-client`);
  log.raw("");
  log.info(
    "First run takes 3-10 min (native build). After that, `start` is fast. " +
      "iOS needs Xcode + CocoaPods; Android needs SDK + emulator. Not Expo-Go-compatible.",
  );
}

main().catch((err) => {
  log.error(err instanceof Error ? err.message : String(err));
  // Mid-patch warning is scaffold-flow specific. `add` failures either
  // pre-mutation (guard) or single-file (overlay overwrite already happened
  // before the throw) — separate guidance below.
  const isAdd = process.argv[2] === "add";
  if (isAdd) {
    log.warn(
      "Recipe failed partway: any files already copied are on disk, but the rest didn't run. " +
        "All recipes are idempotent — re-run the same command after fixing the root cause (network, " +
        "missing path, etc.) and it will converge.",
    );
  } else {
    log.warn(
      "If the failure is mid-patch, the target dir may be in an inconsistent state. " +
        "Re-run the CLI (patches are idempotent and will converge), or `rm -rf <path>` and start fresh.",
    );
  }
  process.exit(1);
});
