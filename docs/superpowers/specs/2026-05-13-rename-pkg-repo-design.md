# Rename Package & Repository — Design Spec

**Date:** 2026-05-13

## Goal

Rename the npm package, CLI bin, and GitHub repository from the `codingpixel-expo-app` / `codingpixel-expo` identity to `react-native-expo-boilerplate`. Also remove the `codingpixel.` org prefix from generated bundle IDs.

## Rename Map

| Old | New |
|-----|-----|
| npm name: `codingpixel-expo-app` | `react-native-expo-boilerplate` |
| bin key: `codingpixel-expo` | `react-native-expo-boilerplate` |
| GitHub repo: `Mubasher-dv/codingpixel-expo-app` | `Mubasher-dv/react-native-expo-boilerplate` |
| Bundle ID prefix: `com.codingpixel.<name>` | `com.<name>` (no org prefix) |
| Scoped ref: `@codingpixel/create-expo-app` | `react-native-expo-boilerplate` |
| Dir ref: `codingpixel-create-expo-app` | `react-native-expo-boilerplate` |

## Approach

Manual file-by-file edits (Approach A). Chosen because:
- Scope is fully known (23 files)
- Bundle ID change in `src/patch.ts` is code logic, not plain text substitution
- GitHub rename is a single `gh api` call
- Manual gives full reviewability

## Files Changed

### Source (`src/`)
- **`src/patch.ts`** — `bundleIdFor()` already generates `com.<safeName>` (no org prefix). Only the JSDoc comment on line 38 is stale (`com.codingpixel.mytestapp` example) — fix that string.
- **`src/add.ts`** — usage string update
- **`src/bootstrap.ts`** — usage string update

### Config
- **`package.json`** — `name`, `bin` key, `repository.url`, `homepage`, `bugs.url`

### Tests
- **`tests/patch.test.ts`** — test description string + comment

### Templates & Docs
- **`README.md`** — all CLI invocations + pkg refs (~15 occurrences)
- **`templates/base/README.md`** — CLI command refs (~10 occurrences)
- **`templates/claude-command/init-app.md`**
- **`templates/claude-command/add-feature.md`**
- **`templates/claude-command/add-screen.md`**
- **`templates/claude-command/add-role.md`**
- **`templates/claude-command/add-bottom-tab.md`**
- **`templates/claude-command/add-bottom-sheet.md`**
- **`templates/claude-command/add-image-picker.md`**

### Historical Plans & Specs (all refs updated)
- `SPEC.md`
- `PLAN_V5.md`
- `docs/PLAN.md`
- `docs/PLAN_V2.md`
- `docs/PLAN_V3.md`
- `docs/PLAN_V4.md`
- `docs/MIRROR_NOTES.md`
- `docs/superpowers/specs/2026-05-12-standalone-feature-design.md`
- `docs/superpowers/specs/2026-05-12-role-feature-screen-commands-design.md`
- `docs/superpowers/specs/2026-05-13-bottom-tab-command-design.md`
- `docs/superpowers/plans/2026-05-12-role-feature-screen-commands.md`

### GitHub
- Rename repo via `gh api -X PATCH repos/Mubasher-dv/codingpixel-expo-app -f name=react-native-expo-boilerplate`

## Bundle ID Behavior After Change

Generated bundle IDs:
- Input `test-app` → `com.testapp`
- Input `my-cool-app` → `com.mycoolapp`
- Input `1pp` → `com.app1pp` (leading-digit guard preserved)

## Out of Scope

- No npm unpublish / deprecation of old package name (manual npm action if needed)
- No redirect from old GitHub URL (GitHub handles this automatically for 1 year after rename)
- No version bump (rename is not a functional change)
