// `add feature <name>` (1-arg, standalone) — see
// docs/superpowers/specs/2026-05-12-standalone-feature-design.md.

import path from "node:path";
import prompts from "prompts";
import { log } from "../util.js";
import { printFilesChanged } from "../add.js";
import {
  assertExpoApp,
  assertFeatureName,
  assertRoutesParseable,
  assertScreenName,
  newJournal,
  printRebuildReminder,
  registerRoleInRoutes,
  rollback,
  routeFileExists,
  topLevelNameTaken,
  writeFlatRouteReExport,
  writeFlatScreenFiles,
  writeRoleGroup,
  writeStandaloneFeatureTypes,
} from "./shared.js";

export type AddStandaloneFeatureOptions = {
  target?: string;
  /** Test injection: override the first-screen prompt. */
  promptInputs?: () => Promise<{ screen: string }>;
  /** Test-only: throw after writes are recorded but before the routes splice. */
  _failAfterWrites?: boolean;
};

async function promptScreen(): Promise<{ screen: string }> {
  const a = await prompts(
    {
      type: "text",
      name: "screen",
      message: "First screen name?",
      validate: (v: string) => (v.trim() === "" ? "Required" : true),
    },
    { onCancel: () => process.exit(1) },
  );
  return { screen: a.screen };
}

export async function addStandaloneFeature(
  nameArg: string | undefined,
  opts: AddStandaloneFeatureOptions = {},
): Promise<void> {
  const target = opts.target ?? process.cwd();
  const promptInputs = opts.promptInputs ?? promptScreen;

  assertExpoApp(target);

  // 1. name
  let raw = nameArg;
  if (!raw || raw.trim() === "") {
    const a = await prompts(
      {
        type: "text",
        name: "feature",
        message: "Feature name?",
        validate: (v: string) => (v.trim() === "" ? "Required" : true),
      },
      { onCancel: () => process.exit(1) },
    );
    raw = a.feature;
  }
  const feature = assertFeatureName(raw!);

  // 2. top-level namespace guard — same name cannot be a role AND a standalone
  // feature. The on-disk shape is identical (both own `features/<name>/` and
  // `src/app/(<name>)/`), so any collision blocks creation. Partial states get
  // a more specific message so the user can see what was left behind.
  const taken = topLevelNameTaken(target, feature);
  if (taken) {
    if (taken.kind === "role") {
      throw new Error(
        `"${feature}" already exists as a role or standalone feature. Choose a different name.`,
      );
    }
    if (taken.kind === "groupOnly") {
      throw new Error(
        `Partial state: src/app/(${feature})/ exists but src/features/${feature}/ does not. Clean it up before retrying.`,
      );
    }
    throw new Error(
      `Partial state: src/features/${feature}/ exists but src/app/(${feature})/ does not. Clean it up before retrying.`,
    );
  }

  // 3. routes.tsx pre-flight (BEFORE any writes)
  assertRoutesParseable(target);

  // 4. first-screen prompt
  const inputs = await promptInputs();
  const screen = assertScreenName(inputs.screen);

  // 5. route-file collision
  if (routeFileExists(target, feature, screen)) {
    throw new Error(
      `Route file already exists: src/app/(${feature})/${screen}.tsx. Pick a different screen name.`,
    );
  }

  // 6. atomic writes
  const j = newJournal();
  const written: string[] = [];
  try {
    written.push(writeStandaloneFeatureTypes(target, feature, j));
    written.push(...writeFlatScreenFiles(target, feature, screen, j));
    written.push(...writeRoleGroup(target, feature, screen, j));
    written.push(writeFlatRouteReExport(target, feature, screen, j));

    if (opts._failAfterWrites) {
      throw new Error("_failAfterWrites: simulated failure");
    }

    // 7. routes.tsx splice — same helper works for any (name) group
    const routesPath = registerRoleInRoutes(target, feature, j);
    if (routesPath) written.push(routesPath);
  } catch (err) {
    log.error(`add feature failed — rolling back changes`);
    await rollback(j);
    throw err;
  }

  // 8. report + rebuild reminder
  const relWritten = written.map((p) => path.relative(target, p));
  printFilesChanged(relWritten);
  printRebuildReminder();
  log.success(`Feature "${feature}" ready.`);
}
