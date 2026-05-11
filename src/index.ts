// Entry point. Order per PLAN_V5.md Phase 2 step 2:
//   validateEnvVars → resolveTargetDir → runCreateExpoApp → gatherAnswers → ...
import { resolveTargetDir } from "./bootstrap.js";
import { log } from "./util.js";

async function main(): Promise<void> {
  const arg = process.argv[2];
  // validateEnvVars() — Phase 2 will install pre-flight here.
  const target = await resolveTargetDir(arg);
  log.info(`Target dir: ${target.dir}`);
  log.info(`App name:   ${target.name}`);
  log.success("Phase 1 complete (target resolved). Phase 2+ wiring TBD.");
}

main().catch((err) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
