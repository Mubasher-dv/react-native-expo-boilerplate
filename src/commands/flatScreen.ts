// `add screen <feature> <name>` (2-arg, flat) — see
// docs/superpowers/specs/2026-05-12-standalone-feature-design.md.

import path from "node:path";
import fs from "node:fs";
import prompts from "prompts";
import { log } from "../util.js";
import { printFilesChanged } from "../add.js";
import {
  assertExpoApp,
  assertFeatureName,
  assertScreenName,
  flatScreenDir,
  isStandaloneFeature,
  newJournal,
  printRebuildReminder,
  readFlatRouteFileFeatureOwner,
  rollback,
  routeFileExists,
  updateRedirectTarget,
  writeFlatRouteReExport,
  writeFlatScreenFiles,
} from "./shared.js";

export type AddFlatScreenOptions = {
  target?: string;
  promptInputs?: () => Promise<{ makeInitial: boolean }>;
  _failAfterWrites?: boolean;
};

async function promptMakeInitial(): Promise<{ makeInitial: boolean }> {
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

export async function addFlatScreen(
  featureArg: string | undefined,
  nameArg: string | undefined,
  opts: AddFlatScreenOptions = {},
): Promise<void> {
  const target = opts.target ?? process.cwd();
  const promptInputs = opts.promptInputs ?? promptMakeInitial;

  assertExpoApp(target);

  // 1. feature name
  const feature = assertFeatureName(
    featureArg && featureArg.trim() !== ""
      ? featureArg
      : await promptName("Feature name"),
  );

  // 2. must be a standalone feature (route group exists). If the name maps to
  // a hierarchical role, point the user at the 3-arg form.
  if (!isStandaloneFeature(target, feature)) {
    throw new Error(
      `"${feature}" is not a standalone feature. For hierarchical roles, use ` +
        `\`add screen <role> <feature> <name>\` (3-arg form).`,
    );
  }

  // 3. screen name
  const screen = assertScreenName(
    nameArg && nameArg.trim() !== "" ? nameArg : await promptName("Screen name"),
  );

  // 4. screen folder already exists?
  if (fs.existsSync(flatScreenDir(target, feature, screen))) {
    throw new Error(
      `Screen "${feature}/${screen}" already exists at src/features/${feature}/${screen}.`,
    );
  }

  // 5. route-file collision
  if (routeFileExists(target, feature, screen)) {
    const owner = readFlatRouteFileFeatureOwner(target, feature, screen);
    const ownerNote = owner
      ? `owned by feature "${owner}"`
      : "owned by another feature";
    throw new Error(
      `Route file already exists: src/app/(${feature})/${screen}.tsx (${ownerNote}). Pick a different screen name.`,
    );
  }

  // 6. makeInitial prompt
  const inputs = await promptInputs();

  // 7. atomic writes
  const j = newJournal();
  const written: string[] = [];
  try {
    written.push(...writeFlatScreenFiles(target, feature, screen, j));
    written.push(writeFlatRouteReExport(target, feature, screen, j));

    if (opts._failAfterWrites) {
      throw new Error("_failAfterWrites: simulated failure");
    }

    if (inputs.makeInitial) {
      written.push(updateRedirectTarget(target, feature, screen, j));
    }
  } catch (err) {
    log.error(`add screen failed — rolling back changes`);
    await rollback(j);
    throw err;
  }

  const relWritten = written.map((p) => path.relative(target, p));
  printFilesChanged(relWritten);
  printRebuildReminder();
  log.success(`Screen "${feature}/${screen}" ready.`);
}
