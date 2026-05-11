// Entry point. Order per PLAN_V5.md Phase 2 step 2 (v5-r6):
//   validateEnvVars → resolveTargetDir → runCreateExpoApp → cleanupBlankTemplate
//   → gatherAnswers → applyBase → applyConditionalOverlays → patches → install
//   → ensureLockfile → success message
//
// validateEnvVars MUST run before resolveTargetDir so a bad EXPO_PACKAGE_MANAGER
// value doesn't leave an orphan empty target dir behind.
import { resolveTargetDir } from "./bootstrap.js";
import { gatherAnswers, validateEnvVars } from "./prompts.js";
import { cleanupBlankTemplate, runCreateExpoApp } from "./scaffold.js";
import { log } from "./util.js";

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

  log.success(
    "Phase 3 complete (blank-typescript shell scaffolded). Phase 4+ wiring TBD.",
  );
}

main().catch((err) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
