# Role / Feature / Screen Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three post-scaffold CLI commands (`add role`, `add feature`, `add screen`) that scaffold Expo Router groups and MVVM feature folders in an already-scaffolded `react-native-expo-boilerplate` project, with atomic write/rollback semantics.

**Architecture:** New module `src/commands/` containing `role.ts`, `feature.ts`, `screen.ts`, and `shared.ts`. The shared module owns name normalization, validation, existence checks, file/dir writers, an in-memory journal type for atomic rollback, and the `routes.tsx` / redirect mutators. `src/index.ts` gets an early dispatcher branch that routes `add role|feature|screen` to the new module before falling through to the existing `runAdd` recipe dispatcher in `src/add.ts` (untouched).

**Tech Stack:** TypeScript (ESM, strict), Node ≥ 18, vitest, fs-extra, prompts, kleur, execa. Existing patterns to follow: `src/add.ts` for recipe-style commands and `printFilesChanged`, `src/util.ts` for `ensureDir` / `fileExists` / `log`.

---

## Spec Reference

Authoritative source: `docs/superpowers/specs/2026-05-12-role-feature-screen-commands-design.md`. Re-read it before starting Task 1.

## File Structure

**New source files**

| Path | Purpose |
| --- | --- |
| `src/commands/shared.ts` | Normalization, validation, existence checks, journal/rollback, writers, mutators |
| `src/commands/role.ts` | `addRole(roleArg?: string)` orchestration |
| `src/commands/feature.ts` | `addFeature(roleArg?: string, nameArg?: string)` orchestration |
| `src/commands/screen.ts` | `addScreen(roleArg?: string, featureArg?: string, nameArg?: string)` orchestration |

**New test files**

| Path | Purpose |
| --- | --- |
| `tests/commands/shared.test.ts` | Pure-function helpers (normalize/pascal/assert/exists/journal/mutators) |
| `tests/commands/role.test.ts` | `addRole` end-to-end against tmp dir, rollback case |
| `tests/commands/feature.test.ts` | `addFeature` end-to-end, collision refusal, initial-screen redirect rewrite, rollback case |
| `tests/commands/screen.test.ts` | `addScreen` end-to-end, collision across features, rollback case |

**New doc files (templates)**

| Path | Purpose |
| --- | --- |
| `templates/claude-command/add-role.md` | Slash-command parity doc |
| `templates/claude-command/add-feature.md` | Slash-command parity doc |
| `templates/claude-command/add-screen.md` | Slash-command parity doc |

**Files modified**

| Path | Why |
| --- | --- |
| `src/index.ts` | Early dispatcher branch for `add role/feature/screen` |
| `src/add.ts` | Export `printFilesChanged` for reuse |
| `README.md` | New "Generate role / feature / screen" section |
| `templates/base/README.md` | Same trio in "Post-scaffold recipes" |
| `package.json` | Version bump 0.2.3 → 0.3.0 |

**Important conventions**

- ESM imports use `.js` extensions even for `.ts` source (matches existing `src/add.ts`, `src/util.ts`).
- `prompts` answers: when user cancels (Ctrl-C), use `{ onCancel: () => process.exit(1) }` (matches existing `addSplash`).
- All filesystem ops use synchronous `fs` (existing pattern); rollback also synchronous-friendly.
- Commits stay local (no `git push`). The user has explicitly disallowed pushing.

---

## Task 1: Bootstrap commands directory + export printFilesChanged

**Files:**
- Modify: `src/add.ts` (export existing `printFilesChanged`)
- Create: `src/commands/shared.ts` (empty skeleton)
- Create: `tests/commands/shared.test.ts` (skeleton with sanity test)

- [ ] **Step 1: Write the failing test**

Create `tests/commands/shared.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as shared from "../../src/commands/shared.js";

describe("commands/shared", () => {
  it("module loads", () => {
    expect(typeof shared).toBe("object");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: FAIL — `Cannot find module '../../src/commands/shared.js'`

- [ ] **Step 3: Create the shared.ts skeleton**

Create `src/commands/shared.ts`:

```ts
// Shared helpers for `add role|feature|screen` commands.
// See docs/superpowers/specs/2026-05-12-role-feature-screen-commands-design.md.
export {};
```

- [ ] **Step 4: Export printFilesChanged from src/add.ts**

Find the existing private `printFilesChanged` near line 111 of `src/add.ts`:

```ts
function printFilesChanged(written: string[], removed: string[] = []): void {
```

Replace with:

```ts
export function printFilesChanged(written: string[], removed: string[] = []): void {
```

(Only the `export` keyword is added. The body is unchanged.)

- [ ] **Step 5: Run tests to verify load passes + nothing else broke**

Run: `npx vitest run tests/commands/shared.test.ts tests/add.test.ts`
Expected: all PASS (existing 179 add tests + the new sanity test).

- [ ] **Step 6: Commit**

```bash
git add src/commands/shared.ts tests/commands/shared.test.ts src/add.ts
git commit -m "feat(commands): scaffold src/commands/ + export printFilesChanged"
```

---

## Task 2: Implement normalizeCamelCase + pascalCase

**Files:**
- Modify: `src/commands/shared.ts`
- Modify: `tests/commands/shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/commands/shared.test.ts`:

```ts
import { normalizeCamelCase, pascalCase } from "../../src/commands/shared.js";

describe("normalizeCamelCase", () => {
  it("passes through camelCase", () => {
    expect(normalizeCamelCase("teamDetails")).toBe("teamDetails");
  });
  it("splits whitespace", () => {
    expect(normalizeCamelCase("team details")).toBe("teamDetails");
    expect(normalizeCamelCase("  team   details  ")).toBe("teamDetails");
  });
  it("splits hyphen", () => {
    expect(normalizeCamelCase("team-details")).toBe("teamDetails");
  });
  it("splits underscore", () => {
    expect(normalizeCamelCase("team_details")).toBe("teamDetails");
  });
  it("lowercases first char of PascalCase", () => {
    expect(normalizeCamelCase("TeamDetails")).toBe("teamDetails");
  });
  it("keeps digits when not leading", () => {
    expect(normalizeCamelCase("team123")).toBe("team123");
  });
  it("rejects leading digit", () => {
    expect(() => normalizeCamelCase("123team")).toThrow(/cannot start with a digit/i);
  });
  it("rejects empty/whitespace", () => {
    expect(() => normalizeCamelCase("")).toThrow(/empty/i);
    expect(() => normalizeCamelCase("   ")).toThrow(/empty/i);
  });
  it("rejects disallowed chars", () => {
    expect(() => normalizeCamelCase("team@details")).toThrow(/invalid character/i);
    expect(() => normalizeCamelCase("team.details")).toThrow(/invalid character/i);
  });
});

describe("pascalCase", () => {
  it("uppercases first char of a camelCase string", () => {
    expect(pascalCase("teamDetails")).toBe("TeamDetails");
    expect(pascalCase("a")).toBe("A");
    expect(pascalCase("auth")).toBe("Auth");
  });
  it("rejects empty", () => {
    expect(() => pascalCase("")).toThrow(/empty/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: FAIL — `normalizeCamelCase is not a function` / `pascalCase is not a function`.

- [ ] **Step 3: Implement both functions in src/commands/shared.ts**

Replace contents of `src/commands/shared.ts`:

```ts
// Shared helpers for `add role|feature|screen` commands.
// See docs/superpowers/specs/2026-05-12-role-feature-screen-commands-design.md.

/**
 * Allowed pre-normalize character set: alphanumerics plus the three accepted
 * separators (whitespace / `-` / `_`). Anything else is rejected so silent
 * normalization can't hide a typo.
 */
const ALLOWED_PRE_NORMALIZE = /^[a-zA-Z0-9\-_\s]+$/;

/**
 * Split on any run of whitespace, `-`, or `_`. Camel-join the resulting words:
 * first word lowercased entirely, subsequent words have their first char
 * uppercased and the rest preserved.
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/shared.ts tests/commands/shared.test.ts
git commit -m "feat(commands/shared): normalizeCamelCase + pascalCase"
```

---

## Task 3: Implement assertRoleName / assertFeatureName / assertScreenName

**Files:**
- Modify: `src/commands/shared.ts`
- Modify: `tests/commands/shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/commands/shared.test.ts`:

```ts
import {
  assertRoleName,
  assertFeatureName,
  assertScreenName,
  RESERVED_NAMES,
} from "../../src/commands/shared.js";

describe("assertRoleName / assertFeatureName / assertScreenName", () => {
  it("returns normalized form for valid name", () => {
    expect(assertRoleName("auth")).toBe("auth");
    expect(assertRoleName("user-profile")).toBe("userProfile");
    expect(assertFeatureName("dashboard")).toBe("dashboard");
    expect(assertScreenName("team details")).toBe("teamDetails");
  });

  it("rejects reserved names (case-insensitive vs normalized form)", () => {
    expect(() => assertRoleName("add")).toThrow(/reserved/i);
    expect(() => assertRoleName("ROLE")).toThrow(/reserved/i);
    expect(() => assertFeatureName("feature")).toThrow(/reserved/i);
    expect(() => assertScreenName("index")).toThrow(/reserved/i);
    expect(() => assertScreenName("_layout")).toThrow(/reserved/i);
    expect(() => assertRoleName("bottom-sheet")).toThrow(/reserved/i);
  });

  it("rejects names that exceed 40 chars after normalize", () => {
    const long = "a".repeat(41);
    expect(() => assertRoleName(long)).toThrow(/length/i);
  });

  it("rejects names that fail the post-normalize pattern", () => {
    // pre-normalize check catches @, but post-normalize ensures the produced
    // camelCase still matches /^[a-z][a-zA-Z0-9]*$/. Hard to violate post-normalize
    // because normalize already filters — sanity check: empty produces an error.
    expect(() => assertRoleName("   ")).toThrow();
  });

  it("RESERVED_NAMES contains the documented set", () => {
    for (const r of [
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
    ]) {
      expect(RESERVED_NAMES).toContain(r);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: FAIL — assertions and `RESERVED_NAMES` are not exported.

- [ ] **Step 3: Implement in src/commands/shared.ts**

Append to `src/commands/shared.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/shared.ts tests/commands/shared.test.ts
git commit -m "feat(commands/shared): assertRoleName/assertFeatureName/assertScreenName + reserved list"
```

---

## Task 4: Existence checks + path helpers

**Files:**
- Modify: `src/commands/shared.ts`
- Modify: `tests/commands/shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/commands/shared.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  roleExists,
  featureExists,
  screenExists,
  routeFileExists,
  featureDir,
  screenDir,
  routeGroupDir,
  routeFile,
  redirectFile,
  layoutFile,
} from "../../src/commands/shared.js";

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cmd-shared-"));
}

describe("path helpers", () => {
  it("featureDir / screenDir / routeGroupDir / routeFile compute expected paths", () => {
    const t = "/tmp/proj";
    expect(featureDir(t, "auth", "dashboard")).toBe(
      path.join(t, "src/features/auth/dashboard"),
    );
    expect(screenDir(t, "auth", "dashboard", "teamDetails")).toBe(
      path.join(t, "src/features/auth/dashboard/teamDetails"),
    );
    expect(routeGroupDir(t, "auth")).toBe(path.join(t, "src/app/(auth)"));
    expect(routeFile(t, "auth", "onBoarding")).toBe(
      path.join(t, "src/app/(auth)/onBoarding.tsx"),
    );
    expect(redirectFile(t, "auth")).toBe(path.join(t, "src/app/(auth)/index.tsx"));
    expect(layoutFile(t, "auth")).toBe(path.join(t, "src/app/(auth)/_layout.tsx"));
  });
});

describe("existence checks", () => {
  it("roleExists is true when src/features/<role>/ exists", () => {
    const t = mkTmp();
    expect(roleExists(t, "auth")).toBe(false);
    fs.mkdirSync(path.join(t, "src/features/auth"), { recursive: true });
    expect(roleExists(t, "auth")).toBe(true);
  });

  it("roleExists is true when src/app/(<role>)/ exists even if features dir absent", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    expect(roleExists(t, "auth")).toBe(true);
  });

  it("featureExists requires src/features/<role>/<feature>/", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/features/auth"), { recursive: true });
    expect(featureExists(t, "auth", "dashboard")).toBe(false);
    fs.mkdirSync(path.join(t, "src/features/auth/dashboard"), { recursive: true });
    expect(featureExists(t, "auth", "dashboard")).toBe(true);
  });

  it("screenExists requires the screen folder", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/features/auth/dashboard"), { recursive: true });
    expect(screenExists(t, "auth", "dashboard", "teamDetails")).toBe(false);
    fs.mkdirSync(path.join(t, "src/features/auth/dashboard/teamDetails"), {
      recursive: true,
    });
    expect(screenExists(t, "auth", "dashboard", "teamDetails")).toBe(true);
  });

  it("routeFileExists checks the re-export file", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    expect(routeFileExists(t, "auth", "onBoarding")).toBe(false);
    fs.writeFileSync(path.join(t, "src/app/(auth)/onBoarding.tsx"), "");
    expect(routeFileExists(t, "auth", "onBoarding")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Implement helpers**

Append to `src/commands/shared.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { dirExists, fileExists } from "../util.js";

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
```

> Note: the import line for `fs` and `path` may already exist at the top of the file from earlier tasks. If so, merge (do not duplicate).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/shared.ts tests/commands/shared.test.ts
git commit -m "feat(commands/shared): path helpers + existence checks"
```

---

## Task 5: Journal type + rollback helpers

**Files:**
- Modify: `src/commands/shared.ts`
- Modify: `tests/commands/shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/commands/shared.test.ts`:

```ts
import {
  newJournal,
  recordCreate,
  recordDir,
  recordEdit,
  rollback,
} from "../../src/commands/shared.js";

describe("Journal + rollback", () => {
  it("rolls back created files", async () => {
    const t = mkTmp();
    const j = newJournal();
    const f = path.join(t, "a.txt");
    fs.writeFileSync(f, "hi");
    recordCreate(j, f);
    expect(fs.existsSync(f)).toBe(true);
    await rollback(j);
    expect(fs.existsSync(f)).toBe(false);
  });

  it("restores edited files to their pre-edit snapshot", async () => {
    const t = mkTmp();
    const f = path.join(t, "a.txt");
    fs.writeFileSync(f, "before");
    const j = newJournal();
    recordEdit(j, f, "before");
    fs.writeFileSync(f, "after");
    expect(fs.readFileSync(f, "utf8")).toBe("after");
    await rollback(j);
    expect(fs.readFileSync(f, "utf8")).toBe("before");
  });

  it("removes empty created dirs (deepest-first) but leaves non-empty alone", async () => {
    const t = mkTmp();
    const d1 = path.join(t, "outer");
    const d2 = path.join(d1, "inner");
    fs.mkdirSync(d2, { recursive: true });
    // outer was effectively created when inner was, but we record both:
    const j = newJournal();
    recordDir(j, d1);
    recordDir(j, d2);
    await rollback(j);
    expect(fs.existsSync(d2)).toBe(false);
    expect(fs.existsSync(d1)).toBe(false);

    // Case: dir is non-empty after rollback (foreign file) → leave it.
    const d3 = path.join(t, "keep");
    fs.mkdirSync(d3);
    fs.writeFileSync(path.join(d3, "foreign.txt"), "user");
    const j2 = newJournal();
    recordDir(j2, d3);
    await rollback(j2);
    expect(fs.existsSync(d3)).toBe(true);
  });

  it("rollback is safe to call on an empty journal", async () => {
    const j = newJournal();
    await expect(rollback(j)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: FAIL — journal helpers not exported.

- [ ] **Step 3: Implement journal + rollback**

Append to `src/commands/shared.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/shared.ts tests/commands/shared.test.ts
git commit -m "feat(commands/shared): Journal type + rollback"
```

---

## Task 6: Dir + file writer helpers that record into journal

**Files:**
- Modify: `src/commands/shared.ts`
- Modify: `tests/commands/shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/commands/shared.test.ts`:

```ts
import { ensureDirJournaled, writeFileJournaled } from "../../src/commands/shared.js";

describe("ensureDirJournaled / writeFileJournaled", () => {
  it("ensureDirJournaled records every newly-created dir in the path", () => {
    const t = mkTmp();
    const j = newJournal();
    const deep = path.join(t, "a", "b", "c");
    ensureDirJournaled(j, deep);
    expect(fs.existsSync(deep)).toBe(true);
    expect(j.createdDirs).toEqual(
      expect.arrayContaining([path.join(t, "a"), path.join(t, "a", "b"), deep]),
    );
  });

  it("ensureDirJournaled does NOT record pre-existing dirs", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "a"));
    const j = newJournal();
    ensureDirJournaled(j, path.join(t, "a", "b"));
    expect(j.createdDirs).toEqual([path.join(t, "a", "b")]);
  });

  it("writeFileJournaled records create for new files", () => {
    const t = mkTmp();
    const j = newJournal();
    const f = path.join(t, "new.txt");
    writeFileJournaled(j, f, "hi");
    expect(j.created).toEqual([f]);
    expect(j.edited).toEqual([]);
    expect(fs.readFileSync(f, "utf8")).toBe("hi");
  });

  it("writeFileJournaled records edit for existing files", () => {
    const t = mkTmp();
    const f = path.join(t, "old.txt");
    fs.writeFileSync(f, "before");
    const j = newJournal();
    writeFileJournaled(j, f, "after");
    expect(j.created).toEqual([]);
    expect(j.edited).toEqual([{ path: f, before: "before" }]);
    expect(fs.readFileSync(f, "utf8")).toBe("after");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement journaled writers**

Append to `src/commands/shared.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/shared.ts tests/commands/shared.test.ts
git commit -m "feat(commands/shared): ensureDirJournaled + writeFileJournaled"
```

---

## Task 7: Template builders for feature types + screen MVVM files

**Files:**
- Modify: `src/commands/shared.ts`
- Modify: `tests/commands/shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/commands/shared.test.ts`:

```ts
import {
  buildFeatureTypes,
  buildScreenIndex,
  buildScreenViewModel,
  buildScreenApi,
  buildRoleLayout,
  buildRoleRedirect,
  buildScreenReExport,
} from "../../src/commands/shared.js";

describe("template builders", () => {
  it("buildFeatureTypes mentions the feature name in the comment", () => {
    const out = buildFeatureTypes("dashboard");
    expect(out).toMatch(/dashboard/);
    expect(out).toContain("export {};");
  });

  it("buildScreenIndex wires the ViewModel by PascalCase name", () => {
    const out = buildScreenIndex("teamDetails");
    expect(out).toContain('import { useTeamDetailsViewModel } from "./viewModel/useTeamDetailsViewModel"');
    expect(out).toContain("export default function TeamDetails()");
    expect(out).toContain("const {} = useTeamDetailsViewModel();");
    expect(out).toContain("TeamDetails screen");
  });

  it("buildScreenViewModel exports the hook with PascalCase", () => {
    const out = buildScreenViewModel("home");
    expect(out).toContain("export function useHomeViewModel()");
  });

  it("buildScreenApi exports an empty module", () => {
    const out = buildScreenApi("home");
    expect(out).toContain("home");
    expect(out).toContain("export {};");
  });

  it("buildRoleLayout names the layout fn after the role (PascalCase)", () => {
    const out = buildRoleLayout("auth");
    expect(out).toContain("export default function AuthLayout()");
    expect(out).toContain('<Stack screenOptions={{ headerShown: false }} />');
  });

  it("buildRoleRedirect points to /(role)/screen", () => {
    const out = buildRoleRedirect("auth", "onBoarding");
    expect(out).toContain('<Redirect href="/(auth)/onBoarding" />');
    expect(out).toContain("export default function AuthIndex()");
  });

  it("buildScreenReExport re-exports default from @features/<role>/<feature>/<screen>", () => {
    const out = buildScreenReExport("auth", "dashboard", "home");
    expect(out.trim()).toBe(
      'export { default } from "@features/auth/dashboard/home";',
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement template builders**

Append to `src/commands/shared.ts`:

```ts
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
  const P = pascalCase(screen);
  return [
    `// API calls for ${P} screen.`,
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/shared.ts tests/commands/shared.test.ts
git commit -m "feat(commands/shared): template builders (types, MVVM, layout, redirect, re-export)"
```

---

## Task 8: writeFeatureTypes + writeScreenFiles (high-level writers)

**Files:**
- Modify: `src/commands/shared.ts`
- Modify: `tests/commands/shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/commands/shared.test.ts`:

```ts
import { writeFeatureTypes, writeScreenFiles } from "../../src/commands/shared.js";

describe("writeFeatureTypes", () => {
  it("creates features/<role>/<feature>/types.ts and records it", () => {
    const t = mkTmp();
    const j = newJournal();
    const out = writeFeatureTypes(t, "auth", "dashboard", j);
    expect(out).toBe(path.join(t, "src/features/auth/dashboard/types.ts"));
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.readFileSync(out, "utf8")).toContain("dashboard");
    expect(j.created).toContain(out);
  });
});

describe("writeScreenFiles", () => {
  it("creates index.tsx + viewModel/_api.ts + viewModel/use<Pascal>ViewModel.tsx", () => {
    const t = mkTmp();
    const j = newJournal();
    const paths = writeScreenFiles(t, "auth", "dashboard", "teamDetails", j);
    expect(paths).toEqual([
      path.join(t, "src/features/auth/dashboard/teamDetails/index.tsx"),
      path.join(t, "src/features/auth/dashboard/teamDetails/viewModel/_api.ts"),
      path.join(
        t,
        "src/features/auth/dashboard/teamDetails/viewModel/useTeamDetailsViewModel.tsx",
      ),
    ]);
    for (const p of paths) {
      expect(fs.existsSync(p)).toBe(true);
      expect(j.created).toContain(p);
    }
    expect(fs.readFileSync(paths[2]!, "utf8")).toContain("useTeamDetailsViewModel");
  });

  it("rollback restores the filesystem to pre-write state", async () => {
    const t = mkTmp();
    const j = newJournal();
    writeScreenFiles(t, "auth", "dashboard", "teamDetails", j);
    expect(fs.existsSync(path.join(t, "src/features/auth"))).toBe(true);
    await rollback(j);
    expect(fs.existsSync(path.join(t, "src/features/auth"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement writers**

Append to `src/commands/shared.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/shared.ts tests/commands/shared.test.ts
git commit -m "feat(commands/shared): writeFeatureTypes + writeScreenFiles"
```

---

## Task 9: writeRouteReExport + writeRoleGroup

**Files:**
- Modify: `src/commands/shared.ts`
- Modify: `tests/commands/shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/commands/shared.test.ts`:

```ts
import { writeRouteReExport, writeRoleGroup } from "../../src/commands/shared.js";

describe("writeRouteReExport", () => {
  it("writes the thin re-export at src/app/(role)/<screen>.tsx", () => {
    const t = mkTmp();
    const j = newJournal();
    const out = writeRouteReExport(t, "auth", "dashboard", "onBoarding", j);
    expect(out).toBe(path.join(t, "src/app/(auth)/onBoarding.tsx"));
    expect(fs.readFileSync(out, "utf8")).toBe(
      'export { default } from "@features/auth/dashboard/onBoarding";\n',
    );
    expect(j.created).toContain(out);
  });
});

describe("writeRoleGroup", () => {
  it("writes _layout.tsx + index.tsx redirect", () => {
    const t = mkTmp();
    const j = newJournal();
    const paths = writeRoleGroup(t, "auth", "onBoarding", j);
    expect(paths).toEqual([
      path.join(t, "src/app/(auth)/_layout.tsx"),
      path.join(t, "src/app/(auth)/index.tsx"),
    ]);
    expect(fs.readFileSync(paths[0]!, "utf8")).toContain("AuthLayout");
    expect(fs.readFileSync(paths[1]!, "utf8")).toContain(
      '<Redirect href="/(auth)/onBoarding" />',
    );
    for (const p of paths) {
      expect(j.created).toContain(p);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement writers**

Append to `src/commands/shared.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/shared.ts tests/commands/shared.test.ts
git commit -m "feat(commands/shared): writeRouteReExport + writeRoleGroup"
```

---

## Task 10: updateRedirectTarget (rewrite href, with snapshot)

**Files:**
- Modify: `src/commands/shared.ts`
- Modify: `tests/commands/shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/commands/shared.test.ts`:

```ts
import { updateRedirectTarget } from "../../src/commands/shared.js";

describe("updateRedirectTarget", () => {
  it("rewrites the href in (role)/index.tsx and records the prior content", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    const file = path.join(t, "src/app/(auth)/index.tsx");
    const before =
      'import { Redirect } from "expo-router";\n' +
      "export default function AuthIndex() {\n" +
      '  return <Redirect href="/(auth)/login" />;\n' +
      "}\n";
    fs.writeFileSync(file, before);

    const j = newJournal();
    const out = updateRedirectTarget(t, "auth", "dashboard", j);
    expect(out).toBe(file);
    expect(fs.readFileSync(file, "utf8")).toContain(
      '<Redirect href="/(auth)/dashboard" />',
    );
    expect(j.edited).toEqual([{ path: file, before }]);
  });

  it("throws if href pattern is missing", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    fs.writeFileSync(path.join(t, "src/app/(auth)/index.tsx"), "// no redirect\n");
    const j = newJournal();
    expect(() => updateRedirectTarget(t, "auth", "dashboard", j)).toThrow(
      /redirect/i,
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement updateRedirectTarget**

Append to `src/commands/shared.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/shared.ts tests/commands/shared.test.ts
git commit -m "feat(commands/shared): updateRedirectTarget with snapshot"
```

---

## Task 11: assertRoutesParseable + registerRoleInRoutes

**Files:**
- Modify: `src/commands/shared.ts`
- Modify: `tests/commands/shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/commands/shared.test.ts`:

```ts
import {
  assertRoutesParseable,
  registerRoleInRoutes,
} from "../../src/commands/shared.js";

function writeRoutes(t: string, content: string): string {
  const f = path.join(t, "src/app/routes.tsx");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  return f;
}

const ROUTES_OK =
  'import { Stack } from "expo-router";\n' +
  "\n" +
  "export default function Routes() {\n" +
  "  return (\n" +
  "    <Stack screenOptions={{ headerShown: false }}>\n" +
  '      <Stack.Screen name="index" />\n' +
  "    </Stack>\n" +
  "  );\n" +
  "}\n";

describe("assertRoutesParseable", () => {
  it("passes when the Stack open tag is present", () => {
    const t = mkTmp();
    writeRoutes(t, ROUTES_OK);
    expect(() => assertRoutesParseable(t)).not.toThrow();
  });

  it("throws if routes.tsx is missing", () => {
    const t = mkTmp();
    expect(() => assertRoutesParseable(t)).toThrow(/not found/i);
  });

  it("throws if Stack open tag pattern is absent", () => {
    const t = mkTmp();
    writeRoutes(t, "// no stack here\n");
    expect(() => assertRoutesParseable(t)).toThrow(/expected shape/i);
  });
});

describe("registerRoleInRoutes", () => {
  it("inserts <Stack.Screen name=\"(role)\" /> before </Stack> and records edit", () => {
    const t = mkTmp();
    writeRoutes(t, ROUTES_OK);
    const j = newJournal();
    const out = registerRoleInRoutes(t, "auth", j);
    expect(out).toBe(path.join(t, "src/app/routes.tsx"));
    const after = fs.readFileSync(out!, "utf8");
    expect(after).toContain('<Stack.Screen name="(auth)" />');
    expect(after).toContain('<Stack.Screen name="index" />');
    expect(j.edited).toHaveLength(1);
  });

  it("is idempotent: second call returns null and leaves the file unchanged", () => {
    const t = mkTmp();
    writeRoutes(t, ROUTES_OK);
    const j1 = newJournal();
    registerRoleInRoutes(t, "auth", j1);
    const snapshot = fs.readFileSync(path.join(t, "src/app/routes.tsx"), "utf8");
    const j2 = newJournal();
    const out = registerRoleInRoutes(t, "auth", j2);
    expect(out).toBeNull();
    expect(j2.edited).toEqual([]);
    expect(fs.readFileSync(path.join(t, "src/app/routes.tsx"), "utf8")).toBe(
      snapshot,
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement parseability check + splice**

Append to `src/commands/shared.ts`:

```ts
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
  const marker = `<Stack.Screen name="(${role})" />`;
  if (before.includes(marker)) {
    return null; // idempotent
  }
  const idx = before.lastIndexOf(STACK_CLOSE_TAG);
  if (idx < 0) {
    throw new Error(`routes.tsx missing </Stack> closing tag.`);
  }
  // Derive indentation from the whitespace between the previous newline and </Stack>.
  const head = before.slice(0, idx);
  const tail = before.slice(idx);
  const lastNl = head.lastIndexOf("\n");
  const trailingWs = head.slice(lastNl + 1); // typically "    " or "  "
  // Cut head back to (and including) the newline so we can re-emit indentation
  // for both the new line and the closing </Stack>.
  const trimmedHead = head.slice(0, lastNl + 1);
  const insertion = `${trailingWs}${marker}\n${trailingWs}`;
  const after = `${trimmedHead}${insertion}${tail}`;
  recordEdit(j, f, before);
  fs.writeFileSync(f, after);
  return f;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/shared.ts tests/commands/shared.test.ts
git commit -m "feat(commands/shared): assertRoutesParseable + registerRoleInRoutes (idempotent)"
```

---

## Task 12: assertExpoApp shared helper + rebuild reminder helper

**Files:**
- Modify: `src/commands/shared.ts`
- Modify: `tests/commands/shared.test.ts`

> Rationale: every command must guard "is this an Expo project?" the same way `src/add.ts` does, but we don't want to import a non-exported function. Lift the check into `shared.ts`. Also lift the rebuild reminder string so all three commands print it consistently.

- [ ] **Step 1: Write the failing tests**

Append to `tests/commands/shared.test.ts`:

```ts
import { assertExpoApp, printRebuildReminder } from "../../src/commands/shared.js";

describe("assertExpoApp", () => {
  it("throws when app.json is missing", () => {
    const t = mkTmp();
    expect(() => assertExpoApp(t)).toThrow(/app\.json/i);
  });

  it("passes when app.json is present", () => {
    const t = mkTmp();
    fs.writeFileSync(path.join(t, "app.json"), "{}");
    expect(() => assertExpoApp(t)).not.toThrow();
  });
});

describe("printRebuildReminder", () => {
  it("does not throw; emits a message to stdout", () => {
    expect(() => printRebuildReminder()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `src/commands/shared.ts`:

```ts
import { log } from "../util.js";

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
```

> Note: `log` may already be imported at the top of the file from earlier tasks. If so, merge the imports (do not duplicate).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/shared.ts tests/commands/shared.test.ts
git commit -m "feat(commands/shared): assertExpoApp + printRebuildReminder"
```

---

## Task 13: addRole orchestration + tests

**Files:**
- Create: `src/commands/role.ts`
- Create: `tests/commands/role.test.ts`

> Design note: the prompt step is wrapped behind a `promptInputs` function that callers can inject in tests. The shape is `{ feature: string; screen: string }`. This keeps tests deterministic without depending on `prompts`' tty behavior.

- [ ] **Step 1: Write the failing tests**

Create `tests/commands/role.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { addRole } from "../../src/commands/role.js";

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cmd-role-"));
}

function seedExpoApp(t: string): void {
  fs.writeFileSync(path.join(t, "app.json"), "{}");
  fs.mkdirSync(path.join(t, "src/app"), { recursive: true });
  fs.writeFileSync(
    path.join(t, "src/app/routes.tsx"),
    'import { Stack } from "expo-router";\n' +
      "\n" +
      "export default function Routes() {\n" +
      "  return (\n" +
      "    <Stack screenOptions={{ headerShown: false }}>\n" +
      '      <Stack.Screen name="index" />\n' +
      "    </Stack>\n" +
      "  );\n" +
      "}\n",
  );
}

describe("addRole", () => {
  it("creates features tree + route group + registers in routes.tsx", async () => {
    const t = mkTmp();
    seedExpoApp(t);

    await addRole("auth", {
      target: t,
      promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
    });

    expect(
      fs.existsSync(
        path.join(t, "src/features/auth/dashboard/onBoarding/index.tsx"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(t, "src/features/auth/dashboard/onBoarding/viewModel/_api.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          t,
          "src/features/auth/dashboard/onBoarding/viewModel/useOnBoardingViewModel.tsx",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(t, "src/features/auth/dashboard/types.ts")),
    ).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/_layout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/index.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/onBoarding.tsx"))).toBe(true);

    const routes = fs.readFileSync(path.join(t, "src/app/routes.tsx"), "utf8");
    expect(routes).toContain('<Stack.Screen name="(auth)" />');

    const redirect = fs.readFileSync(
      path.join(t, "src/app/(auth)/index.tsx"),
      "utf8",
    );
    expect(redirect).toContain('<Redirect href="/(auth)/onBoarding" />');
  });

  it("refuses when app.json is missing", async () => {
    const t = mkTmp();
    await expect(
      addRole("auth", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
      }),
    ).rejects.toThrow(/app\.json/i);
  });

  it("refuses when the role already exists (features dir)", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    fs.mkdirSync(path.join(t, "src/features/auth"), { recursive: true });
    await expect(
      addRole("auth", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it("refuses with malformed routes.tsx (no writes happen)", async () => {
    const t = mkTmp();
    fs.writeFileSync(path.join(t, "app.json"), "{}");
    fs.mkdirSync(path.join(t, "src/app"), { recursive: true });
    fs.writeFileSync(path.join(t, "src/app/routes.tsx"), "// no stack\n");
    await expect(
      addRole("auth", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
      }),
    ).rejects.toThrow(/expected shape/i);
    expect(fs.existsSync(path.join(t, "src/features/auth"))).toBe(false);
    expect(fs.existsSync(path.join(t, "src/app/(auth)"))).toBe(false);
  });

  it("rejects reserved role name", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    await expect(
      addRole("add", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
      }),
    ).rejects.toThrow(/reserved/i);
  });

  it("rollback: late failure removes all files just written", async () => {
    const t = mkTmp();
    seedExpoApp(t);

    // Inject a registerRoleInRoutes that throws after all other writes have
    // already been recorded — by patching routes.tsx to malformed AFTER
    // assertRoutesParseable runs but BEFORE registerRoleInRoutes splices.
    // Simplest approach: use the `_failAfterWrites` hook below.
    await expect(
      addRole("auth", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
        _failAfterWrites: true,
      }),
    ).rejects.toThrow(/_failAfterWrites/);

    // None of the new files should remain on disk.
    expect(fs.existsSync(path.join(t, "src/features/auth"))).toBe(false);
    expect(fs.existsSync(path.join(t, "src/app/(auth)"))).toBe(false);
    // routes.tsx is unchanged from seed.
    expect(
      fs.readFileSync(path.join(t, "src/app/routes.tsx"), "utf8"),
    ).not.toContain('"(auth)"');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/role.test.ts`
Expected: FAIL — `addRole` does not exist.

- [ ] **Step 3: Implement role.ts**

Create `src/commands/role.ts`:

```ts
// `add role <name>` — see docs/superpowers/specs/2026-05-12-role-feature-screen-commands-design.md.

import prompts from "prompts";
import { log } from "../util.js";
import { printFilesChanged } from "../add.js";
import {
  assertExpoApp,
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

  // 2. role-existence guard
  if (roleExists(target, role)) {
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
  printFilesChanged(written);
  printRebuildReminder();
  log.success(`Role "${role}" ready.`);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/role.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/role.ts tests/commands/role.test.ts
git commit -m "feat(commands): addRole with atomic rollback"
```

---

## Task 14: addFeature orchestration + tests

**Files:**
- Create: `src/commands/feature.ts`
- Create: `tests/commands/feature.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/commands/feature.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { addRole } from "../../src/commands/role.js";
import { addFeature } from "../../src/commands/feature.js";

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cmd-feature-"));
}

function seedExpoApp(t: string): void {
  fs.writeFileSync(path.join(t, "app.json"), "{}");
  fs.mkdirSync(path.join(t, "src/app"), { recursive: true });
  fs.writeFileSync(
    path.join(t, "src/app/routes.tsx"),
    'import { Stack } from "expo-router";\n' +
      "\n" +
      "export default function Routes() {\n" +
      "  return (\n" +
      "    <Stack screenOptions={{ headerShown: false }}>\n" +
      '      <Stack.Screen name="index" />\n' +
      "    </Stack>\n" +
      "  );\n" +
      "}\n",
  );
}

async function seedRole(t: string): Promise<void> {
  seedExpoApp(t);
  await addRole("auth", {
    target: t,
    promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
  });
}

describe("addFeature", () => {
  it("adds a new feature + screen + re-export", async () => {
    const t = mkTmp();
    await seedRole(t);

    await addFeature("auth", "profile", {
      target: t,
      promptInputs: async () => ({ screen: "edit", makeInitial: false }),
    });

    expect(fs.existsSync(path.join(t, "src/features/auth/profile/types.ts"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(t, "src/features/auth/profile/edit/index.tsx")),
    ).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/edit.tsx"))).toBe(true);

    // Redirect untouched (makeInitial=false).
    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/onBoarding" />');
  });

  it("rewrites redirect when makeInitial=true", async () => {
    const t = mkTmp();
    await seedRole(t);

    await addFeature("auth", "profile", {
      target: t,
      promptInputs: async () => ({ screen: "edit", makeInitial: true }),
    });

    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/edit" />');
  });

  it("refuses when role does not exist", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    await expect(
      addFeature("auth", "profile", {
        target: t,
        promptInputs: async () => ({ screen: "edit", makeInitial: false }),
      }),
    ).rejects.toThrow(/role.*does not exist/i);
  });

  it("refuses when feature already exists", async () => {
    const t = mkTmp();
    await seedRole(t);
    await expect(
      addFeature("auth", "dashboard", {
        target: t,
        promptInputs: async () => ({ screen: "extra", makeInitial: false }),
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it("refuses on route-file collision (screen name conflicts with existing route)", async () => {
    const t = mkTmp();
    await seedRole(t);
    await expect(
      addFeature("auth", "profile", {
        target: t,
        promptInputs: async () => ({ screen: "onBoarding", makeInitial: false }),
      }),
    ).rejects.toThrow(/already exists/i);
    // Profile feature was NOT created (pre-flight refusal).
    expect(fs.existsSync(path.join(t, "src/features/auth/profile"))).toBe(false);
  });

  it("rollback: late failure removes the just-created feature", async () => {
    const t = mkTmp();
    await seedRole(t);
    await expect(
      addFeature("auth", "profile", {
        target: t,
        promptInputs: async () => ({ screen: "edit", makeInitial: true }),
        _failAfterWrites: true,
      }),
    ).rejects.toThrow(/_failAfterWrites/);
    expect(fs.existsSync(path.join(t, "src/features/auth/profile"))).toBe(false);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/edit.tsx"))).toBe(false);
    // Redirect remains at original onBoarding target (rollback restored).
    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/onBoarding" />');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/feature.test.ts`
Expected: FAIL — `addFeature` does not exist.

- [ ] **Step 3: Implement feature.ts**

Create `src/commands/feature.ts`:

```ts
// `add feature <role> <name>` — see design spec.

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

async function promptViaPrompts(): Promise<{ screen: string; makeInitial: boolean }> {
  const a = await prompts(
    [
      {
        type: "text",
        name: "screen",
        message: "Screen name?",
        validate: (v: string) => (v.trim() === "" ? "Required" : true),
      },
      {
        type: "toggle",
        name: "makeInitial",
        message: "Make initial screen of stack?",
        initial: false,
        active: "yes",
        inactive: "no",
      },
    ],
    { onCancel: () => process.exit(1) },
  );
  return { screen: a.screen, makeInitial: a.makeInitial };
}

export async function addFeature(
  roleArg: string | undefined,
  nameArg: string | undefined,
  opts: AddFeatureOptions = {},
): Promise<void> {
  const target = opts.target ?? process.cwd();
  const promptInputs = opts.promptInputs ?? promptViaPrompts;

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

  const inputs = await promptInputs();
  const screen = assertScreenName(inputs.screen);

  if (routeFileExists(target, role, screen)) {
    throw new Error(
      `Route file already exists: src/app/(${role})/${screen}.tsx (another feature owns this screen). Pick a different screen name.`,
    );
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

    if (inputs.makeInitial) {
      written.push(updateRedirectTarget(target, role, screen, j));
    }
  } catch (err) {
    log.error(`add feature failed — rolling back changes`);
    await rollback(j);
    throw err;
  }

  printFilesChanged(written);
  printRebuildReminder();
  log.success(`Feature "${role}/${feature}" ready.`);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/feature.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/feature.ts tests/commands/feature.test.ts
git commit -m "feat(commands): addFeature with collision refusal + rollback"
```

---

## Task 15: addScreen orchestration + tests

**Files:**
- Create: `src/commands/screen.ts`
- Create: `tests/commands/screen.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/commands/screen.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { addRole } from "../../src/commands/role.js";
import { addFeature } from "../../src/commands/feature.js";
import { addScreen } from "../../src/commands/screen.js";

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cmd-screen-"));
}

function seedExpoApp(t: string): void {
  fs.writeFileSync(path.join(t, "app.json"), "{}");
  fs.mkdirSync(path.join(t, "src/app"), { recursive: true });
  fs.writeFileSync(
    path.join(t, "src/app/routes.tsx"),
    'import { Stack } from "expo-router";\n' +
      "\n" +
      "export default function Routes() {\n" +
      "  return (\n" +
      "    <Stack screenOptions={{ headerShown: false }}>\n" +
      '      <Stack.Screen name="index" />\n' +
      "    </Stack>\n" +
      "  );\n" +
      "}\n",
  );
}

async function seedFeature(t: string): Promise<void> {
  seedExpoApp(t);
  await addRole("auth", {
    target: t,
    promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
  });
}

describe("addScreen", () => {
  it("adds a sibling screen to an existing feature", async () => {
    const t = mkTmp();
    await seedFeature(t);

    await addScreen("auth", "dashboard", "teamDetails", {
      target: t,
      promptInputs: async () => ({ makeInitial: false }),
    });

    expect(
      fs.existsSync(
        path.join(t, "src/features/auth/dashboard/teamDetails/index.tsx"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          t,
          "src/features/auth/dashboard/teamDetails/viewModel/useTeamDetailsViewModel.tsx",
        ),
      ),
    ).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/teamDetails.tsx"))).toBe(
      true,
    );
  });

  it("rewrites redirect when makeInitial=true", async () => {
    const t = mkTmp();
    await seedFeature(t);
    await addScreen("auth", "dashboard", "teamDetails", {
      target: t,
      promptInputs: async () => ({ makeInitial: true }),
    });
    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/teamDetails" />');
  });

  it("refuses when feature does not exist", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    await expect(
      addScreen("auth", "dashboard", "teamDetails", {
        target: t,
        promptInputs: async () => ({ makeInitial: false }),
      }),
    ).rejects.toThrow(/feature.*does not exist/i);
  });

  it("refuses when screen folder already exists", async () => {
    const t = mkTmp();
    await seedFeature(t);
    await expect(
      addScreen("auth", "dashboard", "onBoarding", {
        target: t,
        promptInputs: async () => ({ makeInitial: false }),
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it("refuses on route-file collision across features", async () => {
    const t = mkTmp();
    await seedFeature(t);
    await addFeature("auth", "profile", {
      target: t,
      promptInputs: async () => ({ screen: "settings", makeInitial: false }),
    });
    // Now try to add `settings` under `dashboard` — collides with profile/settings's route file.
    await expect(
      addScreen("auth", "dashboard", "settings", {
        target: t,
        promptInputs: async () => ({ makeInitial: false }),
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it("rollback: late failure leaves filesystem unchanged", async () => {
    const t = mkTmp();
    await seedFeature(t);
    await expect(
      addScreen("auth", "dashboard", "teamDetails", {
        target: t,
        promptInputs: async () => ({ makeInitial: true }),
        _failAfterWrites: true,
      }),
    ).rejects.toThrow(/_failAfterWrites/);
    expect(
      fs.existsSync(path.join(t, "src/features/auth/dashboard/teamDetails")),
    ).toBe(false);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/teamDetails.tsx"))).toBe(
      false,
    );
    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/onBoarding" />');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/commands/screen.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement screen.ts**

Create `src/commands/screen.ts`:

```ts
// `add screen <role> <feature> <name>` — see design spec.

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

  const role = assertRoleName(roleArg ?? (await promptName("Role name")));
  const feature = assertFeatureName(featureArg ?? (await promptName("Feature name")));

  if (!featureExists(target, role, feature)) {
    throw new Error(
      `Feature "${role}/${feature}" does not exist. Create it with \`add feature ${role} ${feature}\` first.`,
    );
  }

  const screen = assertScreenName(nameArg ?? (await promptName("Screen name")));

  if (screenExists(target, role, feature, screen)) {
    throw new Error(
      `Screen "${role}/${feature}/${screen}" already exists at src/features/${role}/${feature}/${screen}.`,
    );
  }

  if (routeFileExists(target, role, screen)) {
    throw new Error(
      `Route file already exists: src/app/(${role})/${screen}.tsx (owned by another feature in this role). Pick a different screen name.`,
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

  printFilesChanged(written);
  printRebuildReminder();
  log.success(`Screen "${role}/${feature}/${screen}" ready.`);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/commands/screen.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/screen.ts tests/commands/screen.test.ts
git commit -m "feat(commands): addScreen with collision refusal + rollback"
```

---

## Task 16: Wire dispatcher in src/index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Read the current dispatcher**

Open `src/index.ts` and locate (around line 73):

```ts
  const argv = process.argv.slice(2);
  if (argv[0] === "add") {
    await runAdd(argv[1]);
    return;
  }
```

- [ ] **Step 2: Replace with the role/feature/screen branches**

Edit `src/index.ts`. Replace the snippet above with:

```ts
  const argv = process.argv.slice(2);
  if (argv[0] === "add" && argv[1] === "role") {
    const { addRole } = await import("./commands/role.js");
    await addRole(argv[2]);
    return;
  }
  if (argv[0] === "add" && argv[1] === "feature") {
    const { addFeature } = await import("./commands/feature.js");
    await addFeature(argv[2], argv[3]);
    return;
  }
  if (argv[0] === "add" && argv[1] === "screen") {
    const { addScreen } = await import("./commands/screen.js");
    await addScreen(argv[2], argv[3], argv[4]);
    return;
  }
  if (argv[0] === "add") {
    await runAdd(argv[1]);
    return;
  }
```

Lazy `import()` keeps the existing scaffold flow cold-start unaffected.

- [ ] **Step 3: Add type-build smoke**

Run: `npm run build`
Expected: tsc completes with no errors. Output written to `dist/`.

- [ ] **Step 4: Run full vitest suite**

Run: `npx vitest run`
Expected: every existing test plus all new command tests PASS.

- [ ] **Step 5: Manual CLI smoke**

Run from a tmp dir simulating a project root:

```bash
TMP=$(mktemp -d)
cd "$TMP"
echo '{}' > app.json
mkdir -p src/app
cat > src/app/routes.tsx <<'TSX'
import { Stack } from "expo-router";

export default function Routes() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
TSX

node "$OLDPWD/dist/index.js" add role auth <<< $'admin\nlogin\n' || true
ls -R src/features src/app
```

This invokes `add role auth`, then answers the two prompts in order: `admin` for the first feature name, `login` for the first screen name. Expected layout after the run:

- `src/features/auth/admin/types.ts` exists
- `src/features/auth/admin/login/index.tsx` exists
- `src/features/auth/admin/login/viewModel/_api.ts` exists
- `src/features/auth/admin/login/viewModel/useLoginViewModel.tsx` exists
- `src/app/(auth)/_layout.tsx` exists (empty `<Stack headerShown:false />`)
- `src/app/(auth)/index.tsx` redirects to `/(auth)/login`
- `src/app/(auth)/login.tsx` re-exports from `@features/auth/admin/login`
- `src/app/routes.tsx` now contains `<Stack.Screen name="(auth)" />`

If anything diverges, fix before committing.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat(cli): dispatch add role|feature|screen to src/commands/"
```

---

## Task 17: README.md (CLI docs)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Locate the existing "Post-scaffold `add` commands" section**

Run: `grep -n "Post-scaffold" README.md`

- [ ] **Step 2: Append a new subsection after the existing recipes**

Add the following block immediately after the asset recipes section in `README.md`:

```markdown
### Generate role / feature / screen

Scaffold the navigation/feature layout in an already-scaffolded project.

#### `add role <name>`

Creates an Expo Router group, the feature root, and one starter screen.

```bash
react-native-expo-boilerplate add role auth
# prompts: First feature name? dashboard
# prompts: First screen name?  onBoarding
```

Produces:

```
src/features/auth/dashboard/
  types.ts
  onBoarding/
    index.tsx
    viewModel/_api.ts
    viewModel/useOnBoardingViewModel.tsx
src/app/(auth)/
  _layout.tsx     # empty <Stack headerShown:false />
  index.tsx       # <Redirect href="/(auth)/onBoarding" />
  onBoarding.tsx  # re-export from @features/auth/dashboard/onBoarding
```

Also registers `<Stack.Screen name="(auth)" />` in `src/app/routes.tsx`.

#### `add feature <role> <name>`

Adds a sibling feature under an existing role.

```bash
react-native-expo-boilerplate add feature auth profile
# prompts: Screen name?            edit
# prompts: Make initial screen?    no
```

Refuses if the role does not exist or the feature already exists. Refuses if the chosen screen name collides with an existing route file in the same role group. The route layout is **flat per role**: `src/app/(<role>)/<screen>.tsx`, so screen names must be unique within a role.

If you answer "yes" to the initial-screen prompt, the redirect in `src/app/(<role>)/index.tsx` is rewritten to point at the new screen.

#### `add screen <role> <feature> <name>`

Adds a sibling screen to an existing feature.

```bash
react-native-expo-boilerplate add screen auth dashboard teamDetails
# prompts: Make initial screen? no
```

Refuses if the role or feature does not exist, the screen already exists, or the screen name collides with an existing route file in the role.

#### Naming

All names are accepted as `kebab-case`, `snake_case`, `space separated`, or `camelCase`/`PascalCase` and normalized to `camelCase`. ViewModel hooks use `PascalCase`: `teamDetails` → `useTeamDetailsViewModel`.

#### Atomic writes

Every command is all-or-nothing. If any step fails (e.g. a malformed `routes.tsx`), the command rolls back every file it just created or modified and surfaces the underlying error.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README section for add role/feature/screen commands"
```

---

## Task 18: templates/base/README.md (generated-app docs)

**Files:**
- Modify: `templates/base/README.md`

- [ ] **Step 1: Locate the "Post-scaffold recipes" section**

Run: `grep -n "Post-scaffold" templates/base/README.md`

- [ ] **Step 2: Append the same trio in summary form**

Append immediately after the existing recipe table in `templates/base/README.md`:

```markdown
### Generate role / feature / screen

```bash
react-native-expo-boilerplate add role <role>             # prompts feature + screen
react-native-expo-boilerplate add feature <role> <name>   # prompts screen + initial?
react-native-expo-boilerplate add screen <role> <feature> <name>   # prompts initial?
```

Names are normalized to `camelCase`. ViewModels and components use `PascalCase`. Atomic: rolls back on failure.

See the project README for the full layout and collision rules.
```

- [ ] **Step 3: Commit**

```bash
git add templates/base/README.md
git commit -m "docs(template): add role/feature/screen recipe summary"
```

---

## Task 19: Slash-command docs (templates/claude-command/)

**Files:**
- Create: `templates/claude-command/add-role.md`
- Create: `templates/claude-command/add-feature.md`
- Create: `templates/claude-command/add-screen.md`

- [ ] **Step 1: Read an existing slash-command doc for the format**

Run: `cat templates/claude-command/add-bottom-sheet.md`

- [ ] **Step 2: Write add-role.md**

Create `templates/claude-command/add-role.md`:

```markdown
---
description: Scaffold a role (Expo Router group + feature folder + starter screen) in this project.
---

Run `react-native-expo-boilerplate add role` from the project root. The CLI will prompt for the first feature name and first screen name, then create:

- `src/features/<role>/<feature>/types.ts`
- `src/features/<role>/<feature>/<screen>/index.tsx`
- `src/features/<role>/<feature>/<screen>/viewModel/_api.ts`
- `src/features/<role>/<feature>/<screen>/viewModel/use<Screen>ViewModel.tsx`
- `src/app/(<role>)/_layout.tsx`
- `src/app/(<role>)/index.tsx` (redirects to the starter screen)
- `src/app/(<role>)/<screen>.tsx` (re-export)
- registers `<Stack.Screen name="(<role>)" />` in `src/app/routes.tsx`.

Atomic: if anything fails, every file written so far is rolled back.

Rebuild after the command finishes:

```bash
yarn ios      # or yarn android
```
```

- [ ] **Step 3: Write add-feature.md**

Create `templates/claude-command/add-feature.md`:

```markdown
---
description: Add a new feature (folder + one screen) under an existing role in this project.
---

Run `react-native-expo-boilerplate add feature <role> <name>` from the project root. The CLI will prompt for a screen name and whether the new screen should become the role's initial (redirect) screen.

Creates:

- `src/features/<role>/<feature>/types.ts`
- `src/features/<role>/<feature>/<screen>/index.tsx` + `viewModel/` files
- `src/app/(<role>)/<screen>.tsx` (re-export)

Refuses if the role doesn't exist, the feature already exists, or the screen name collides with an existing route file in the same role.

Rebuild after the command finishes:

```bash
yarn ios      # or yarn android
```
```

- [ ] **Step 4: Write add-screen.md**

Create `templates/claude-command/add-screen.md`:

```markdown
---
description: Add a screen to an existing feature in this project.
---

Run `react-native-expo-boilerplate add screen <role> <feature> <name>` from the project root. The CLI prompts whether the new screen should become the role's initial (redirect) screen.

Creates:

- `src/features/<role>/<feature>/<screen>/index.tsx`
- `src/features/<role>/<feature>/<screen>/viewModel/_api.ts`
- `src/features/<role>/<feature>/<screen>/viewModel/use<Screen>ViewModel.tsx`
- `src/app/(<role>)/<screen>.tsx` (re-export)

Refuses if the role/feature don't exist, the screen folder already exists, or the route name collides with another feature in the same role.

Rebuild after the command finishes:

```bash
yarn ios      # or yarn android
```
```

- [ ] **Step 5: Commit**

```bash
git add templates/claude-command/add-role.md templates/claude-command/add-feature.md templates/claude-command/add-screen.md
git commit -m "docs(claude-command): slash docs for add role/feature/screen"
```

---

## Task 20: Version bump + full suite sanity

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump version**

Edit `package.json` line 3:

```json
  "version": "0.2.3",
```

to

```json
  "version": "0.3.0",
```

- [ ] **Step 2: Run full prepublish chain (locally, NO publish)**

Run: `npm run build && npm test`
Expected: all tests pass. (`npm run audit:templates` may run too; ensure it still passes.)

Do **not** run `npm publish` and do **not** run `git push`. The user has explicitly disallowed pushing/publishing — this plan ends with a clean local commit.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump version 0.2.3 → 0.3.0 (add role/feature/screen commands)"
```

- [ ] **Step 4: Verify clean working tree**

Run: `git status`
Expected: `working tree clean`.

Run: `git log --oneline -10`
Expected: a clear stack of commits from Task 1 through Task 20, all referencing the new commands.

---

## Done

All four spec sections (architecture, command behavior, file templates, atomic writes & rollback) are implemented and covered by tests. The CLI dispatches `add role|feature|screen` to the new module; existing recipes are untouched. No remote pushes were performed.
