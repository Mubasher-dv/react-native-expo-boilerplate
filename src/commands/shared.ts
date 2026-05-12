// Shared helpers for `add role|feature|screen` commands.
// See docs/superpowers/specs/2026-05-12-role-feature-screen-commands-design.md.

import fs from "node:fs";
import path from "node:path";
import { dirExists, fileExists, log } from "../util.js";

/**
 * Allowed pre-normalize character set: alphanumerics plus the three accepted
 * separators (whitespace / `-` / `_`). Anything else is rejected so silent
 * normalization can't hide a typo.
 */
const ALLOWED_PRE_NORMALIZE = /^[a-zA-Z0-9\-_\s]+$/;

/**
 * Split on any run of whitespace, `-`, or `_`. Camel-join the resulting words:
 * first word has its first character lowercased (so `TeamDetails` becomes
 * `teamDetails` — internal capitalization is preserved); subsequent words
 * have their first character uppercased and the rest preserved.
 */
export function normalizeCamelCase(input: string): string {
  if (input.trim() === "") {
    throw new Error("Name is empty.");
  }
  if (!ALLOWED_PRE_NORMALIZE.test(input)) {
    throw new Error(
      `Invalid character in "${input}". Use letters, digits, spaces, hyphens, or underscores only.`,
    );
  }
  const parts = input.split(/[\s\-_]+/).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Name is empty.");
  }
  if (/^[0-9]/.test(parts[0]!)) {
    throw new Error(`Name "${input}" cannot start with a digit.`);
  }
  const [first, ...rest] = parts;
  const head = first!.charAt(0).toLowerCase() + first!.slice(1);
  const tail = rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  return head + tail;
}

/** Uppercase first char of a non-empty string; preserve the rest. */
export function pascalCase(camel: string): string {
  if (camel === "") {
    throw new Error("pascalCase: input is empty.");
  }
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Names that cannot be used for any of role / feature / screen because they
 * collide with existing CLI verbs, recipe names, or Expo Router special files.
 * Comparison is case-insensitive against the *normalized* (camelCase) form.
 */
export const RESERVED_NAMES = [
  "add",
  "role",
  "feature",
  "screen",
  "index",
  "_layout",
  "app",
  "features",
  "routes",
  "bottom-sheet",
  "image-picker",
  "app-icon",
  "splash",
  // `add bottom-tab` subcommand verb — role/feature/screen/tab names cannot
  // shadow it. Same case-insensitive normalization comparison as the rest.
  "bottom-tab",
  "tabs",
] as const;

const MAX_NAME_LEN = 40;
const POST_NORMALIZE_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Normalize + length + pattern + reserved-name check. Throws on any failure;
 * returns the normalized name on success. Same logic for all three kinds —
 * separate exports give clearer error sites in callers and let us tighten
 * per-kind rules later without churning call sites.
 */
function assertName(kind: "role" | "feature" | "screen", input: string): string {
  const normalized = normalizeCamelCase(input);
  if (normalized.length > MAX_NAME_LEN) {
    throw new Error(
      `${kind} name "${normalized}" exceeds length limit (${MAX_NAME_LEN} chars).`,
    );
  }
  if (!POST_NORMALIZE_PATTERN.test(normalized)) {
    throw new Error(
      `${kind} name "${normalized}" must match /^[a-z][a-zA-Z0-9]*$/ after normalization.`,
    );
  }
  // Reserved entries may themselves be raw forms (e.g. "_layout", "bottom-sheet").
  // Normalize each for an apples-to-apples comparison against the normalized input.
  const reservedNormalized = new Set(
    RESERVED_NAMES.map((r) => {
      try {
        return normalizeCamelCase(r).toLowerCase();
      } catch {
        return r.toLowerCase();
      }
    }),
  );
  if (reservedNormalized.has(normalized.toLowerCase())) {
    throw new Error(
      `${kind} name "${normalized}" is reserved. Pick a different name.`,
    );
  }
  return normalized;
}

export function assertRoleName(input: string): string {
  return assertName("role", input);
}
export function assertFeatureName(input: string): string {
  return assertName("feature", input);
}
export function assertScreenName(input: string): string {
  return assertName("screen", input);
}

/**
 * Names that should be created via `add feature <name>` (1-arg standalone form),
 * NOT `add role <name>`. Maps name → hint string. Lookup is case-insensitive vs
 * the normalized (camelCase, lowercased) form. Extending the map in future
 * iterations is non-breaking.
 */
export const ROLE_REFUSAL_HINTS: Record<string, string> = {
  auth: "use `add feature auth` instead",
};

/**
 * Throws if the supplied (already-normalized) role name appears in
 * `ROLE_REFUSAL_HINTS`. Called from `addRole` after `assertRoleName` succeeds —
 * the name is structurally valid, just semantically wrong for the role tier.
 */
export function assertNotRoleRefusal(role: string): void {
  const hint = ROLE_REFUSAL_HINTS[role.toLowerCase()];
  if (hint) {
    throw new Error(
      `"${role}" should be a feature, not a role. ${hint}.`,
    );
  }
}

/* ---------- Path helpers ---------- */

export function featuresRoot(target: string): string {
  return path.join(target, "src", "features");
}
export function roleFeaturesDir(target: string, role: string): string {
  return path.join(featuresRoot(target), role);
}
export function featureDir(target: string, role: string, feature: string): string {
  return path.join(roleFeaturesDir(target, role), feature);
}
export function screenDir(
  target: string,
  role: string,
  feature: string,
  screen: string,
): string {
  return path.join(featureDir(target, role, feature), screen);
}
export function viewModelDir(
  target: string,
  role: string,
  feature: string,
  screen: string,
): string {
  return path.join(screenDir(target, role, feature, screen), "viewModel");
}
export function routeGroupDir(target: string, role: string): string {
  return path.join(target, "src", "app", `(${role})`);
}
export function routeFile(target: string, role: string, screen: string): string {
  return path.join(routeGroupDir(target, role), `${screen}.tsx`);
}
export function redirectFile(target: string, role: string): string {
  return path.join(routeGroupDir(target, role), "index.tsx");
}
export function layoutFile(target: string, role: string): string {
  return path.join(routeGroupDir(target, role), "_layout.tsx");
}
export function routesTsxPath(target: string): string {
  return path.join(target, "src", "app", "routes.tsx");
}

/* ---------- Existence checks ---------- */

/** True if either the features dir OR the route group dir is on disk. */
export function roleExists(target: string, role: string): boolean {
  return (
    dirExists(roleFeaturesDir(target, role)) || dirExists(routeGroupDir(target, role))
  );
}
export function featureExists(
  target: string,
  role: string,
  feature: string,
): boolean {
  return dirExists(featureDir(target, role, feature));
}
export function screenExists(
  target: string,
  role: string,
  feature: string,
  screen: string,
): boolean {
  return dirExists(screenDir(target, role, feature, screen));
}
export function routeFileExists(
  target: string,
  role: string,
  screen: string,
): boolean {
  return fileExists(routeFile(target, role, screen));
}

/**
 * Best-effort: parse a route re-export file and return the feature segment
 * from its `@features/<role>/<feature>/<screen>` import path. Returns null if
 * the file is missing or doesn't match the expected re-export shape (e.g. a
 * user hand-edited it). Used by collision errors to point the caller at the
 * owning feature.
 */
export function readRouteFileFeatureOwner(
  target: string,
  role: string,
  screen: string,
): string | null {
  const f = routeFile(target, role, screen);
  if (!fileExists(f)) return null;
  let src: string;
  try {
    src = fs.readFileSync(f, "utf8");
  } catch {
    return null;
  }
  const rolePattern = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`@features/${rolePattern}/([^/"\\s]+)/`);
  const m = src.match(re);
  return m ? m[1]! : null;
}

/* ---------- Standalone feature helpers ---------- */

/**
 * Path helpers — alias signatures for flat-feature ergonomics. The on-disk
 * paths are identical to the hierarchical ones (`<feature>` slot occupies the
 * same level as `<role>` did) — these wrappers exist so call sites read
 * naturally and so future divergence is cheap.
 */
export function flatScreenDir(
  target: string,
  feature: string,
  screen: string,
): string {
  return path.join(featuresRoot(target), feature, screen);
}
export function flatViewModelDir(
  target: string,
  feature: string,
  screen: string,
): string {
  return path.join(flatScreenDir(target, feature, screen), "viewModel");
}

/**
 * A standalone feature is one whose `(name)/` route group exists at
 * `src/app/(<name>)/`. Both hierarchical roles and standalone features create
 * a route group with this exact shape — so when this check fires from
 * `addFlatScreen` after the feature-name has already been validated as a
 * top-level entity, the presence of the group is sufficient to treat the
 * target as standalone for the flat-screen flow. Hierarchical role-features
 * never create their own group (the group belongs to the role).
 */
export function isStandaloneFeature(target: string, name: string): boolean {
  return dirExists(routeGroupDir(target, name));
}

/**
 * Tighter check used by `addStandaloneFeature` pre-flight: BOTH the features
 * dir and the route group dir must already be present for the name to count
 * as a fully-materialized standalone feature.
 */
export function standaloneFeatureExists(target: string, name: string): boolean {
  return (
    dirExists(roleFeaturesDir(target, name)) &&
    dirExists(routeGroupDir(target, name))
  );
}

/**
 * Reports which kind of top-level entity (if any) already owns `name`.
 * Returns null if the name is free. The four collision kinds:
 *   - `role`         → both features dir and group exist (could be a role
 *                       with nested features, or a standalone feature; we
 *                       don't distinguish at this layer — both block reuse)
 *   - `standalone`   → alias for the above when the caller wants to spell out
 *                       "this is a standalone feature." Not currently emitted
 *                       separately — `topLevelNameTaken` returns `role` in
 *                       both cases since the on-disk shape is identical.
 *   - `groupOnly`    → `src/app/(<name>)/` exists but `features/<name>/`
 *                       does not (partial / hand-deleted state)
 *   - `featuresOnly` → inverse
 *
 * Caller uses `kind` to produce a precise error message.
 */
export function topLevelNameTaken(
  target: string,
  name: string,
): { kind: "role" | "groupOnly" | "featuresOnly" } | null {
  const hasFeatures = dirExists(roleFeaturesDir(target, name));
  const hasGroup = dirExists(routeGroupDir(target, name));
  if (hasFeatures && hasGroup) return { kind: "role" };
  if (hasGroup) return { kind: "groupOnly" };
  if (hasFeatures) return { kind: "featuresOnly" };
  return null;
}

/**
 * Best-effort: parse a flat re-export file (`export { default } from
 * "@features/<feature>/<screen>"`) and return the feature segment. Returns
 * null when the file is missing or the import path is unrecognized.
 *
 * Distinct from `readRouteFileFeatureOwner` (which parses the 3-segment
 * hierarchical import). The flat-screen route file lives in a standalone
 * feature's route group; the import is always 2 segments.
 */
export function readFlatRouteFileFeatureOwner(
  target: string,
  feature: string,
  screen: string,
): string | null {
  const f = routeFile(target, feature, screen);
  if (!fileExists(f)) return null;
  let src: string;
  try {
    src = fs.readFileSync(f, "utf8");
  } catch {
    return null;
  }
  // Match `@features/<owner>/<screen>` — 2 segments, no trailing slash.
  // `<owner>` is the feature segment (== `feature` arg when consistent).
  const re = /@features\/([^/"\s]+)\/[^/"\s]+["']/;
  const m = src.match(re);
  return m ? m[1]! : null;
}

/* ---------- Journal + rollback ---------- */

export type Journal = {
  created: string[];
  createdDirs: string[];
  edited: Array<{ path: string; before: string }>;
};

export function newJournal(): Journal {
  return { created: [], createdDirs: [], edited: [] };
}

export function recordCreate(j: Journal, abs: string): void {
  j.created.push(abs);
}
export function recordDir(j: Journal, abs: string): void {
  j.createdDirs.push(abs);
}
export function recordEdit(j: Journal, abs: string, before: string): void {
  j.edited.push({ path: abs, before });
}

/**
 * Undo everything recorded. Order: edited (restore) → created files (unlink) →
 * created dirs (rmdir deepest-first, only if still empty). Best-effort — a
 * single rollback failure does not abort the rest.
 */
export async function rollback(j: Journal): Promise<void> {
  for (const e of j.edited) {
    try {
      fs.writeFileSync(e.path, e.before);
    } catch {
      /* swallow */
    }
  }
  for (const p of j.created) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* swallow */
    }
  }
  // Sort dirs by depth descending so children are removed before parents.
  const dirs = [...j.createdDirs].sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);
  for (const d of dirs) {
    try {
      const remaining = fs.readdirSync(d);
      if (remaining.length === 0) {
        fs.rmdirSync(d);
      }
    } catch {
      /* swallow */
    }
  }
}

/**
 * mkdir -p that records every directory level it actually creates. Existing
 * dirs are not recorded so rollback never touches them. Handles both absolute
 * and relative input paths.
 */
export function ensureDirJournaled(j: Journal, absDir: string): void {
  const isAbs = path.isAbsolute(absDir);
  const parts = absDir.split(path.sep).filter(Boolean);
  let acc = isAbs ? path.sep : "";
  for (const seg of parts) {
    acc = acc === path.sep ? path.sep + seg : path.join(acc, seg);
    if (!dirExists(acc)) {
      fs.mkdirSync(acc);
      recordDir(j, acc);
    }
  }
}

/**
 * Write a file and record it into the journal. New files are recorded as
 * `created`; pre-existing files are recorded as `edited` with their pre-write
 * content snapshot so rollback can restore.
 */
export function writeFileJournaled(j: Journal, abs: string, content: string): void {
  ensureDirJournaled(j, path.dirname(abs));
  if (fileExists(abs)) {
    const before = fs.readFileSync(abs, "utf8");
    recordEdit(j, abs, before);
    fs.writeFileSync(abs, content);
  } else {
    fs.writeFileSync(abs, content);
    recordCreate(j, abs);
  }
}

/* ---------- Template builders ---------- */

export function buildFeatureTypes(feature: string): string {
  return [
    `// Types/interfaces for ${feature} feature.`,
    `// Add request/response shapes, domain models, prop types here.`,
    ``,
    `export {};`,
    ``,
  ].join("\n");
}

export function buildScreenIndex(screen: string): string {
  const P = pascalCase(screen);
  return [
    `import AppText from "@appComponents/appText";`,
    `import AppWrapper from "@appComponents/appWrapper";`,
    `import { Colors } from "@theme/colors";`,
    `import { use${P}ViewModel } from "./viewModel/use${P}ViewModel";`,
    ``,
    `export default function ${P}() {`,
    `  const {} = use${P}ViewModel();`,
    ``,
    `  return (`,
    `    <AppWrapper>`,
    `      <AppText size={20} color={Colors.BLACK}>`,
    `        ${P} screen`,
    `      </AppText>`,
    `    </AppWrapper>`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
}

export function buildScreenViewModel(screen: string): string {
  const P = pascalCase(screen);
  return [
    `// ViewModel for ${P} screen.`,
    `// Owns local state, derived state, side effects, handlers.`,
    `// Calls API functions from ./_api.`,
    ``,
    `export function use${P}ViewModel() {`,
    `  return {};`,
    `}`,
    ``,
  ].join("\n");
}

export function buildScreenApi(screen: string): string {
  return [
    `// API calls for ${screen} screen.`,
    `// Group fetch/mutation functions here; consume from ViewModel.`,
    ``,
    `export {};`,
    ``,
  ].join("\n");
}

export function buildRoleLayout(role: string): string {
  const R = pascalCase(role);
  return [
    `import { Stack } from "expo-router";`,
    ``,
    `export default function ${R}Layout() {`,
    `  return <Stack screenOptions={{ headerShown: false }} />;`,
    `}`,
    ``,
  ].join("\n");
}

export function buildRoleRedirect(role: string, initialScreen: string): string {
  const R = pascalCase(role);
  return [
    `import { Redirect } from "expo-router";`,
    ``,
    `export default function ${R}Index() {`,
    `  return <Redirect href="/(${role})/${initialScreen}" />;`,
    `}`,
    ``,
  ].join("\n");
}

export function buildScreenReExport(
  role: string,
  feature: string,
  screen: string,
): string {
  return `export { default } from "@features/${role}/${feature}/${screen}";\n`;
}

/**
 * Flat (standalone-feature) re-export — 2 segments. Counterpart to
 * `buildScreenReExport` for the hierarchical role/feature/screen tree.
 */
export function buildFlatScreenReExport(
  feature: string,
  screen: string,
): string {
  return `export { default } from "@features/${feature}/${screen}";\n`;
}

/* ---------- High-level writers ---------- */

export function writeFeatureTypes(
  target: string,
  role: string,
  feature: string,
  j: Journal,
): string {
  const dest = path.join(featureDir(target, role, feature), "types.ts");
  writeFileJournaled(j, dest, buildFeatureTypes(feature));
  return dest;
}

/**
 * Writes `features/<feature>/types.ts` for a standalone feature. Shape is
 * identical to the hierarchical `types.ts` (single `export {};` placeholder),
 * just located one level higher — at the feature root rather than under a
 * role's feature subdir.
 */
export function writeStandaloneFeatureTypes(
  target: string,
  feature: string,
  j: Journal,
): string {
  const dest = path.join(featuresRoot(target), feature, "types.ts");
  writeFileJournaled(j, dest, buildFeatureTypes(feature));
  return dest;
}

/**
 * Flat-screen writer — `features/<feature>/<screen>/index.tsx` +
 * `viewModel/_api.ts` + `viewModel/use<Pascal>ViewModel.tsx`. Same content as
 * the hierarchical writer; just shorter on-disk path (no role segment).
 */
export function writeFlatScreenFiles(
  target: string,
  feature: string,
  screen: string,
  j: Journal,
): string[] {
  const dir = flatScreenDir(target, feature, screen);
  const vmDir = flatViewModelDir(target, feature, screen);

  const indexAbs = path.join(dir, "index.tsx");
  const apiAbs = path.join(vmDir, "_api.ts");
  const vmAbs = path.join(vmDir, `use${pascalCase(screen)}ViewModel.tsx`);

  writeFileJournaled(j, indexAbs, buildScreenIndex(screen));
  writeFileJournaled(j, apiAbs, buildScreenApi(screen));
  writeFileJournaled(j, vmAbs, buildScreenViewModel(screen));

  return [indexAbs, apiAbs, vmAbs];
}

/**
 * Writes the flat 2-segment re-export at `src/app/(<feature>)/<screen>.tsx`.
 * Same target path as `writeRouteReExport`, just with the 2-segment import
 * form used by standalone features.
 */
export function writeFlatRouteReExport(
  target: string,
  feature: string,
  screen: string,
  j: Journal,
): string {
  const dest = routeFile(target, feature, screen);
  writeFileJournaled(j, dest, buildFlatScreenReExport(feature, screen));
  return dest;
}

export function writeScreenFiles(
  target: string,
  role: string,
  feature: string,
  screen: string,
  j: Journal,
): string[] {
  const dir = screenDir(target, role, feature, screen);
  const vmDir = viewModelDir(target, role, feature, screen);

  const indexAbs = path.join(dir, "index.tsx");
  const apiAbs = path.join(vmDir, "_api.ts");
  const vmAbs = path.join(vmDir, `use${pascalCase(screen)}ViewModel.tsx`);

  writeFileJournaled(j, indexAbs, buildScreenIndex(screen));
  writeFileJournaled(j, apiAbs, buildScreenApi(screen));
  writeFileJournaled(j, vmAbs, buildScreenViewModel(screen));

  return [indexAbs, apiAbs, vmAbs];
}

export function writeRouteReExport(
  target: string,
  role: string,
  feature: string,
  screen: string,
  j: Journal,
): string {
  const dest = routeFile(target, role, screen);
  writeFileJournaled(j, dest, buildScreenReExport(role, feature, screen));
  return dest;
}

export function writeRoleGroup(
  target: string,
  role: string,
  initialScreen: string,
  j: Journal,
): string[] {
  const layout = layoutFile(target, role);
  const redirect = redirectFile(target, role);
  writeFileJournaled(j, layout, buildRoleLayout(role));
  writeFileJournaled(j, redirect, buildRoleRedirect(role, initialScreen));
  return [layout, redirect];
}

/**
 * Rewrite the `<Redirect href="/(role)/..." />` href in (role)/index.tsx.
 * Records a pre-edit snapshot in the journal so rollback can restore.
 */
export function updateRedirectTarget(
  target: string,
  role: string,
  newScreen: string,
  j: Journal,
): string {
  const file = redirectFile(target, role);
  if (!fileExists(file)) {
    throw new Error(`Redirect file not found: ${file}`);
  }
  const before = fs.readFileSync(file, "utf8");
  // Match `<Redirect href="/(<role>)/<anything>" />` allowing flexible whitespace.
  const rolePattern = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<Redirect\\s+href="/\\(${rolePattern}\\)/[^"]+"\\s*/>`,
    "m",
  );
  if (!re.test(before)) {
    throw new Error(
      `Redirect href pattern not found in ${file}. Expected <Redirect href="/(${role})/..." />.`,
    );
  }
  const after = before.replace(re, `<Redirect href="/(${role})/${newScreen}" />`);
  recordEdit(j, file, before);
  fs.writeFileSync(file, after);
  return file;
}

const STACK_OPEN_RE = /<Stack\s+screenOptions=\{\{\s*headerShown:\s*false\s*\}\}\s*>/;
const STACK_CLOSE_TAG = "</Stack>";

export function assertRoutesParseable(target: string): void {
  const f = routesTsxPath(target);
  if (!fileExists(f)) {
    throw new Error(`routes.tsx not found at ${f}.`);
  }
  const src = fs.readFileSync(f, "utf8");
  if (!STACK_OPEN_RE.test(src) || !src.includes(STACK_CLOSE_TAG)) {
    throw new Error(
      `routes.tsx is not in the expected shape (missing <Stack screenOptions={{ headerShown: false }}> ... </Stack> block). Please update manually.`,
    );
  }
}

/**
 * Splice `<Stack.Screen name="(<role>)" />` into the Stack children, just
 * before `</Stack>`. Idempotent: returns null if the line is already present.
 * Records a pre-edit snapshot in the journal on actual writes.
 */
export function registerRoleInRoutes(
  target: string,
  role: string,
  j: Journal,
): string | null {
  assertRoutesParseable(target);
  const f = routesTsxPath(target);
  const before = fs.readFileSync(f, "utf8");
  // Idempotency check per spec § routes.tsx patch strategy: detect any existing
  // `<Stack.Screen name="(<role>)"` substring (allows user-edited variants with
  // extra attributes or different closing forms).
  const idempotencyProbe = `<Stack.Screen name="(${role})"`;
  if (before.includes(idempotencyProbe)) {
    return null; // idempotent
  }
  const marker = `<Stack.Screen name="(${role})" />`;
  const idx = before.lastIndexOf(STACK_CLOSE_TAG);
  if (idx < 0) {
    throw new Error(`routes.tsx missing </Stack> closing tag.`);
  }
  // Derive </Stack>'s own indentation as a baseline.
  const head = before.slice(0, idx);
  const tail = before.slice(idx);
  const lastNl = head.lastIndexOf("\n");
  const closingTagWs = head.slice(lastNl + 1); // typically "    " or "  "
  const trimmedHead = head.slice(0, lastNl + 1);

  // Prefer the indent of an existing <Stack.Screen ...> child if any — so the
  // new line aligns with its siblings instead of with </Stack>.
  const childMatch = before.match(/^([ \t]*)<Stack\.Screen\s/m);
  const childIndent = childMatch ? childMatch[1]! : closingTagWs + "  ";

  const insertion = `${childIndent}${marker}\n${closingTagWs}`;
  const after = `${trimmedHead}${insertion}${tail}`;
  recordEdit(j, f, before);
  fs.writeFileSync(f, after);
  return f;
}

export function assertExpoApp(target: string): void {
  if (!fileExists(path.join(target, "app.json"))) {
    throw new Error(
      `Not an Expo project: app.json missing in ${target}. Run from the project root.`,
    );
  }
}

export function printRebuildReminder(): void {
  log.info("Recipe applied. Rebuild the app to pick up changes:");
  log.raw("  yarn ios       # or `yarn android`");
  log.raw("");
}

/* ---------- bottom-tab helpers ---------- */

/**
 * Path helpers for the `(tabs)/` route group inside a role. The tabs group
 * always nests one level deeper than the role group it belongs to.
 */
export function tabsGroupDir(target: string, role: string): string {
  return path.join(routeGroupDir(target, role), "(tabs)");
}
export function tabsLayoutFile(target: string, role: string): string {
  return path.join(tabsGroupDir(target, role), "_layout.tsx");
}
export function tabsIndexFile(target: string, role: string): string {
  return path.join(tabsGroupDir(target, role), "index.tsx");
}
export function tabRouteFile(
  target: string,
  role: string,
  tab: string,
): string {
  return path.join(tabsGroupDir(target, role), `${tab}.tsx`);
}
export function tabsGroupExists(target: string, role: string): boolean {
  return dirExists(tabsGroupDir(target, role));
}

/**
 * Render `(tabs)/_layout.tsx` for the given role with N `Tabs.Screen`
 * entries. Each entry gets a placeholder Ionicons `ellipse-outline` icon —
 * users swap per-tab afterwards. PascalCase tab name is reused as both
 * function name (when referenced) and title text.
 */
export function buildTabsLayout(role: string, tabs: string[]): string {
  const R = pascalCase(role);
  // Hide `(tabs)/index.tsx` from the tab bar. Expo Router's <Tabs> is an
  // auto-discovery container — every file in the directory becomes a visible
  // tab UNLESS explicitly hidden via `options={{ href: null }}`. The
  // `(tabs)/index.tsx` file exists only as a redirect to the first real tab
  // (per spec § Question 3 A.2); without this hidden entry, the tab bar
  // would show a phantom 4th (icon-less, title-less) "index" tab.
  const hiddenIndex = [
    `      <Tabs.Screen`,
    `        name="index"`,
    `        options={{ href: null }}`,
    `      />`,
  ].join("\n");
  const screens = tabs
    .map((t) => {
      const Title = pascalCase(t);
      return [
        `      <Tabs.Screen`,
        `        name="${t}"`,
        `        options={{`,
        `          title: "${Title}",`,
        `          tabBarIcon: ({ color, size }) => (`,
        `            <Ionicons name="ellipse-outline" color={color} size={size} />`,
        `          ),`,
        `        }}`,
        `      />`,
      ].join("\n");
    })
    .join("\n");
  return [
    `import { Tabs } from "expo-router";`,
    `import { Ionicons } from "@expo/vector-icons";`,
    ``,
    `export default function ${R}TabsLayout() {`,
    `  return (`,
    `    <Tabs screenOptions={{ headerShown: false }}>`,
    hiddenIndex,
    screens,
    `    </Tabs>`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
}

/**
 * Render `(tabs)/index.tsx` — a redirect to the first tab. Picked instead of
 * the "index = first tab" idiom so file ordering doesn't dictate first-tab
 * identity (per spec § Question 3 — user controls order via
 * `<Tabs.Screen>` declarations in `_layout.tsx`).
 */
export function buildTabsIndexRedirect(role: string, firstTab: string): string {
  const R = pascalCase(role);
  return [
    `import { Redirect } from "expo-router";`,
    ``,
    `export default function ${R}TabsIndex() {`,
    `  return <Redirect href="/(${role})/(tabs)/${firstTab}" />;`,
    `}`,
    ``,
  ].join("\n");
}

/**
 * Inline placeholder body for a single tab. Self-contained — no features-tree
 * backing, no viewModel/_api. Users wire MVVM by hand if they grow a tab
 * beyond the placeholder.
 */
export function buildTabPlaceholder(tab: string): string {
  const P = pascalCase(tab);
  return [
    `import AppText from "@appComponents/appText";`,
    `import AppWrapper from "@appComponents/appWrapper";`,
    `import { Colors } from "@theme/colors";`,
    ``,
    `export default function ${P}() {`,
    `  return (`,
    `    <AppWrapper>`,
    `      <AppText size={20} color={Colors.BLACK}>`,
    `        ${P} screen`,
    `      </AppText>`,
    `    </AppWrapper>`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
}

/**
 * Writes `_layout.tsx`, `index.tsx`, and one `<tab>.tsx` per tab. Returns the
 * full list of written absolute paths in spec order.
 */
export function writeTabsGroup(
  target: string,
  role: string,
  tabs: string[],
  j: Journal,
): string[] {
  if (tabs.length === 0) {
    throw new Error("writeTabsGroup: tabs list is empty.");
  }
  const layout = tabsLayoutFile(target, role);
  const indexF = tabsIndexFile(target, role);
  writeFileJournaled(j, layout, buildTabsLayout(role, tabs));
  writeFileJournaled(j, indexF, buildTabsIndexRedirect(role, tabs[0]!));
  const out: string[] = [layout, indexF];
  for (const t of tabs) {
    const f = tabRouteFile(target, role, t);
    writeFileJournaled(j, f, buildTabPlaceholder(t));
    out.push(f);
  }
  return out;
}

/**
 * Pre-flight: `(<role>)/_layout.tsx` must contain a Stack open tag in either
 * the self-closing or wrapping form `add role` produces. Refusal here means
 * the user hand-edited the role layout into a shape we can't safely splice.
 */
const ROLE_STACK_RE_ANY = /<Stack\s+screenOptions=\{\{\s*headerShown:\s*false\s*\}\}\s*(?:\/?>)/;
const ROLE_STACK_SELF_CLOSING_RE = /<Stack\s+screenOptions=\{\{\s*headerShown:\s*false\s*\}\}\s*\/>/;
const ROLE_STACK_OPEN_RE = /<Stack\s+screenOptions=\{\{\s*headerShown:\s*false\s*\}\}\s*>/;

export function assertRoleLayoutParseable(target: string, role: string): void {
  const f = layoutFile(target, role);
  if (!fileExists(f)) {
    throw new Error(`Role layout not found: ${f}.`);
  }
  const src = fs.readFileSync(f, "utf8");
  if (!ROLE_STACK_RE_ANY.test(src)) {
    throw new Error(
      `Role layout ${f} is not in the expected shape (missing <Stack screenOptions={{ headerShown: false }}> tag). Please update manually.`,
    );
  }
}

/**
 * Splice `<Stack.Screen name="(tabs)" />` into the role's `_layout.tsx` Stack.
 *
 * Handles both starting shapes:
 *   Self-closing: `<Stack ... />`  → rewrite to wrapping form with single child
 *   Wrapping:     `<Stack ...>...</Stack>` → append before `</Stack>`
 *
 * Idempotent via substring probe `<Stack.Screen name="(tabs)"` — returns null
 * when the line is already present, edits nothing.
 */
export function registerTabsInRoleLayout(
  target: string,
  role: string,
  j: Journal,
): string | null {
  assertRoleLayoutParseable(target, role);
  const f = layoutFile(target, role);
  const before = fs.readFileSync(f, "utf8");

  if (before.includes(`<Stack.Screen name="(tabs)"`)) {
    return null;
  }

  let after: string;
  if (ROLE_STACK_SELF_CLOSING_RE.test(before)) {
    // Convert self-closing `<Stack ... />` to wrapping form.
    //
    // `buildRoleLayout` produces the tag inline with `return ` on the same
    // line (`return <Stack ... />;`). Deriving indent from "whitespace before
    // the tag" produces garbage in that case (it picks up `return ` as
    // "whitespace"). So we special-case the `return <Stack ... />;` shape
    // with a known multi-line replacement using 2-space body indent (the
    // convention `buildRoleLayout` emits), and fall back to the generic
    // line-indent strategy only when the tag sits on its own line.
    const m = before.match(ROLE_STACK_SELF_CLOSING_RE)!;
    const matched = m[0]!;
    const RETURN_INLINE = /^([ \t]*)return\s+(<Stack\s+screenOptions=\{\{\s*headerShown:\s*false\s*\}\}\s*\/>);?\s*$/m;
    const returnMatch = before.match(RETURN_INLINE);
    if (returnMatch) {
      const baseIndent = returnMatch[1]!; // e.g. "  "
      const innerIndent = baseIndent + "  ";
      const childIndent = innerIndent + "  ";
      const replacement =
        `${baseIndent}return (\n` +
        `${innerIndent}<Stack screenOptions={{ headerShown: false }}>\n` +
        `${childIndent}<Stack.Screen name="(tabs)" />\n` +
        `${innerIndent}</Stack>\n` +
        `${baseIndent});`;
      after = before.replace(RETURN_INLINE, replacement);
    } else {
      // Tag is on its own line. Derive indent from its leading whitespace.
      const idx = before.indexOf(matched);
      const lineStart = before.lastIndexOf("\n", idx - 1) + 1;
      const indent = before.slice(lineStart, idx);
      const childIndent = indent + "  ";
      const openTag = matched.replace(/\s*\/>$/, ">");
      const replacement =
        `${openTag}\n` +
        `${childIndent}<Stack.Screen name="(tabs)" />\n` +
        `${indent}</Stack>`;
      after = before.replace(matched, replacement);
    }
  } else if (ROLE_STACK_OPEN_RE.test(before) && before.includes("</Stack>")) {
    // Wrapping form — append <Stack.Screen> before </Stack>, mirroring
    // `registerRoleInRoutes` logic.
    const closeIdx = before.lastIndexOf("</Stack>");
    const head = before.slice(0, closeIdx);
    const tail = before.slice(closeIdx);
    const lastNl = head.lastIndexOf("\n");
    const closingTagWs = head.slice(lastNl + 1);
    const trimmedHead = head.slice(0, lastNl + 1);
    const childMatch = before.match(/^([ \t]*)<Stack\.Screen\s/m);
    const childIndent = childMatch ? childMatch[1]! : closingTagWs + "  ";
    const insertion = `${childIndent}<Stack.Screen name="(tabs)" />\n${closingTagWs}`;
    after = `${trimmedHead}${insertion}${tail}`;
  } else {
    throw new Error(
      `Role layout ${f} has unsupported Stack shape — please update manually.`,
    );
  }

  recordEdit(j, f, before);
  fs.writeFileSync(f, after);
  return f;
}
