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
import { gatherAnswers, validateEnvVars } from "./prompts.js";
import { cleanupBlankTemplate, runCreateExpoApp } from "./scaffold.js";
import { applyBase, applyBottomSheet, applyImagePicker } from "./overlay.js";
import {
  patchAppJson,
  patchAppJsonPlugins,
  patchConstants,
  patchExpoRouterEntry,
  patchLayout,
  patchPackageJsonScripts,
  patchTsconfig,
} from "./patch.js";
import { patchBabel } from "./babel.js";
import { buildLayoutReplacements } from "./fonts.js";
import { ensureLockfile, installNativeDeps } from "./install.js";
import { log } from "./util.js";
import { readSDKNotes } from "./sdkNotes.js";

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
 * Locate `docs/SDK_NOTES.md`. Same layout assumption as `resolveTemplatesRoot`.
 */
function resolveSdkNotesPath(): string {
  return path.resolve(__dirname, "..", "docs", "SDK_NOTES.md");
}

async function main(): Promise<void> {
  validateEnvVars();

  const arg = process.argv[2];
  const target = await resolveTargetDir(arg);
  log.info(`Target dir: ${target.dir}`);
  log.info(`App name:   ${target.name}`);

  await runCreateExpoApp(target.dir, target.name);
  cleanupBlankTemplate(target.dir);

  const answers = await gatherAnswers();
  log.info(
    `Answers: primaryFont="${answers.primaryFont}" secondaryFont="${answers.secondaryFont}" ` +
      `bottomSheet=${answers.bottomSheet} imagePicker=${answers.imagePicker} pm=${answers.packageManager}`,
  );

  // ---- Apply templates ----
  const templatesRoot = resolveTemplatesRoot();
  log.step("Overlaying templates/base/ …");
  applyBase(target.dir, templatesRoot);
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
  patchExpoRouterEntry(target.dir);
  patchAppJsonPlugins(target.dir, answers);

  log.step("Splicing constants + layout sentinels …");
  patchConstants(target.dir, templatesRoot, answers);
  patchLayout(target.dir, buildLayoutReplacements(answers));

  // ---- Read SDK_NOTES.md probe outcomes ----
  const sdk = readSDKNotes(resolveSdkNotesPath());
  const flagsOk = sdk.get("FLAGS_OK") === "1";
  const probePass = sdk.get("PROBE_PASS") === "1";
  const workletsAutoIncluded =
    sdk.get("BABEL_PRESET_AUTO_INCLUDES_WORKLETS") === "1";
  const workletsPkg =
    sdk.get("WORKLETS_PKG") === "react-native-worklets-core"
      ? "react-native-worklets-core"
      : "react-native-worklets";
  const expoBaseUrlInherited = sdk.get("EXPO_TSCONFIG_BASEURL") !== "null";

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
      "@assets": "./assets",
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
  log.warn(
    "If the failure is mid-patch, the target dir may be in an inconsistent state. " +
      "Re-run the CLI (patches are idempotent and will converge), or `rm -rf <path>` and start fresh.",
  );
  process.exit(1);
});
