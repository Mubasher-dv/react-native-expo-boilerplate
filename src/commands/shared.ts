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
