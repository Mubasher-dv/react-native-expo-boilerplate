// `add role <name>` — see docs/superpowers/specs/2026-05-12-role-feature-screen-commands-design.md.

import path from "node:path";
import prompts from "prompts";
import { log } from "../util.js";
import { printFilesChanged } from "../add.js";
import {
  assertExpoApp,
  assertNotRoleRefusal,
  assertRoleName,
  assertFeatureName,
  assertScreenName,
  assertRoutesParseable,
  newJournal,
  printRebuildReminder,
  registerRoleInRoutes,
  roleExists,
  routeFileExists,
  rollback,
  topLevelNameTaken,
  writeFeatureTypes,
  writeRoleGroup,
  writeRouteReExport,
  writeScreenFiles,
} from "./shared.js";

export type AddRoleOptions = {
  /** Target project root. Defaults to `process.cwd()`. */
  target?: string;
  /** Override the prompts step (test injection). Defaults to the real prompts call. */
  promptInputs?: () => Promise<{ feature: string; screen: string }>;
  /** Test-only: throw after writes are recorded but before the routes splice. */
  _failAfterWrites?: boolean;
};

async function promptViaPrompts(): Promise<{ feature: string; screen: string }> {
  const a = await prompts(
    [
      {
        type: "text",
        name: "feature",
        message: "First feature name?",
        validate: (v: string) => (v.trim() === "" ? "Required" : true),
      },
      {
        type: "text",
        name: "screen",
        message: "First screen name?",
        validate: (v: string) => (v.trim() === "" ? "Required" : true),
      },
    ],
    { onCancel: () => process.exit(1) },
  );
  return { feature: a.feature, screen: a.screen };
}

export async function addRole(
  roleArg: string | undefined,
  opts: AddRoleOptions = {},
): Promise<void> {
  const target = opts.target ?? process.cwd();
  const promptInputs = opts.promptInputs ?? promptViaPrompts;

  assertExpoApp(target);

  // 1. role name
  let roleRaw = roleArg;
  if (!roleRaw || roleRaw.trim() === "") {
    const a = await prompts(
      {
        type: "text",
        name: "role",
        message: "Role name?",
        validate: (v: string) => (v.trim() === "" ? "Required" : true),
      },
      { onCancel: () => process.exit(1) },
    );
    roleRaw = a.role;
  }
  const role = assertRoleName(roleRaw!);

  // 1a. hardcoded refusal — names that should be standalone features, not
  // roles (e.g. `auth`). Throws with a hint to use `add feature <name>`.
  assertNotRoleRefusal(role);

  // 2. role-existence guard. `topLevelNameTaken` reports partial states
  // (groupOnly / featuresOnly) for clearer diagnostics; if either exists, we
  // refuse — a hierarchical role and a standalone feature share namespace.
  const taken = topLevelNameTaken(target, role);
  if (taken || roleExists(target, role)) {
    throw new Error(
      `Role "${role}" already exists (src/features/${role} or src/app/(${role}) is present).`,
    );
  }

  // 3. routes.tsx pre-flight (BEFORE any writes)
  assertRoutesParseable(target);

  // 4 + 5. prompts
  const inputs = await promptInputs();
  const feature = assertFeatureName(inputs.feature);
  const screen = assertScreenName(inputs.screen);

  // 6. route-file collision
  if (routeFileExists(target, role, screen)) {
    throw new Error(
      `Route file already exists: src/app/(${role})/${screen}.tsx. Pick a different screen name.`,
    );
  }

  // 7. atomic writes
  const j = newJournal();
  const written: string[] = [];
  try {
    written.push(writeFeatureTypes(target, role, feature, j));
    written.push(...writeScreenFiles(target, role, feature, screen, j));
    written.push(...writeRoleGroup(target, role, screen, j));
    written.push(writeRouteReExport(target, role, feature, screen, j));

    if (opts._failAfterWrites) {
      throw new Error("_failAfterWrites: simulated failure");
    }

    // 8. routes.tsx splice
    const routesPath = registerRoleInRoutes(target, role, j);
    if (routesPath) written.push(routesPath);
  } catch (err) {
    log.error(`add role failed — rolling back changes`);
    await rollback(j);
    throw err;
  }

  // 9 + 10. report + rebuild reminder
  const relWritten = written.map((p) => path.relative(target, p));
  printFilesChanged(relWritten);
  printRebuildReminder();
  log.success(`Role "${role}" ready.`);
}
