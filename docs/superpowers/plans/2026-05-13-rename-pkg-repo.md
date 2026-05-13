# Package & Repository Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the npm package, CLI bin, and GitHub repository from `codingpixel-expo-app`/`codingpixel-expo` to `react-native-expo-boilerplate`, and update every string reference across source, tests, templates, and docs.

**Architecture:** File-by-file edits grouped into logical commits. No logic changes — only string substitutions and one JSDoc comment fix. Historical docs get the same treatment as active files. GitHub repo rename is a single `gh api` call at the end.

**Tech Stack:** Node.js/TypeScript CLI, Vitest tests, GitHub CLI (`gh`)

---

## Rename Map (reference for all tasks)

| Old | New |
|-----|-----|
| `codingpixel-expo-app` | `react-native-expo-boilerplate` |
| `codingpixel-expo` | `react-native-expo-boilerplate` |
| `@codingpixel/create-expo-app` | `react-native-expo-boilerplate` |
| `codingpixel-create-expo-app` | `react-native-expo-boilerplate` |
| `Mubasher-dv/codingpixel-expo-app` | `Mubasher-dv/react-native-expo-boilerplate` |

---

## Task 1: Update `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Edit `package.json` — name field**

Change line 2:
```json
"name": "codingpixel-expo-app",
```
To:
```json
"name": "react-native-expo-boilerplate",
```

- [ ] **Step 2: Edit `package.json` — bin key**

Change:
```json
"bin": {
  "codingpixel-expo": "bin/cli.js"
},
```
To:
```json
"bin": {
  "react-native-expo-boilerplate": "bin/cli.js"
},
```

- [ ] **Step 3: Edit `package.json` — repository URL**

Change:
```json
"url": "git+https://github.com/Mubasher-dv/codingpixel-expo-app.git"
```
To:
```json
"url": "git+https://github.com/Mubasher-dv/react-native-expo-boilerplate.git"
```

- [ ] **Step 4: Edit `package.json` — homepage**

Change:
```json
"homepage": "https://github.com/Mubasher-dv/codingpixel-expo-app#readme",
```
To:
```json
"homepage": "https://github.com/Mubasher-dv/react-native-expo-boilerplate#readme",
```

- [ ] **Step 5: Edit `package.json` — bugs URL**

Change:
```json
"url": "https://github.com/Mubasher-dv/codingpixel-expo-app/issues"
```
To:
```json
"url": "https://github.com/Mubasher-dv/react-native-expo-boilerplate/issues"
```

- [ ] **Step 6: Verify no old name remains in package.json**

```bash
grep "codingpixel" package.json
```
Expected: no output.

---

## Task 2: Update `src/patch.ts` JSDoc

**Files:**
- Modify: `src/patch.ts` (line 38 comment only — the function logic is already correct)

- [ ] **Step 1: Fix stale JSDoc example on line 38**

Change (in the JSDoc block above `bundleIdSegment`):
```typescript
 * `my-test-app` → `mytestapp` → final ID `com.codingpixel.mytestapp`.
```
To:
```typescript
 * `my-test-app` → `mytestapp` → final ID `com.mytestapp`.
```

- [ ] **Step 2: Verify the function itself is untouched**

```bash
grep -A3 "export function bundleIdFor" src/patch.ts
```
Expected output:
```
export function bundleIdFor(name: string): string {
  return `com.${bundleIdSegment(name)}`;
}
```

---

## Task 3: Update `src/add.ts`

**Files:**
- Modify: `src/add.ts` (lines 15–18 comments, line 1223 error string)

- [ ] **Step 1: Fix comment block at lines 15–18**

Change:
```typescript
//   codingpixel-expo-app add bottom-sheet
//   codingpixel-expo-app add image-picker
//   codingpixel-expo-app add app-icon
//   codingpixel-expo-app add splash
```
To:
```typescript
//   react-native-expo-boilerplate add bottom-sheet
//   react-native-expo-boilerplate add image-picker
//   react-native-expo-boilerplate add app-icon
//   react-native-expo-boilerplate add splash
```

- [ ] **Step 2: Fix error string at line 1223**

Change:
```typescript
`Missing recipe. Usage: codingpixel-expo-app add <${KNOWN_RECIPES.join("|")}>`
```
To:
```typescript
`Missing recipe. Usage: react-native-expo-boilerplate add <${KNOWN_RECIPES.join("|")}>`
```

- [ ] **Step 3: Verify no old name remains**

```bash
grep "codingpixel" src/add.ts
```
Expected: no output.

---

## Task 4: Update `src/bootstrap.ts`

**Files:**
- Modify: `src/bootstrap.ts` (line 29)

- [ ] **Step 1: Fix usage string**

Change:
```typescript
'No app name provided and stdin is not a TTY. Pass a directory: `codingpixel-expo my-app`.'
```
To:
```typescript
'No app name provided and stdin is not a TTY. Pass a directory: `react-native-expo-boilerplate my-app`.'
```

- [ ] **Step 2: Verify**

```bash
grep "codingpixel" src/bootstrap.ts
```
Expected: no output.

---

## Task 5: Run tests and commit source changes

- [ ] **Step 1: Run the test suite**

```bash
npm test
```
Expected: all tests pass. If any fail, fix before continuing.

- [ ] **Step 2: Commit source changes**

```bash
git add package.json src/patch.ts src/add.ts src/bootstrap.ts
git commit -m "rename: codingpixel-expo-app → react-native-expo-boilerplate (source + config)"
```

---

## Task 6: Update `tests/patch.test.ts`

**Files:**
- Modify: `tests/patch.test.ts` (lines 63 and 304)

- [ ] **Step 1: Fix test description at line 63**

Change:
```typescript
it("composes com.<safeName> (no codingpixel namespace)", () => {
```
To:
```typescript
it("composes com.<safeName> (no org namespace)", () => {
```

- [ ] **Step 2: Fix stale comment at line 304**

Change:
```typescript
// an older codingpixel-expo-app version (or by upstream create-expo-app).
```
To:
```typescript
// an older react-native-expo-boilerplate version (or by upstream create-expo-app).
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/patch.test.ts
git commit -m "rename: update test description + comment"
```

---

## Task 7: Update `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace all occurrences**

```bash
sed -i '' \
  -e 's|codingpixel-expo-app|react-native-expo-boilerplate|g' \
  -e 's|codingpixel-expo|react-native-expo-boilerplate|g' \
  README.md
```

- [ ] **Step 2: Verify**

```bash
grep "codingpixel" README.md
```
Expected: no output.

- [ ] **Step 3: Spot-check the heading and key sections look correct**

```bash
head -20 README.md
```
Expected: heading reads `# react-native-expo-boilerplate`, npx command reads `npx react-native-expo-boilerplate my-app`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "rename: update README.md CLI references"
```

---

## Task 8: Update `templates/base/README.md`

**Files:**
- Modify: `templates/base/README.md`

- [ ] **Step 1: Replace all occurrences**

```bash
sed -i '' \
  -e 's|codingpixel-expo-app|react-native-expo-boilerplate|g' \
  -e 's|Mubasher-dv/codingpixel-expo-app|Mubasher-dv/react-native-expo-boilerplate|g' \
  templates/base/README.md
```

- [ ] **Step 2: Verify**

```bash
grep "codingpixel" templates/base/README.md
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add templates/base/README.md
git commit -m "rename: update templates/base/README.md"
```

---

## Task 9: Update `templates/claude-command/*.md`

**Files:**
- Modify: `templates/claude-command/add-bottom-sheet.md`
- Modify: `templates/claude-command/add-bottom-tab.md`
- Modify: `templates/claude-command/add-feature.md`
- Modify: `templates/claude-command/add-image-picker.md`
- Modify: `templates/claude-command/add-role.md`
- Modify: `templates/claude-command/add-screen.md`
- Modify: `templates/claude-command/init-app.md`

- [ ] **Step 1: Replace all occurrences across all claude-command templates**

```bash
sed -i '' 's|codingpixel-expo-app|react-native-expo-boilerplate|g' \
  templates/claude-command/add-bottom-sheet.md \
  templates/claude-command/add-bottom-tab.md \
  templates/claude-command/add-feature.md \
  templates/claude-command/add-image-picker.md \
  templates/claude-command/add-role.md \
  templates/claude-command/add-screen.md \
  templates/claude-command/init-app.md
```

- [ ] **Step 2: Verify**

```bash
grep "codingpixel" templates/claude-command/*.md
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add templates/claude-command/
git commit -m "rename: update claude-command templates"
```

---

## Task 10: Update historical docs (root-level)

**Files:**
- Modify: `SPEC.md`
- Modify: `PLAN_V5.md`
- Modify: `docs/PLAN.md`
- Modify: `docs/PLAN_V2.md`
- Modify: `docs/PLAN_V3.md`
- Modify: `docs/PLAN_V4.md`
- Modify: `docs/MIRROR_NOTES.md`

- [ ] **Step 1: Replace all occurrences in historical plan docs**

```bash
sed -i '' \
  -e 's|@codingpixel/create-expo-app|react-native-expo-boilerplate|g' \
  -e 's|codingpixel-create-expo-app|react-native-expo-boilerplate|g' \
  -e 's|codingpixel-expo-app|react-native-expo-boilerplate|g' \
  -e 's|codingpixel-expo|react-native-expo-boilerplate|g' \
  -e 's|Mubasher-dv/codingpixel-expo-app|Mubasher-dv/react-native-expo-boilerplate|g' \
  -e 's|com\.codingpixel\.|com.|g' \
  SPEC.md PLAN_V5.md docs/PLAN.md docs/PLAN_V2.md docs/PLAN_V3.md docs/PLAN_V4.md docs/MIRROR_NOTES.md
```

- [ ] **Step 2: Verify**

```bash
grep "codingpixel" SPEC.md PLAN_V5.md docs/PLAN.md docs/PLAN_V2.md docs/PLAN_V3.md docs/PLAN_V4.md docs/MIRROR_NOTES.md
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add SPEC.md PLAN_V5.md docs/PLAN.md docs/PLAN_V2.md docs/PLAN_V3.md docs/PLAN_V4.md docs/MIRROR_NOTES.md
git commit -m "rename: update historical plan + spec docs"
```

---

## Task 11: Update `docs/superpowers/` docs

**Files:**
- Modify: `docs/superpowers/specs/2026-05-12-standalone-feature-design.md`
- Modify: `docs/superpowers/specs/2026-05-12-role-feature-screen-commands-design.md`
- Modify: `docs/superpowers/specs/2026-05-13-bottom-tab-command-design.md`
- Modify: `docs/superpowers/plans/2026-05-12-role-feature-screen-commands.md`

- [ ] **Step 1: Replace all occurrences**

```bash
sed -i '' \
  -e 's|codingpixel-expo-app|react-native-expo-boilerplate|g' \
  -e 's|codingpixel-expo|react-native-expo-boilerplate|g' \
  docs/superpowers/specs/2026-05-12-standalone-feature-design.md \
  docs/superpowers/specs/2026-05-12-role-feature-screen-commands-design.md \
  docs/superpowers/specs/2026-05-13-bottom-tab-command-design.md \
  docs/superpowers/plans/2026-05-12-role-feature-screen-commands.md
```

- [ ] **Step 2: Verify**

```bash
grep "codingpixel" \
  docs/superpowers/specs/2026-05-12-standalone-feature-design.md \
  docs/superpowers/specs/2026-05-12-role-feature-screen-commands-design.md \
  docs/superpowers/specs/2026-05-13-bottom-tab-command-design.md \
  docs/superpowers/plans/2026-05-12-role-feature-screen-commands.md
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-05-12-standalone-feature-design.md \
        docs/superpowers/specs/2026-05-12-role-feature-screen-commands-design.md \
        docs/superpowers/specs/2026-05-13-bottom-tab-command-design.md \
        docs/superpowers/plans/2026-05-12-role-feature-screen-commands.md
git commit -m "rename: update superpowers specs + plans"
```

---

## Task 12: Final verification — zero old refs in source files

- [ ] **Step 1: Check all source/config/test files**

```bash
grep -r "codingpixel" --include="*.ts" --include="*.js" --include="*.json" .
```
Expected: no output.

- [ ] **Step 2: Check all markdown files (excluding the rename spec itself)**

```bash
grep -r "codingpixel" --include="*.md" . | grep -v "2026-05-13-rename-pkg-repo-design.md"
```
Expected: no output.

- [ ] **Step 3: Run full test suite one final time**

```bash
npm test
```
Expected: all tests pass.

---

## Task 13: Rename GitHub repository

- [ ] **Step 1: Rename the repo via GitHub API**

> **Warning:** This renames the GitHub repository. GitHub will automatically redirect the old URL for ~1 year, but update any local clones and CI references afterwards.

```bash
gh api -X PATCH repos/Mubasher-dv/codingpixel-expo-app -f name=react-native-expo-boilerplate
```
Expected: JSON response with `"name": "react-native-expo-boilerplate"`.

- [ ] **Step 2: Update local git remote to new URL**

```bash
git remote set-url origin https://github.com/Mubasher-dv/react-native-expo-boilerplate.git
```

- [ ] **Step 3: Verify remote is correct**

```bash
git remote -v
```
Expected:
```
origin  https://github.com/Mubasher-dv/react-native-expo-boilerplate.git (fetch)
origin  https://github.com/Mubasher-dv/react-native-expo-boilerplate.git (push)
```

- [ ] **Step 4: Push all commits**

```bash
git push origin main
```
Expected: all commits pushed successfully to the renamed repo.
