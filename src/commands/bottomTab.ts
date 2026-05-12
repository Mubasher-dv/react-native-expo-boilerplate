// `add bottom-tab <role>` — see
// docs/superpowers/specs/2026-05-13-bottom-tab-command-design.md.

import path from "node:path";
import fs from "node:fs";
import prompts from "prompts";
import { log } from "../util.js";
import { printFilesChanged } from "../add.js";
import {
  assertExpoApp,
  assertRoleLayoutParseable,
  assertRoleName,
  assertScreenName,
  featuresRoot,
  newJournal,
  printRebuildReminder,
  registerTabsInRoleLayout,
  rollback,
  roleExists,
  tabsGroupExists,
  writeTabsGroup,
} from "./shared.js";

const MIN_TABS = 2;
const MAX_TABS = 5;

export type AddBottomTabOptions = {
  target?: string;
  /** Test injection: skip count + name prompts. */
  promptInputs?: () => Promise<{ tabs: string[] }>;
  /** Test-only: throw after tab files are written, before the layout splice. */
  _failAfterWrites?: boolean;
};

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

async function promptTabsInteractive(): Promise<{ tabs: string[] }> {
  const countAnswer = await prompts(
    {
      type: "number",
      name: "count",
      message: `How many bottom tabs? (${MIN_TABS}–${MAX_TABS})`,
      validate: (v: number) =>
        Number.isInteger(v) && v >= MIN_TABS && v <= MAX_TABS
          ? true
          : `Enter an integer between ${MIN_TABS} and ${MAX_TABS}.`,
    },
    { onCancel: () => process.exit(1) },
  );
  const n = countAnswer.count as number;
  const tabs: string[] = [];
  for (let i = 1; i <= n; i++) {
    tabs.push(await promptName(`Tab #${i} name`));
  }
  return { tabs };
}

/**
 * `add bottom-tab <role>` — scaffolds a `(tabs)/` group inside an existing
 * hierarchical role. See spec for full semantics.
 */
export async function addBottomTab(
  roleArg: string | undefined,
  opts: AddBottomTabOptions = {},
): Promise<void> {
  const target = opts.target ?? process.cwd();
  const promptInputs = opts.promptInputs ?? promptTabsInteractive;

  assertExpoApp(target);

  // 1. role name
  const role = assertRoleName(
    roleArg && roleArg.trim() !== "" ? roleArg : await promptName("Role name"),
  );

  // 2. role must exist (hierarchical)
  if (!roleExists(target, role)) {
    throw new Error(
      `Role "${role}" does not exist. Run \`add role ${role}\` first.`,
    );
  }

  // 3. refuse if `<role>` is a standalone feature. Heuristic per spec: a
  // standalone feature has a root-level `features/<name>/types.ts` (shared
  // types for all flat screens); a hierarchical role has `types.ts` files
  // nested one level deeper (per nested feature). If the root-level types.ts
  // is present, treat as standalone.
  if (
    fs.existsSync(path.join(featuresRoot(target), role, "types.ts"))
  ) {
    throw new Error(
      `"${role}" is a standalone feature, not a hierarchical role. ` +
        `bottom-tabs requires a role created via \`add role\`.`,
    );
  }

  // 4. `(tabs)/` must not already exist
  if (tabsGroupExists(target, role)) {
    throw new Error(
      `Tabs group already exists at src/app/(${role})/(tabs)/. Remove it manually before re-running.`,
    );
  }

  // 5. role layout must be in a known shape (BEFORE any writes)
  assertRoleLayoutParseable(target, role);

  // 6. prompt tab count + names
  const inputs = await promptInputs();
  if (inputs.tabs.length < MIN_TABS || inputs.tabs.length > MAX_TABS) {
    throw new Error(
      `Tab count must be between ${MIN_TABS} and ${MAX_TABS} (got ${inputs.tabs.length}).`,
    );
  }
  const tabs = inputs.tabs.map((t) => assertScreenName(t));

  // 7. duplicate names within batch
  const seen = new Set<string>();
  for (const t of tabs) {
    if (seen.has(t)) {
      throw new Error(`Duplicate tab name "${t}". Tab names must be unique.`);
    }
    seen.add(t);
  }

  // 8. atomic writes
  const j = newJournal();
  const written: string[] = [];
  try {
    written.push(...writeTabsGroup(target, role, tabs, j));

    if (opts._failAfterWrites) {
      throw new Error("_failAfterWrites: simulated failure");
    }

    // 9. splice `<Stack.Screen name="(tabs)" />` into role's _layout.tsx
    const layoutPath = registerTabsInRoleLayout(target, role, j);
    if (layoutPath) written.push(layoutPath);
  } catch (err) {
    log.error(`add bottom-tab failed — rolling back changes`);
    await rollback(j);
    throw err;
  }

  const relWritten = written.map((p) => path.relative(target, p));
  printFilesChanged(relWritten);
  printRebuildReminder();
  log.success(`Bottom tabs for "${role}" ready (${tabs.length} tabs: ${tabs.join(", ")}).`);
}
