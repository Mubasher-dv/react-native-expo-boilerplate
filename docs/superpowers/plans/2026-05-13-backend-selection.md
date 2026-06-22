# Backend Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `backendType` prompt to the scaffold CLI so users choose `firebase-js`, `firebase-rn`, `supabase`, or `custom-backend` at project creation time; each choice gates which packages are installed, which template files are copied, and which sentinels in `_layout.tsx` are filled.

**Architecture:** Keep `templates/base/` unchanged for non-backend files; pass `backendType` into `applyBase()` to skip backend-specific files via `fse.copySync`'s `filter` callback. New overlay dirs (`firebase-js/`, `firebase-rn/`, `supabase/`) are applied on top of base, mirroring the existing `applyBottomSheet()` / `applyImagePicker()` pattern. `TanStackQueryProvider` in `_layout.tsx` becomes sentinel-controlled; Firebase backends get empty-string replacements (line dropped), others get the real import/JSX.

**Tech Stack:** Node.js / TypeScript, `prompts` (interactive CLI), `fs-extra` (file copy with filter), `vitest` (tests). All source is in `src/`, templates in `templates/`, tests in `tests/`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/prompts.ts` | Modify | Export `BackendType`, add `backendType` to `Answers`, validate `EXPO_BACKEND_TYPE`, add backend + firebase sub-prompts to `gatherAnswers()` |
| `src/install.ts` | Modify | Remove `@tanstack/react-query`+`axios` from always-list; branch backend-specific packages in `buildConditionalDeps()` |
| `src/overlay.ts` | Modify | Export `isSkippedForBackend()`; add `backendType` param to `applyBase()`; add `applyFirebaseJs()`, `applyFirebaseRn()`, `applySupabase()` |
| `src/fonts.ts` | Modify | Export `generateTanStackProviderBlocks()`; add TanStack sentinel keys to `buildLayoutReplacements()` |
| `src/patch.ts` | Modify | Add `patchUserSliceForFirebase()`; update `patchAppJsonPlugins()` for firebase-rn |
| `src/index.ts` | Modify | Pass `backendType` through pipeline; call new overlays; call `patchUserSliceForFirebase`; print firebase-rn warning |
| `templates/base/src/app/_layout.tsx` | Modify | Replace hardcoded `TanStackQueryProvider` import + JSX with three sentinels |
| `templates/firebase-js/src/core/firebase/index.ts` | Create | Firebase JS SDK: init + auth + firestore + storage |
| `templates/firebase-rn/src/core/firebase/index.ts` | Create | React Native Firebase: re-export auth, firestore, storage |
| `templates/supabase/src/core/supabase/index.ts` | Create | Supabase client + MMKV session adapter |
| `tests/prompts.test.ts` | Modify | Add `EXPO_BACKEND_TYPE` validation tests; update `gatherAnswers` fixtures; add `EXPO_BACKEND_TYPE` to `ENV_KEYS` |
| `tests/install.test.ts` | Modify | Update `A` fixture; add backend-conditional dep tests |
| `tests/overlay.test.ts` | Modify | Add `isSkippedForBackend` tests |
| `tests/fonts.test.ts` | Modify | Update `A` fixture; add TanStack sentinel tests |
| `tests/patch.test.ts` | Modify | Update `baseAnswers` fixture; add `patchUserSliceForFirebase` + `patchAppJsonPlugins` firebase-rn tests |
| `README.md` | Modify | Document `backendType` prompt + `EXPO_BACKEND_TYPE` env var |

---

## Task 1: Export `BackendType` + add `backendType` to `Answers` + validate `EXPO_BACKEND_TYPE`

**Files:**
- Modify: `src/prompts.ts`
- Modify: `tests/prompts.test.ts`

- [ ] **Step 1: Write failing test for `EXPO_BACKEND_TYPE` validation**

Add to the `describe("validateEnvVars")` block in `tests/prompts.test.ts`:

```typescript
it('EXPO_BACKEND_TYPE="invalid" → throws', () => {
  process.env.EXPO_BACKEND_TYPE = "invalid";
  expect(() => validateEnvVars()).toThrow(
    /EXPO_BACKEND_TYPE.*expected one of/,
  );
});

it('EXPO_BACKEND_TYPE="firebase-js" → no throw', () => {
  process.env.EXPO_BACKEND_TYPE = "firebase-js";
  expect(() => validateEnvVars()).not.toThrow();
});
```

Also add `"EXPO_BACKEND_TYPE"` to the `ENV_KEYS` array (line 24–30):

```typescript
const ENV_KEYS = [
  "EXPO_PRIMARY_FONT",
  "EXPO_SECONDARY_FONT",
  "EXPO_INCLUDE_BOTTOM_SHEET",
  "EXPO_INCLUDE_IMAGE_PICKER",
  "EXPO_PACKAGE_MANAGER",
  "EXPO_BACKEND_TYPE",
];
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/MAC/Desktop/Expo/customPackage/react-native-expo-boilerplate
npm test -- --reporter=verbose 2>&1 | grep -A3 "EXPO_BACKEND_TYPE"
```

Expected: compile error or test fail — `EXPO_BACKEND_TYPE` not yet validated.

- [ ] **Step 3: Add `BackendType` + update `Answers` + add validation in `src/prompts.ts`**

After the existing `PackageManager` type (line 5), add:

```typescript
export type BackendType = "firebase-js" | "firebase-rn" | "supabase" | "custom-backend";
```

Update `Answers` type (lines 7–13):

```typescript
export type Answers = {
  primaryFont: string;
  secondaryFont: string;
  bottomSheet: boolean;
  imagePicker: boolean;
  packageManager: PackageManager;
  backendType: BackendType;
};
```

Add `BACKEND_TYPE_VALUES` constant at **module scope** (after `PackageManager` type, before `STRICT_BOOL_VARS`):

```typescript
const BACKEND_TYPE_VALUES = ["firebase-js", "firebase-rn", "supabase", "custom-backend"] as const;
```

Then add `EXPO_BACKEND_TYPE` validation inside `validateEnvVars()`, after the `for` loop:

```typescript
// Inside validateEnvVars(), after the for loop:
const bt = process.env.EXPO_BACKEND_TYPE;
if (bt !== undefined && bt !== "" && !BACKEND_TYPE_VALUES.includes(bt as BackendType)) {
  throw new Error(
    `EXPO_BACKEND_TYPE: expected one of "firebase-js", "firebase-rn", "supabase", "custom-backend", got "${bt}"`,
  );
}
```

Also update the `gatherAnswers()` return statement to include a stub `backendType` so this commit compiles cleanly before Task 2 adds full resolution logic:

```typescript
return { primaryFont, secondaryFont, bottomSheet, imagePicker, packageManager, backendType: "custom-backend" };
```

> Task 2 Step 3 replaces this stub with the env-var / TTY prompt / default resolution block. Without this stub, `Answers` requires `backendType` but `gatherAnswers` doesn't return it — TypeScript compilation fails between the Task 1 and Task 2 commits.

- [ ] **Step 4: Update `Answers` fixtures in `install`, `patch`, and `fonts` test files**

> Do NOT update `gatherAnswers` tests in `tests/prompts.test.ts` here — those updates require the Task 2 implementation and are added as failing tests in Task 2 Step 1.

In `tests/install.test.ts`, add `backendType: "custom-backend"` to the `A` fixture (line 22–28):

```typescript
const A: Answers = {
  primaryFont: "",
  secondaryFont: "",
  bottomSheet: false,
  imagePicker: false,
  packageManager: "yarn",
  backendType: "custom-backend",
};
```

In `tests/patch.test.ts`, add `backendType: "custom-backend"` to `baseAnswers` (line 30–36):

```typescript
const baseAnswers: Answers = {
  primaryFont: "",
  secondaryFont: "",
  bottomSheet: false,
  imagePicker: false,
  packageManager: "yarn",
  backendType: "custom-backend",
};
```

In `tests/fonts.test.ts`, add `backendType: "custom-backend"` to the `A` fixture (line 70–76):

```typescript
const A: Answers = {
  primaryFont: "",
  secondaryFont: "",
  bottomSheet: false,
  imagePicker: false,
  packageManager: "yarn",
  backendType: "custom-backend",
};
```

- [ ] **Step 5: Run tests to verify validation tests pass and no fixtures broke**

```bash
npm test 2>&1 | tail -20
```

Expected: All existing tests pass; the two new `EXPO_BACKEND_TYPE` validation tests pass. (`gatherAnswers` tests in `prompts.test.ts` are not yet updated — they stay as-is until Task 2.)

- [ ] **Step 6: Commit**

```bash
git add src/prompts.ts tests/prompts.test.ts tests/install.test.ts tests/patch.test.ts tests/fonts.test.ts
git commit -m "feat: add BackendType to Answers + EXPO_BACKEND_TYPE validation"
```

---

## Task 2: Add backend + Firebase sub-prompts to `gatherAnswers()`

**Files:**
- Modify: `src/prompts.ts`
- Modify: `tests/prompts.test.ts`

- [ ] **Step 1: Write failing tests — backend resolution + update existing `gatherAnswers` fixtures**

Add to `describe("gatherAnswers")` block in `tests/prompts.test.ts`:

```typescript
it("EXPO_BACKEND_TYPE=firebase-rn → backendType resolved from env, no prompt", async () => {
  process.env.EXPO_INCLUDE_BOTTOM_SHEET = "0";
  process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
  process.env.EXPO_PACKAGE_MANAGER = "yarn";
  process.env.EXPO_BACKEND_TYPE = "firebase-rn";
  const ans = await gatherAnswers();
  expect(ans.backendType).toBe("firebase-rn");
  expect(promptsMock).not.toHaveBeenCalled();
});

it("no EXPO_BACKEND_TYPE + non-TTY → defaults to custom-backend (no throw)", async () => {
  process.env.EXPO_INCLUDE_BOTTOM_SHEET = "0";
  process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
  process.env.EXPO_PACKAGE_MANAGER = "yarn";
  // EXPO_BACKEND_TYPE not set
  const ans = await gatherAnswers();
  expect(ans.backendType).toBe("custom-backend");
});
```

Also update the existing `env-all-set` test (around line 153) — add `EXPO_BACKEND_TYPE` to setup and `backendType` to expected `toEqual`:

```typescript
it("env-all-set → no prompts called; fonts read from env vars", async () => {
  process.env.EXPO_PRIMARY_FONT = "Inter";
  process.env.EXPO_SECONDARY_FONT = "Roboto";
  process.env.EXPO_INCLUDE_BOTTOM_SHEET = "1";
  process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
  process.env.EXPO_PACKAGE_MANAGER = "yarn";
  process.env.EXPO_BACKEND_TYPE = "supabase";
  const ans = await gatherAnswers();
  expect(ans).toEqual({
    primaryFont: "Inter",
    secondaryFont: "Roboto",
    bottomSheet: true,
    imagePicker: false,
    packageManager: "yarn",
    backendType: "supabase",
  });
  expect(promptsMock).not.toHaveBeenCalled();
});
```

Also add `process.env.EXPO_BACKEND_TYPE = "custom-backend"` to each of the two tests in `describe("gatherAnswers font prompts")` (lines 183–208).

- [ ] **Step 2: Run test to see failure**

```bash
npm test -- tests/prompts.test.ts 2>&1 | tail -30
```

Expected: `backendType` property missing on `ans` (TypeScript or runtime error since `gatherAnswers` doesn't populate it yet).

- [ ] **Step 3: Implement backend resolution in `gatherAnswers()` in `src/prompts.ts`**

> `BACKEND_TYPE_VALUES` was added at module scope in Task 1 — do not re-add it here.

Inside `gatherAnswers()`, add the backend prompt block AFTER the imagePicker prompt block and BEFORE `const packageManager = await detectPackageManager()`:

```typescript
// Backend type — env-var first, TTY prompt fallback, else default to custom-backend.
let backendType: BackendType;
const envBackendType = process.env.EXPO_BACKEND_TYPE;
if (envBackendType && BACKEND_TYPE_VALUES.includes(envBackendType as BackendType)) {
  backendType = envBackendType as BackendType;
} else if (tty) {
  const btAns = await prompts({
    type: "select",
    name: "backendType",
    message: "What backend type?",
    choices: [
      { title: "firebase", value: "firebase" },
      { title: "supabase", value: "supabase" },
      { title: "custom-backend", value: "custom-backend" },
    ],
  });
  if (btAns.backendType === "firebase") {
    const fbAns = await prompts({
      type: "select",
      name: "firebaseSdk",
      message: "Firebase SDK:",
      choices: [
        { title: "Firebase JS SDK (Expo Go compatible)", value: "firebase-js" },
        { title: "React Native Firebase (requires dev client)", value: "firebase-rn" },
      ],
    });
    backendType = fbAns.firebaseSdk as BackendType;
  } else {
    backendType = btAns.backendType as BackendType;
  }
} else {
  backendType = "custom-backend";
}
```

Update the return statement to include `backendType`:

```typescript
return { primaryFont, secondaryFont, bottomSheet, imagePicker, packageManager, backendType };
```

> `validateEnvVars` was already updated with the `EXPO_BACKEND_TYPE` check in Task 1 — no changes needed here.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/prompts.test.ts 2>&1 | tail -20
```

Expected: All prompts tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/prompts.ts tests/prompts.test.ts
git commit -m "feat: add backend + firebase sub-prompt to gatherAnswers"
```

---

## Task 3: Branch package installation by `backendType`

**Files:**
- Modify: `src/install.ts`
- Modify: `tests/install.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/install.test.ts` after the existing `buildConditionalDeps` describe block:

```typescript
describe("buildAlwaysInstalledList — no longer contains backend-conditional packages", () => {
  it("does NOT contain @tanstack/react-query (moved to conditional)", () => {
    expect(buildAlwaysInstalledList("react-native-worklets")).not.toContain("@tanstack/react-query");
  });
  it("does NOT contain axios (moved to conditional)", () => {
    expect(buildAlwaysInstalledList("react-native-worklets")).not.toContain("axios");
  });
});

describe("buildConditionalDeps — backend packages", () => {
  it("firebase-js → installs firebase only", () => {
    const deps = buildConditionalDeps({ ...A, backendType: "firebase-js" });
    expect(deps).toContain("firebase");
    expect(deps).not.toContain("@tanstack/react-query");
    expect(deps).not.toContain("axios");
    expect(deps).not.toContain("@supabase/supabase-js");
  });

  it("firebase-rn → installs 4 RN Firebase packages", () => {
    const deps = buildConditionalDeps({ ...A, backendType: "firebase-rn" });
    expect(deps).toContain("@react-native-firebase/app");
    expect(deps).toContain("@react-native-firebase/auth");
    expect(deps).toContain("@react-native-firebase/firestore");
    expect(deps).toContain("@react-native-firebase/storage");
    expect(deps).not.toContain("@tanstack/react-query");
    expect(deps).not.toContain("axios");
  });

  it("supabase → installs TanStack + Supabase client, no axios", () => {
    const deps = buildConditionalDeps({ ...A, backendType: "supabase" });
    expect(deps).toContain("@tanstack/react-query");
    expect(deps).toContain("@supabase/supabase-js");
    expect(deps).not.toContain("axios");
    expect(deps).not.toContain("firebase");
  });

  it("custom-backend → installs TanStack + axios", () => {
    const deps = buildConditionalDeps({ ...A, backendType: "custom-backend" });
    expect(deps).toContain("@tanstack/react-query");
    expect(deps).toContain("axios");
    expect(deps).not.toContain("firebase");
    expect(deps).not.toContain("@supabase/supabase-js");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/install.test.ts 2>&1 | grep -E "FAIL|PASS|×|✓" | head -20
```

Expected: The new backend package tests fail; existing tests pass.

- [ ] **Step 3: Update `src/install.ts`**

In `buildAlwaysInstalledList`, remove `"@tanstack/react-query"` and `"axios"` from the array (lines 19–20).

Replace `buildConditionalDeps` with:

```typescript
export function buildConditionalDeps(answers: Answers): string[] {
  const out: string[] = [];
  if (answers.bottomSheet) out.push("@gorhom/bottom-sheet");
  if (answers.imagePicker) out.push("expo-image-picker");

  switch (answers.backendType) {
    case "firebase-js":
      out.push("firebase");
      break;
    case "firebase-rn":
      out.push(
        "@react-native-firebase/app",
        "@react-native-firebase/auth",
        "@react-native-firebase/firestore",
        "@react-native-firebase/storage",
      );
      break;
    case "supabase":
      out.push("@tanstack/react-query", "@supabase/supabase-js");
      break;
    case "custom-backend":
      out.push("@tanstack/react-query", "axios");
      break;
  }

  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/install.test.ts 2>&1 | tail -10
```

Expected: All install tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/install.ts tests/install.test.ts
git commit -m "feat: branch package installation by backendType"
```

---

## Task 4: File-skip logic + new overlay functions in `src/overlay.ts`

**Files:**
- Modify: `src/overlay.ts`
- Modify: `tests/overlay.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/overlay.test.ts` (after existing imports):

```typescript
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { BackendType } from "../src/prompts.js";
import { isSkippedForBackend, applyBase } from "../src/overlay.js";
```

Add tests:

```typescript
describe("isSkippedForBackend", () => {
  it("firebase-js skips core/tanstack dir", () => {
    expect(isSkippedForBackend("/app/src/core/tanstack/index.tsx", "firebase-js")).toBe(true);
  });
  it("firebase-rn skips core/tanstack dir", () => {
    expect(isSkippedForBackend("/app/src/core/tanstack/index.tsx", "firebase-rn")).toBe(true);
  });
  it("supabase keeps core/tanstack dir", () => {
    expect(isSkippedForBackend("/app/src/core/tanstack/index.tsx", "supabase")).toBe(false);
  });
  it("custom-backend keeps core/tanstack dir", () => {
    expect(isSkippedForBackend("/app/src/core/tanstack/index.tsx", "custom-backend")).toBe(false);
  });

  it("firebase-js skips core/utils/config.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/config.ts", "firebase-js")).toBe(true);
  });
  it("firebase-rn skips core/utils/config.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/config.ts", "firebase-rn")).toBe(true);
  });
  it("supabase skips core/utils/config.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/config.ts", "supabase")).toBe(true);
  });
  it("custom-backend keeps core/utils/config.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/config.ts", "custom-backend")).toBe(false);
  });

  it("firebase-js skips core/utils/endpoints.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/endpoints.ts", "firebase-js")).toBe(true);
  });
  it("firebase-rn skips core/utils/endpoints.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/endpoints.ts", "firebase-rn")).toBe(true);
  });
  it("supabase skips core/utils/endpoints.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/endpoints.ts", "supabase")).toBe(true);
  });
  it("custom-backend keeps core/utils/endpoints.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/endpoints.ts", "custom-backend")).toBe(false);
  });

  it("keeps non-backend files for any backend", () => {
    expect(isSkippedForBackend("/app/src/core/redux/store.ts", "firebase-js")).toBe(false);
    expect(isSkippedForBackend("/app/src/ui/components/Button.tsx", "firebase-rn")).toBe(false);
  });

  it("handles Windows backslash paths", () => {
    expect(isSkippedForBackend("C:\\app\\src\\core\\tanstack\\index.tsx", "firebase-js")).toBe(true);
  });
});

describe("applyBase — file-skip integration", () => {
  let target: string;
  let tplRoot: string;

  beforeEach(() => {
    target = fs.mkdtempSync(path.join(os.tmpdir(), "applyBase-out-"));
    tplRoot = fs.mkdtempSync(path.join(os.tmpdir(), "applyBase-tpl-"));
    // seed minimal base template
    fs.mkdirSync(path.join(tplRoot, "base/src/core/tanstack"), { recursive: true });
    fs.writeFileSync(path.join(tplRoot, "base/src/core/tanstack/index.ts"), "export {};");
    fs.mkdirSync(path.join(tplRoot, "base/src/core/redux"), { recursive: true });
    fs.writeFileSync(path.join(tplRoot, "base/src/core/redux/store.ts"), "export {};");
  });

  afterEach(() => {
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(tplRoot, { recursive: true, force: true });
  });

  it("firebase-js: skips core/tanstack, copies core/redux", () => {
    applyBase(target, tplRoot, "firebase-js");
    expect(fs.existsSync(path.join(target, "src/core/tanstack"))).toBe(false);
    expect(fs.existsSync(path.join(target, "src/core/redux/store.ts"))).toBe(true);
  });

  it("custom-backend: copies core/tanstack", () => {
    applyBase(target, tplRoot, "custom-backend");
    expect(fs.existsSync(path.join(target, "src/core/tanstack/index.ts"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/overlay.test.ts 2>&1 | grep -E "FAIL|isSkipped" | head -10
```

Expected: `isSkippedForBackend` import fails (not exported yet).

- [ ] **Step 3: Update `src/overlay.ts`**

Add import at top:

```typescript
import type { BackendType } from "./prompts.js";
```

Add `isSkippedForBackend` function before `copyTemplate`:

```typescript
export function isSkippedForBackend(src: string, backendType: BackendType): boolean {
  const normalized = src.replace(/\\/g, "/");
  if (backendType === "firebase-js" || backendType === "firebase-rn") {
    if (normalized.includes("/core/tanstack/")) return true;
    if (normalized.includes("/core/utils/config.ts")) return true;
    if (normalized.includes("/core/utils/endpoints.ts")) return true;
  }
  if (backendType === "supabase") {
    if (normalized.includes("/core/utils/config.ts")) return true;
    if (normalized.includes("/core/utils/endpoints.ts")) return true;
  }
  return false;
}
```

Update `applyBase` signature and body:

```typescript
export function applyBase(target: string, templatesRoot: string, backendType: BackendType): void {
  const baseDir = path.join(templatesRoot, "base");
  if (!fs.existsSync(baseDir)) {
    throw new Error(`copyTemplate: source missing: ${baseDir}`);
  }
  fse.copySync(baseDir, target, {
    overwrite: true,
    filter: (src) => !isSkippedForBackend(src, backendType),
  });
}
```

Add three new overlay functions after `applyImagePicker`:

```typescript
export function applyFirebaseJs(target: string, templatesRoot: string): void {
  const dir = path.join(templatesRoot, "firebase-js");
  if (!fs.existsSync(dir)) return;
  copyTemplate(dir, target);
}

export function applyFirebaseRn(target: string, templatesRoot: string): void {
  const dir = path.join(templatesRoot, "firebase-rn");
  if (!fs.existsSync(dir)) return;
  copyTemplate(dir, target);
}

export function applySupabase(target: string, templatesRoot: string): void {
  const dir = path.join(templatesRoot, "supabase");
  if (!fs.existsSync(dir)) return;
  copyTemplate(dir, target);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/overlay.test.ts 2>&1 | tail -10
```

Expected: All overlay tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/overlay.ts tests/overlay.test.ts
git commit -m "feat: add isSkippedForBackend + backend overlay functions"
```

---

## Task 5: TanStack sentinel generation in `src/fonts.ts`

**Files:**
- Modify: `src/fonts.ts`
- Modify: `tests/fonts.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/fonts.test.ts` (after existing imports):

```typescript
import { generateTanStackProviderBlocks } from "../src/fonts.js";
```

Add test block after `describe("generateBottomSheetProviderBlocks")`:

```typescript
describe("generateTanStackProviderBlocks", () => {
  it("firebase-js → all empty (TanStack not used)", () => {
    expect(generateTanStackProviderBlocks("firebase-js")).toEqual({
      importBlock: "",
      openBlock: "",
      closeBlock: "",
    });
  });

  it("firebase-rn → all empty (TanStack not used)", () => {
    expect(generateTanStackProviderBlocks("firebase-rn")).toEqual({
      importBlock: "",
      openBlock: "",
      closeBlock: "",
    });
  });

  it("supabase → import + open + close", () => {
    const r = generateTanStackProviderBlocks("supabase");
    expect(r.importBlock).toContain("TanStackQueryProvider");
    expect(r.openBlock).toContain("<TanStackQueryProvider>");
    expect(r.closeBlock).toContain("</TanStackQueryProvider>");
  });

  it("custom-backend → import + open + close", () => {
    const r = generateTanStackProviderBlocks("custom-backend");
    expect(r.importBlock).toContain("TanStackQueryProvider");
    expect(r.openBlock).toContain("<TanStackQueryProvider>");
    expect(r.closeBlock).toContain("</TanStackQueryProvider>");
  });
});
```

Add a test for `buildLayoutReplacements` returning TanStack keys — add inside the existing `describe("patchLayout end-to-end")` (or as a separate top-level describe):

```typescript
describe("buildLayoutReplacements — TanStack sentinel keys present", () => {
  it("custom-backend → map contains TANSTACK_PROVIDER_* keys with content", () => {
    const map = buildLayoutReplacements(
      { ...A, backendType: "custom-backend" },
      null,
      null,
      false,
    );
    expect(map).toHaveProperty("TANSTACK_PROVIDER_IMPORT");
    expect(map).toHaveProperty("TANSTACK_PROVIDER_OPEN");
    expect(map).toHaveProperty("TANSTACK_PROVIDER_CLOSE");
    expect(map.TANSTACK_PROVIDER_IMPORT).toContain("TanStackQueryProvider");
  });

  it("firebase-js → map contains TANSTACK_PROVIDER_* keys as empty strings", () => {
    const map = buildLayoutReplacements(
      { ...A, backendType: "firebase-js" },
      null,
      null,
      false,
    );
    expect(map.TANSTACK_PROVIDER_IMPORT).toBe("");
    expect(map.TANSTACK_PROVIDER_OPEN).toBe("");
    expect(map.TANSTACK_PROVIDER_CLOSE).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/fonts.test.ts 2>&1 | grep -E "FAIL|generateTanStack" | head -10
```

Expected: `generateTanStackProviderBlocks` not exported.

- [ ] **Step 3: Update `src/fonts.ts`**

Add import at the top:

```typescript
import type { BackendType } from "./prompts.js";
```

Add `generateTanStackProviderBlocks` function after `generateBottomSheetProviderBlocks`:

```typescript
export function generateTanStackProviderBlocks(backendType: BackendType): {
  importBlock: string;
  openBlock: string;
  closeBlock: string;
} {
  if (backendType === "firebase-js" || backendType === "firebase-rn") {
    return { importBlock: "", openBlock: "", closeBlock: "" };
  }
  return {
    importBlock: `import { TanStackQueryProvider } from "@core/tanstack";`,
    openBlock: `        <TanStackQueryProvider>`,
    closeBlock: `        </TanStackQueryProvider>`,
  };
}
```

Update `buildLayoutReplacements` to include TanStack keys (add `const ts = ...` and three new keys to the return object):

```typescript
export function buildLayoutReplacements(
  answers: Answers,
  primary: InstalledFamily | null,
  secondary: InstalledFamily | null,
  hasSplashScreen: boolean,
): Record<string, string> {
  const fonts = generateUseFontsBlocks(primary, secondary, hasSplashScreen);
  const bs = generateBottomSheetProviderBlocks(answers.bottomSheet);
  const ts = generateTanStackProviderBlocks(answers.backendType);
  return {
    USE_FONTS_IMPORT: fonts.importBlock,
    USE_FONTS_HOOK: fonts.hookBlock,
    USE_FONTS_GUARD: fonts.guardBlock,
    BOTTOM_SHEET_PROVIDER_IMPORT: bs.importBlock,
    BOTTOM_SHEET_PROVIDER_OPEN: bs.openBlock,
    BOTTOM_SHEET_PROVIDER_CLOSE: bs.closeBlock,
    TANSTACK_PROVIDER_IMPORT: ts.importBlock,
    TANSTACK_PROVIDER_OPEN: ts.openBlock,
    TANSTACK_PROVIDER_CLOSE: ts.closeBlock,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/fonts.test.ts 2>&1 | tail -10
```

Expected: All fonts tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/fonts.ts tests/fonts.test.ts
git commit -m "feat: add TanStack sentinel generation to buildLayoutReplacements"
```

---

## Task 6: `patchUserSliceForFirebase` + firebase-rn app.json plugin

**Files:**
- Modify: `src/patch.ts`
- Modify: `tests/patch.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/patch.test.ts` imports:

```typescript
import {
  // ... existing imports ...
  patchUserSliceForFirebase,
} from "../src/patch.js";
```

Add test blocks after the existing `patchAppJsonPlugins` describe:

```typescript
describe("patchAppJsonPlugins — firebase-rn", () => {
  it("firebase-rn → adds @react-native-firebase/app plugin", () => {
    seedAppJson([]);
    patchAppJsonPlugins(tmp, { ...baseAnswers, backendType: "firebase-rn" });
    const j = readAppJson();
    expect(j.expo.plugins).toContain("@react-native-firebase/app");
  });

  it("supabase (not firebase-rn, not imagePicker) → no-op", () => {
    seedAppJson([]);
    patchAppJsonPlugins(tmp, { ...baseAnswers, backendType: "supabase" });
    expect(readAppJson().expo.plugins).toEqual([]);
  });

  it("firebase-rn idempotent — second pass adds no duplicate", () => {
    seedAppJson([]);
    patchAppJsonPlugins(tmp, { ...baseAnswers, backendType: "firebase-rn" });
    patchAppJsonPlugins(tmp, { ...baseAnswers, backendType: "firebase-rn" });
    const j = readAppJson();
    expect(
      j.expo.plugins.filter((e: unknown) => e === "@react-native-firebase/app").length,
    ).toBe(1);
  });
});

describe("patchUserSliceForFirebase", () => {
  function seedUserSlice(): void {
    const sliceDir = path.join(tmp, "src/core/redux/slices");
    fs.mkdirSync(sliceDir, { recursive: true });
    fs.writeFileSync(
      path.join(sliceDir, "userSlice.ts"),
      [
        `// Minimal user shape per SPEC §6 ("dummy user shape").`,
        `// \`accessToken\` is required by the axios interceptor in \`core/utils/config.ts\``,
        `// — every request reads \`store.getState().user?.accessToken\` and attaches as`,
        `// \`Bearer <token>\` if present. Apps replace shape but must keep the field.`,
        `import { createSlice, PayloadAction } from "@reduxjs/toolkit";`,
        ``,
        `export type User = {`,
        `  id: string | null;`,
        `  name: string | null;`,
        `  accessToken: string | null;`,
        `};`,
        ``,
        `const initialState: User = { id: null, name: null, accessToken: null };`,
        ``,
        `const userSlice = createSlice({`,
        `  name: "user",`,
        `  initialState,`,
        `  reducers: {`,
        `    setUser: (state, action: PayloadAction<User>) => {`,
        `      state.id = action.payload.id;`,
        `      state.name = action.payload.name;`,
        `      state.accessToken = action.payload.accessToken;`,
        `    },`,
        `    updateUser: (state, action: PayloadAction<Partial<User>>) => {`,
        `      Object.assign(state, action.payload);`,
        `    },`,
        `    setAccessToken: (state, action: PayloadAction<string | null>) => {`,
        `      state.accessToken = action.payload;`,
        `    },`,
        `    clearUser: (state) => {`,
        `      state.id = null;`,
        `      state.name = null;`,
        `      state.accessToken = null;`,
        `    },`,
        `  },`,
        `});`,
        ``,
        `export const { setUser, updateUser, setAccessToken, clearUser } = userSlice.actions;`,
        `export default userSlice.reducer;`,
        ``,
      ].join("\n"),
    );
  }

  it("removes accessToken from User type", () => {
    seedUserSlice();
    patchUserSliceForFirebase(tmp);
    const src = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    expect(src).not.toContain("accessToken: string | null");
  });

  it("removes accessToken from initialState", () => {
    seedUserSlice();
    patchUserSliceForFirebase(tmp);
    const src = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    expect(src).not.toContain("accessToken: null");
  });

  it("removes setAccessToken reducer", () => {
    seedUserSlice();
    patchUserSliceForFirebase(tmp);
    const src = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    expect(src).not.toContain("setAccessToken");
  });

  it("removes accessToken from setUser + clearUser reducers", () => {
    seedUserSlice();
    patchUserSliceForFirebase(tmp);
    const src = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    expect(src).not.toContain("state.accessToken");
  });

  it("preserves setUser, updateUser, clearUser", () => {
    seedUserSlice();
    patchUserSliceForFirebase(tmp);
    const src = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    expect(src).toContain("setUser");
    expect(src).toContain("updateUser");
    expect(src).toContain("clearUser");
  });

  it("idempotent — running twice yields same result", () => {
    seedUserSlice();
    patchUserSliceForFirebase(tmp);
    const after1 = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    patchUserSliceForFirebase(tmp);
    const after2 = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    expect(after1).toBe(after2);
  });

  it("no-op when file is missing", () => {
    // No seedUserSlice() call — file doesn't exist
    expect(() => patchUserSliceForFirebase(tmp)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/patch.test.ts 2>&1 | grep -E "patchUserSlice|firebase-rn" | head -10
```

Expected: `patchUserSliceForFirebase` not exported; firebase-rn plugin test fails.

- [ ] **Step 2b: Verify template `userSlice.ts` matches patch strings**

> ⚠️ `patchUserSliceForFirebase` uses exact string replacement — mismatches silently no-op. The tests pass because they seed their own copy of the file. The real template must match independently.

```bash
cat templates/base/src/core/redux/slices/userSlice.ts
```

Confirm each of these exact substrings is present before proceeding with Step 3:
- `// Minimal user shape per SPEC §6 ("dummy user shape").` (first line of header comment)
- `  accessToken: string | null;`
- `, accessToken: null`
- `      state.accessToken = action.payload.accessToken;`
- `    setAccessToken: (state, action: PayloadAction<string | null>) => {`
- `      state.accessToken = null;`
- `, setAccessToken`

If any are absent or differ, update the replacement strings in Step 3 to match the actual template content.

- [ ] **Step 3: Update `patchAppJsonPlugins` in `src/patch.ts`**

Replace the existing `patchAppJsonPlugins` function (lines 167–188):

```typescript
export function patchAppJsonPlugins(target: string, answers: Answers): void {
  const needsImagePicker = answers.imagePicker;
  const needsFirebaseRn = answers.backendType === "firebase-rn";
  if (!needsImagePicker && !needsFirebaseRn) return;

  const p = path.join(target, "app.json");
  const json = readJson<ExpoAppJson>(p);
  json.expo ??= {};
  json.expo.plugins ??= [];

  if (needsImagePicker) {
    const entry: [string, Record<string, unknown>] = [
      "expo-image-picker",
      {
        photosPermission:
          "The app accesses your photos to let you share them with your friends.",
        cameraPermission:
          "The app accesses your camera to let you take photos to share.",
      },
    ];
    if (!json.expo.plugins.some((e) => nameOf(e) === nameOf(entry))) {
      json.expo.plugins.push(entry);
    }
  }

  if (needsFirebaseRn) {
    const firebasePlugin = "@react-native-firebase/app";
    if (!json.expo.plugins.some((e) => nameOf(e) === firebasePlugin)) {
      json.expo.plugins.push(firebasePlugin);
    }
  }

  writeJson(p, json);
}
```

- [ ] **Step 4: Add `patchUserSliceForFirebase` to `src/patch.ts`**

Add after `patchReadme` function (before the babel comment at the bottom):

```typescript
export function patchUserSliceForFirebase(target: string): void {
  const p = path.join(target, "src/core/redux/slices/userSlice.ts");
  if (!fileExists(p)) return;
  let src = fs.readFileSync(p, "utf8");

  // Remove the 4-line header comment that references accessToken + axios
  src = src.replace(
    "// Minimal user shape per SPEC §6 (\"dummy user shape\").\n" +
    "// `accessToken` is required by the axios interceptor in `core/utils/config.ts`\n" +
    "// — every request reads `store.getState().user?.accessToken` and attaches as\n" +
    "// `Bearer <token>` if present. Apps replace shape but must keep the field.\n",
    "",
  );
  // Remove accessToken field from User type
  src = src.replace("\n  accessToken: string | null;", "");
  // Remove accessToken from initialState object (last field — comma precedes it)
  src = src.replace(", accessToken: null", "");
  // Remove setUser line that sets accessToken
  src = src.replace("\n      state.accessToken = action.payload.accessToken;", "");
  // Remove entire setAccessToken reducer block
  src = src.replace(
    "\n    setAccessToken: (state, action: PayloadAction<string | null>) => {\n" +
    "      state.accessToken = action.payload;\n" +
    "    },",
    "",
  );
  // Remove accessToken from clearUser reducer
  src = src.replace("\n      state.accessToken = null;", "");
  // Remove setAccessToken from named exports
  src = src.replace(", setAccessToken", "");

  fs.writeFileSync(p, src);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- tests/patch.test.ts 2>&1 | tail -10
```

Expected: All patch tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/patch.ts tests/patch.test.ts
git commit -m "feat: add patchUserSliceForFirebase + firebase-rn plugin to patchAppJsonPlugins"
```

---

## Task 7: Add TanStack sentinels to `_layout.tsx` + create template files

**Files:**
- Modify: `templates/base/src/app/_layout.tsx`
- Create: `templates/firebase-js/src/core/firebase/index.ts`
- Create: `templates/firebase-rn/src/core/firebase/index.ts`
- Create: `templates/supabase/src/core/supabase/index.ts`

> No unit tests for template file content — correctness is verified by the end-to-end pipeline.

- [ ] **Step 0: Verify `@core/*` wildcard exists in base tsconfig**

Firebase overlay places files at `src/core/firebase/index.ts`. The import `@core/firebase` must resolve via a wildcard path alias — if only named per-directory aliases exist, a tsconfig patch is needed and is currently missing from the plan.

```bash
grep -E '"@core' templates/base/tsconfig.json
```

Expected output contains `"@core/*"` → `["src/core/*"]`. If not, add a tsconfig patch step before continuing.

- [ ] **Step 1: Update `templates/base/src/app/_layout.tsx`**

Replace the file with (three changes: remove hardcoded TanStack import, add sentinel import, replace open/close JSX tags):

```tsx
// Provider tree per PLAN_V5.md Phase 4 step 2. Sentinels are filled by Phase 6
// `patchLayout` based on the user's `useFonts` / `bottomSheet` / `backendType` answers.
import { ErrorBoundary } from "react-error-boundary";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { persistor, store } from "@redux/store";
import ErrorFallback from "@components/errorFallback";
import Routes from "./routes";
// @@TANSTACK_PROVIDER_IMPORT@@
// @@USE_FONTS_IMPORT@@
// @@BOTTOM_SHEET_PROVIDER_IMPORT@@

export default function RootLayout() {
  // @@USE_FONTS_HOOK@@
  // @@USE_FONTS_GUARD@@

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {/* @@TANSTACK_PROVIDER_OPEN@@ */}
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
              <KeyboardProvider>
                {/* @@BOTTOM_SHEET_PROVIDER_OPEN@@ */}
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <Routes />
                </ErrorBoundary>
                {/* @@BOTTOM_SHEET_PROVIDER_CLOSE@@ */}
              </KeyboardProvider>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        {/* @@TANSTACK_PROVIDER_CLOSE@@ */}
      </PersistGate>
    </Provider>
  );
}
```

- [ ] **Step 2: Create `templates/firebase-js/src/core/firebase/index.ts`**

```bash
mkdir -p /Users/MAC/Desktop/Expo/customPackage/react-native-expo-boilerplate/templates/firebase-js/src/core/firebase
```

File content:

```typescript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

- [ ] **Step 3: Create `templates/firebase-rn/src/core/firebase/index.ts`**

```bash
mkdir -p /Users/MAC/Desktop/Expo/customPackage/react-native-expo-boilerplate/templates/firebase-rn/src/core/firebase
```

File content:

```typescript
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

export { auth, firestore, storage };
```

- [ ] **Step 4: Create `templates/supabase/src/core/supabase/index.ts`**

```bash
mkdir -p /Users/MAC/Desktop/Expo/customPackage/react-native-expo-boilerplate/templates/supabase/src/core/supabase
```

File content:

```typescript
import { createClient } from "@supabase/supabase-js";
import { MMKV } from "react-native-mmkv";

const storage = new MMKV({ id: "supabase-auth" });

const mmkvStorageAdapter = {
  setItem: (key: string, value: string) => storage.set(key, value),
  getItem: (key: string) => storage.getString(key) ?? null,
  removeItem: (key: string) => storage.delete(key),
};

const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: mmkvStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test 2>&1 | tail -15
```

Expected: All tests pass (template changes are not covered by unit tests, but sentinel changes in `buildLayoutReplacements` are — those passed in Task 5).

- [ ] **Step 5b: Verify no `@core/tanstack` cross-imports in base templates**

If any non-tanstack base file imports from `@core/tanstack`, firebase scaffolds will fail TypeScript compilation because `core/tanstack/` is skipped and absent in the output.

```bash
grep -r "@core/tanstack" templates/base/src --include="*.ts" --include="*.tsx" | grep -v "core/tanstack/"
```

Expected: no output. Any hits must be resolved before shipping.

- [ ] **Step 6: Commit**

```bash
git add templates/base/src/app/_layout.tsx templates/firebase-js/ templates/firebase-rn/ templates/supabase/
git commit -m "feat: add TanStack sentinels to _layout.tsx + backend template files"
```

---

## Task 8: Wire `backendType` through `src/index.ts`

**Files:**
- Modify: `src/index.ts`

> No new unit tests — `index.ts` is integration glue. The unit tests in Tasks 1–6 cover individual pieces. Running the full suite at the end is the verification.

- [ ] **Step 1: Update imports in `src/index.ts`**

Replace the existing overlay import line (line 25):

```typescript
import { applyBase, applyBottomSheet, applyImagePicker, applyFirebaseJs, applyFirebaseRn, applySupabase } from "./overlay.js";
```

Replace the existing patch import block (lines 27–37) — add `patchUserSliceForFirebase`:

```typescript
import {
  patchAppJson,
  patchAppJsonAssetPaths,
  patchAppJsonBuildProperties,
  patchAppJsonPlugins,
  patchConstants,
  patchExpoRouterEntry,
  patchLayout,
  patchPackageJsonScripts,
  patchReadme,
  patchTsconfig,
  patchUserSliceForFirebase,
} from "./patch.js";
```

- [ ] **Step 2: Update the answers log line and `applyBase` call**

Find the log line (around line 143–146) and update:

```typescript
log.info(
  `Answers: primaryFont="${answers.primaryFont}" secondaryFont="${answers.secondaryFont}" ` +
    `bottomSheet=${answers.bottomSheet} imagePicker=${answers.imagePicker} ` +
    `pm=${answers.packageManager} backendType=${answers.backendType}`,
);
```

Change the `applyBase` call (around line 150):

```typescript
applyBase(target.dir, templatesRoot, answers.backendType);
```

- [ ] **Step 3: Add backend-specific overlay calls after `applyImagePicker`**

After the existing `if (answers.imagePicker)` block (around line 169–172), add:

```typescript
switch (answers.backendType) {
  case "firebase-js":
    log.step("Overlaying templates/firebase-js/ …");
    applyFirebaseJs(target.dir, templatesRoot);
    break;
  case "firebase-rn":
    log.step("Overlaying templates/firebase-rn/ …");
    applyFirebaseRn(target.dir, templatesRoot);
    log.warn(
      "React Native Firebase requires a dev client — Expo Go not supported. " +
        "Run `npm run android` or `npm run ios` to build the dev client first.",
    );
    break;
  case "supabase":
    log.step("Overlaying templates/supabase/ …");
    applySupabase(target.dir, templatesRoot);
    break;
  // custom-backend: no overlay needed
}
```

- [ ] **Step 4: Add `patchUserSliceForFirebase` call in the patches section**

After the `patchAppJsonBuildProperties` call (around line 227), add:

```typescript
if (answers.backendType === "firebase-js" || answers.backendType === "firebase-rn") {
  log.step("Patching userSlice for Firebase (removing accessToken field) …");
  patchUserSliceForFirebase(target.dir);
}
```

- [ ] **Step 5: Build to verify TypeScript compilation**

```bash
npm run build 2>&1 | tail -20
```

Expected: Compilation succeeds with no errors.

- [ ] **Step 6: Run full test suite**

```bash
npm test 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire backendType through scaffold pipeline in index.ts"
```

---

## Task 9: Update README

**Files:**
- Modify: `README.md`

> No unit tests — README is documentation only.

- [ ] **Step 1: Add `backendType` prompt docs to the CLI usage section**

In `README.md`, find the section documenting interactive prompts (or CLI env vars). Add:

- **Prompt:** `What backend type?` — choices: `firebase` (then sub-prompt for JS SDK vs RN), `supabase`, `custom-backend`.
- **Env var:** `EXPO_BACKEND_TYPE` — valid values: `firebase-js`, `firebase-rn`, `supabase`, `custom-backend`. Default: `custom-backend`.
- **Firebase sub-prompt:** `Firebase SDK:` — `Firebase JS SDK (Expo Go compatible)` → `firebase-js`; `React Native Firebase (requires dev client)` → `firebase-rn`.
- **firebase-rn note:** Requires a dev client build — Expo Go not supported.

- [ ] **Step 2: Run full test suite to confirm no regressions**

```bash
npm test 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document backendType prompt + EXPO_BACKEND_TYPE env var"
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Covered by |
|---|---|
| `firebase / supabase / custom-backend` prompt | Task 2 |
| Firebase sub-prompt (js/rn) | Task 2 |
| `backendType: "firebase-js" \| "firebase-rn" \| "supabase" \| "custom-backend"` on `Answers` | Task 1 |
| `EXPO_BACKEND_TYPE` env var + validation | Tasks 1–2 |
| Default to `custom-backend` in non-TTY when unset | Task 2 |
| `fse.copySync` filter in `applyBase()` | Task 4 |
| Skip `core/tanstack/` for firebase-js/rn | Task 4 |
| Skip `core/utils/config.ts` for firebase-js/rn/supabase | Task 4 |
| Skip `core/utils/endpoints.ts` for firebase-js/rn/supabase | Task 4 |
| `applyFirebaseJs()`, `applyFirebaseRn()`, `applySupabase()` | Task 4 |
| `firebase-js` packages: `firebase` | Task 3 |
| `firebase-rn` packages: 4 `@react-native-firebase/*` | Task 3 |
| `supabase` packages: `@tanstack/react-query` + `@supabase/supabase-js` | Task 3 |
| `custom-backend` packages: `@tanstack/react-query` + `axios` | Task 3 |
| TanStack sentinels in `_layout.tsx` | Tasks 5 + 7 |
| `buildLayoutReplacements` TanStack sentinel values | Task 5 |
| Firebase backends: TanStack sentinels → empty (lines dropped) | Tasks 5 + 7 |
| Supabase/custom-backend: TanStack sentinels → real import/JSX | Tasks 5 + 7 |
| `patchUserSliceForFirebase` removes `accessToken` | Task 6 |
| `patchAppJsonPlugins` adds `@react-native-firebase/app` for firebase-rn | Task 6 |
| firebase-rn post-scaffold warning | Task 8 |
| Template files: `firebase-js/`, `firebase-rn/`, `supabase/` | Task 7 |
| Supabase client uses MMKV adapter (not expo-sqlite) | Task 7 |
| Prompt order: firebase first | Task 2 |
| README: document `backendType` prompt + `EXPO_BACKEND_TYPE` | Task 9 |
| `applyBase` filter integration verified by test | Task 4 |
| `applySentinels` drops lines with empty replacement (no blank lines) | existing behavior, verified in overlay tests |
| `@core/firebase` alias resolves via existing `@core/*` wildcard | spec edge-case, verify in tsconfig before impl |
| No base files import `@core/tanstack` outside `core/tanstack/` | spec edge-case, grep check before shipping |

### Type Consistency

- `BackendType` defined once in `src/prompts.ts`, imported by `src/overlay.ts`, `src/fonts.ts`, `src/patch.ts`
- `applyBase(target, templatesRoot, backendType: BackendType)` — signature updated in Task 4, call-site updated in Task 8
- `buildLayoutReplacements(answers, primary, secondary, hasSplashScreen)` — signature unchanged (gets `backendType` via `answers.backendType`) _(intentional deviation: spec File-Map says "Add `backendType` param to `buildLayoutReplacements()`" — keeping it via `answers.backendType` is cleaner and avoids a call-site change)_
- `patchAppJsonPlugins(target, answers)` — signature unchanged (gets `backendType` via `answers.backendType`)
- All test `Answers` fixtures updated in Task 1 before any function changes break compilation
