// `add feature <role> <name>` — see design spec.

import path from "node:path";
import prompts from "prompts";
import { log } from "../util.js";
import { printFilesChanged } from "../add.js";
import {
  assertExpoApp,
  assertFeatureName,
  assertRoleName,
  assertScreenName,
  featureExists,
  newJournal,
  printRebuildReminder,
  roleExists,
  routeFileExists,
  rollback,
  updateRedirectTarget,
  writeFeatureTypes,
  writeRouteReExport,
  writeScreenFiles,
} from "./shared.js";

export type AddFeatureOptions = {
  target?: string;
  promptInputs?: () => Promise<{ screen: string; makeInitial: boolean }>;
  _failAfterWrites?: boolean;
};

async function promptScreenName(): Promise<string> {
  const a = await prompts(
    {
      type: "text",
      name: "screen",
      message: "Screen name?",
      validate: (v: string) => (v.trim() === "" ? "Required" : true),
    },
    { onCancel: () => process.exit(1) },
  );
  return a.screen as string;
}

async function promptMakeInitial(): Promise<boolean> {
  const a = await prompts(
    {
      type: "toggle",
      name: "makeInitial",
      message: "Make initial screen of stack?",
      initial: false,
      active: "yes",
      inactive: "no",
    },
    { onCancel: () => process.exit(1) },
  );
  return a.makeInitial as boolean;
}

export async function addFeature(
  roleArg: string | undefined,
  nameArg: string | undefined,
  opts: AddFeatureOptions = {},
): Promise<void> {
  const target = opts.target ?? process.cwd();
  const injectedPromptInputs = opts.promptInputs;

  assertExpoApp(target);

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

  if (!roleExists(target, role)) {
    throw new Error(
      `Role "${role}" does not exist. Run \`add role ${role}\` first.`,
    );
  }

  let nameRaw = nameArg;
  if (!nameRaw || nameRaw.trim() === "") {
    const a = await prompts(
      {
        type: "text",
        name: "feature",
        message: "Feature name?",
        validate: (v: string) => (v.trim() === "" ? "Required" : true),
      },
      { onCancel: () => process.exit(1) },
    );
    nameRaw = a.feature;
  }
  const feature = assertFeatureName(nameRaw!);

  if (featureExists(target, role, feature)) {
    throw new Error(
      `Feature "${role}/${feature}" already exists at src/features/${role}/${feature}.`,
    );
  }

  let screenRaw: string;
  let makeInitial: boolean;

  if (injectedPromptInputs) {
    // Test path: single call returns both up front. Order is irrelevant in tests.
    const inputs = await injectedPromptInputs();
    screenRaw = inputs.screen;
    makeInitial = inputs.makeInitial;
  } else {
    // Production path: prompt screen name first, run collision check, THEN prompt makeInitial.
    screenRaw = await promptScreenName();
    makeInitial = false; // placeholder, overwritten after collision check passes
  }

  const screen = assertScreenName(screenRaw);

  if (routeFileExists(target, role, screen)) {
    throw new Error(
      `Route file already exists: src/app/(${role})/${screen}.tsx (another feature owns this screen). Pick a different screen name.`,
    );
  }

  if (!injectedPromptInputs) {
    // Now that the collision check passed, prompt makeInitial.
    makeInitial = await promptMakeInitial();
  }

  const j = newJournal();
  const written: string[] = [];
  try {
    written.push(writeFeatureTypes(target, role, feature, j));
    written.push(...writeScreenFiles(target, role, feature, screen, j));
    written.push(writeRouteReExport(target, role, feature, screen, j));

    if (opts._failAfterWrites) {
      throw new Error("_failAfterWrites: simulated failure");
    }

    if (makeInitial) {
      written.push(updateRedirectTarget(target, role, screen, j));
    }
  } catch (err) {
    log.error(`add feature failed — rolling back changes`);
    await rollback(j);
    throw err;
  }

  const relWritten = written.map((p) => path.relative(target, p));
  printFilesChanged(relWritten);
  printRebuildReminder();
  log.success(`Feature "${role}/${feature}" ready.`);
}
