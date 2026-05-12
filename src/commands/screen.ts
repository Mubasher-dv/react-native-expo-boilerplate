// `add screen <role> <feature> <name>` — see design spec.

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
  readRouteFileFeatureOwner,
  routeFileExists,
  screenExists,
  rollback,
  updateRedirectTarget,
  writeRouteReExport,
  writeScreenFiles,
} from "./shared.js";

export type AddScreenOptions = {
  target?: string;
  promptInputs?: () => Promise<{ makeInitial: boolean }>;
  _failAfterWrites?: boolean;
};

async function promptViaPrompts(): Promise<{ makeInitial: boolean }> {
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
  return { makeInitial: a.makeInitial };
}

async function promptName(label: string): Promise<string> {
  const a = await prompts(
    {
      type: "text",
      name: "value",
      message: `${label}?`,
      validate: (v: string) => (v.trim() === "" ? "Required" : true),
    },
    { onCancel: () => process.exit(1) },
  );
  return a.value as string;
}

export async function addScreen(
  roleArg: string | undefined,
  featureArg: string | undefined,
  nameArg: string | undefined,
  opts: AddScreenOptions = {},
): Promise<void> {
  const target = opts.target ?? process.cwd();
  const promptInputs = opts.promptInputs ?? promptViaPrompts;

  assertExpoApp(target);

  const role = assertRoleName(
    roleArg && roleArg.trim() !== "" ? roleArg : await promptName("Role name"),
  );
  const feature = assertFeatureName(
    featureArg && featureArg.trim() !== "" ? featureArg : await promptName("Feature name"),
  );

  if (!featureExists(target, role, feature)) {
    throw new Error(
      `Feature "${role}/${feature}" does not exist. Create it with \`add feature ${role} ${feature}\` first.`,
    );
  }

  const screen = assertScreenName(
    nameArg && nameArg.trim() !== "" ? nameArg : await promptName("Screen name"),
  );

  if (screenExists(target, role, feature, screen)) {
    throw new Error(
      `Screen "${role}/${feature}/${screen}" already exists at src/features/${role}/${feature}/${screen}.`,
    );
  }

  if (routeFileExists(target, role, screen)) {
    const owner = readRouteFileFeatureOwner(target, role, screen);
    const ownerNote = owner
      ? `owned by feature "${role}/${owner}"`
      : "owned by another feature in this role";
    throw new Error(
      `Route file already exists: src/app/(${role})/${screen}.tsx (${ownerNote}). Pick a different screen name.`,
    );
  }

  const inputs = await promptInputs();

  const j = newJournal();
  const written: string[] = [];
  try {
    written.push(...writeScreenFiles(target, role, feature, screen, j));
    written.push(writeRouteReExport(target, role, feature, screen, j));

    if (opts._failAfterWrites) {
      throw new Error("_failAfterWrites: simulated failure");
    }

    if (inputs.makeInitial) {
      written.push(updateRedirectTarget(target, role, screen, j));
    }
  } catch (err) {
    log.error(`add screen failed — rolling back changes`);
    await rollback(j);
    throw err;
  }

  const relWritten = written.map((p) => path.relative(target, p));
  printFilesChanged(relWritten);
  printRebuildReminder();
  log.success(`Screen "${role}/${feature}/${screen}" ready.`);
}
