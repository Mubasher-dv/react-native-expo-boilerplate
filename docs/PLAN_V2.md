# `@codingpixel/create-expo-app` — Implementation Plan **v2**

**Date:** 2026-05-11
**Spec:** [SPEC.md](./SPEC.md)
**Supersedes:** [PLAN.md](./PLAN.md)
**Status:** Saved, not yet executed

This revision fixes blockers found in review of v1: Expo Router entry/config, `App.tsx` cleanup, reanimated worklets peer, expo-image-picker app.json plugin block, `expo-dev-client` always-install, placeholder syntax, marker file removal, babel merge clarity, and minor edge cases.

Phases mirror v1 numbering. **Changed** sections are marked `[CHANGED]`. **New** sections are marked `[NEW]`.

---

## Phase 0 — Package skeleton

Same as v1. No changes.

### Tasks

1. `mkdir codingpixel-create-expo-app && cd codingpixel-create-expo-app`
2. `npm init -y`. Edit `package.json`:
   - `"name": "@codingpixel/create-expo-app"`
   - `"version": "0.1.0"`
   - `"type": "module"`
   - `"bin": { "create-expo-app": "./bin/cli.js" }`
   - `"files": ["bin/", "dist/", "templates/", "README.md", "LICENSE"]`
   - `"engines": { "node": ">=18" }`
3. Add devDeps: `typescript`, `tsx`, `@types/node`, `vitest`, `prettier`, `eslint`.
4. Add runtime deps: `prompts`, `kleur`, `execa`, `fs-extra`.
5. Add `tsconfig.json` with `target: ES2022`, `module: NodeNext`, `outDir: dist`, `strict: true`.
6. **[CHANGED]** Create `bin/cli.js` with error guard:
   ```js
   #!/usr/bin/env node
   import("../dist/index.js").catch((err) => {
     if (err?.code === "ERR_MODULE_NOT_FOUND") {
       console.error("Build artifacts missing. Did you run `yarn build`?");
       process.exit(1);
     }
     console.error(err);
     process.exit(1);
   });
   ```
   `chmod +x bin/cli.js`.
7. Create `src/index.ts` printing "hello from @codingpixel/create-expo-app".
8. Add `scripts.build` (`tsc`), `scripts.dev` (`tsx src/index.ts`), `scripts.test` (`vitest`).
9. `git init`, initial commit.

**Exit criterion:** `yarn build && node bin/cli.js` prints hello.

---

## Phase 1 — CLI arg parsing + target dir resolution

### Tasks

1. `src/util.ts` — helpers: `isDirEmpty(path)`, `ensureDir(path)`, `log(message)`.
2. `src/bootstrap.ts` — export `resolveTargetDir(arg?: string): Promise<{ dir: string; name: string }>`:
   - **[CHANGED]** Reject absolute paths and `..`-traversal in `arg` with clear error.
   - If `arg === "."` → return `cwd` if no `package.json` exists, else throw. Name = `path.basename(cwd)`.
   - If `arg` non-empty → resolve to `path.join(process.cwd(), arg)` after `mkdir -p`. Throw if non-empty.
   - If `arg` empty → run `prompts` text question "App name?". Then recurse with the answer.
3. `src/index.ts` — parse `process.argv[2]`, call `resolveTargetDir`, log result.
4. Unit tests in `src/__tests__/bootstrap.test.ts`:
   - Returns cwd for `.` when empty.
   - Throws for `.` when `package.json` exists.
   - Creates and returns sibling dir for `my-app`.
   - Throws for non-empty `my-app`.
   - **[NEW]** Throws for `/abs/path`.
   - **[NEW]** Throws for `../sibling`.

**Exit criterion:** All invocation modes produce expected absolute paths; tests green.

---

## Phase 2 — Interactive prompts

### Tasks

1. `src/prompts.ts` — define `Answers`:
   ```ts
   type Answers = {
     primaryFont: string;       // "" if skipped
     secondaryFont: string;     // "" if skipped (or primary skipped)
     bottomSheet: boolean;
     imagePicker: boolean;
   };
   ```
2. **[CHANGED]** Export `async function gatherAnswers(): Promise<Answers>`:
   - Read `EXPO_PRIMARY_FONT` / `EXPO_SECONDARY_FONT` / `EXPO_INCLUDE_BOTTOM_SHEET` / `EXPO_INCLUDE_IMAGE_PICKER` from `process.env`.
   - **Truthiness rule:** boolean env vars accept `"1"` (true) and `"0"` (false). Any other non-empty value → throw with explicit "expected 1 or 0" error. Empty/unset → treat as missing (prompt or error per TTY).
   - String env vars (`EXPO_PRIMARY_FONT`, `EXPO_SECONDARY_FONT`): defined (even empty `""`) means "answered". Unset means "ask".
   - If all four resolved from env → return without prompting.
   - Otherwise use `prompts` for missing ones, in order.
   - Skip secondary-font prompt if primary is empty (default secondary to `""`).
   - If non-TTY and any missing → throw clear error listing the env vars needed.
3. Wire into `src/index.ts`.
4. Unit tests with mocked `prompts` + `process.env`:
   - All four env vars set → no prompts.
   - Primary empty → secondary not asked.
   - Bottom-sheet / image-picker default = no.
   - **[NEW]** `EXPO_INCLUDE_BOTTOM_SHEET="yes"` throws.

**Exit criterion:** Manual run prompts correctly; env-driven non-interactive mode works; tests green.

---

## Phase 3 — Wrap `create-expo-app`

### Tasks

1. `src/bootstrap.ts` — add `runCreateExpoApp(dir, name)`:
   - Run `npx create-expo-app@latest <dir> --template blank-typescript --no-install` via `execa`, inherit stdio.
   - Surface errors clearly.
2. Call after `resolveTargetDir` in `src/index.ts`.
3. **[NEW]** Add `cleanupBlankTemplate(target)`:
   - Delete `<target>/App.tsx` if present (blank-typescript ships it; conflicts with expo-router).
   - Delete `<target>/index.ts` at project root if present and contains the bare `registerRootComponent(App)` call.
4. Manual smoke test: `node bin/cli.js test-output` produces an Expo project shell with `App.tsx` removed.

**Exit criterion:** Project shell exists, `App.tsx` deleted, expo-router will not collide with stale entry.

---

## Phase 4 — Template overlay (static files) **[CHANGED — placeholder syntax + Expo Router enablement]**

### Placeholder convention **[NEW]**

All placeholder tokens live inside line comments on their own line so the template files remain valid TypeScript and editable in IDEs:

```
// @@USE_FONTS_IMPORT@@
// @@USE_FONTS_HOOK@@
// @@USE_FONTS_GUARD@@
// @@BOTTOM_SHEET_PROVIDER_IMPORT@@
// @@BOTTOM_SHEET_PROVIDER_OPEN@@
// @@BOTTOM_SHEET_PROVIDER_CLOSE@@
// @@MEDIA_CONSTANTS@@
// @@FONTS_ENUM@@
```

`overlay.ts` replaces each whole-line sentinel with either the generated block or removes the line entirely if the block is empty (no orphan blank lines).

### Tasks

1. `templates/base/` — populate with mirrored MyRoster sources, paths rooted at `<target>/`. Includes:
   - `src/app/_layout.tsx` with sentinels: `// @@USE_FONTS_IMPORT@@`, `// @@USE_FONTS_HOOK@@`, `// @@USE_FONTS_GUARD@@`, `// @@BOTTOM_SHEET_PROVIDER_IMPORT@@`, `// @@BOTTOM_SHEET_PROVIDER_OPEN@@`, `// @@BOTTOM_SHEET_PROVIDER_CLOSE@@`.
   - `src/app/routes.tsx` (dummy Stack).
   - `src/app/index.tsx` (Hello World).
   - `src/assets/` skeleton + `index.ts` (`export {};`).
   - `src/core/hooks/.gitkeep`.
   - `src/core/redux/` (5 files; userSlice with dummy shape).
   - `src/core/services/.gitkeep`.
   - `src/core/tanstack/` (`index.tsx` + `tanstack-keys.ts`).
   - `src/core/utils/config.ts`, `endpoints.ts`, `types.ts`, `validation.ts`.
   - `src/core/utils/constants.ts` with `// @@MEDIA_CONSTANTS@@`.
   - `src/features/.gitkeep`.
   - `src/ui/appComponents/` (24 primitives + modals).
   - `src/ui/components/errorFallback/index.tsx` (seeded).
   - `src/ui/iconComponents/` (7 wrappers).
   - `src/ui/theme/colors.ts`, `responsive.ts`, `allFileStyles.ts`.
   - `src/ui/theme/fonts.ts` with `// @@FONTS_ENUM@@`.
2. `src/overlay.ts`:
   - `copyTemplate(srcRoot, destRoot)` walks files, copies each. Files containing sentinels are read, replaced, written.
   - `applyBase(target, answers)` copies `templates/base/` into target.
3. **[NEW]** `src/patch.ts::patchAppJson(target, name, answers)` — runs in Phase 4 wiring:
   - Set `expo.scheme` = slug of `name` (lowercased, non-alphanumeric → `-`).
   - Ensure `expo.plugins` array exists. Add `"expo-router"` if missing.
   - Image-picker plugin entry deferred to Phase 5.
4. **[NEW]** `src/patch.ts::patchExpoRouterEntry(target)`:
   - Read `<target>/package.json`. Set `main` to `"expo-router/entry"`.
   - Verify `tsconfig.json` extends `expo/tsconfig.base` (create-expo-app default); if missing, add.
5. Wire `applyBase` → `patchAppJson` → `patchExpoRouterEntry` after `runCreateExpoApp` in `src/index.ts`.
6. Manual smoke test: every file lands; sentinels still in for now.

**Exit criterion:** All listed files present; expo-router entry + plugin + scheme configured; `App.tsx` gone; structure matches SPEC §6.

---

## Phase 5 — Conditional overlays **[CHANGED — image-picker app.json patch, drop marker file]**

### Tasks

1. `templates/bottom-sheet/` — 5 App* components only. **[REMOVED]** marker file dropped; pass `answers.bottomSheet` directly to `patch.ts`.
2. `templates/image-picker/`:
   - `src/core/services/PermissionService.ts`.
   - `media-constants.snippet.ts` — text block to splice into `constants.ts`.
3. `src/overlay.ts`:
   - `applyBottomSheet(target)` copies the 5 components if `answers.bottomSheet`.
   - `applyImagePicker(target)` copies `PermissionService.ts` and splices media constants into `constants.ts` (replaces `// @@MEDIA_CONSTANTS@@` sentinel).
4. **[NEW]** `src/patch.ts::patchAppJsonPlugins(target, answers)`:
   - If `answers.imagePicker`, push into `expo.plugins`:
     ```json
     ["expo-image-picker", {
       "photosPermission": "Allow $(PRODUCT_NAME) to access your photos.",
       "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera."
     }]
     ```
   - Idempotent: don't double-add if already present.
5. Wire both into `src/index.ts` after `applyBase`.

**Exit criterion:**
- Both = yes: bottom-sheet files present; `PermissionService.ts` present; media constants spliced; `expo-image-picker` plugin entry in `app.json`.
- Both = no: neither dir; constants file has empty media block; no image-picker entry in `app.json`.

---

## Phase 6 — Fonts generation + `_layout.tsx` sentinel replacement **[CHANGED — sentinel names]**

### Tasks

1. `src/fonts.ts`:
   - `generateFontsEnum(primary: string, secondary: string): string` returning full `export const enum Fonts { ... }` body.
   - Empty primary → 9 keys with `""` values.
   - Primary only → 9 keys with primary-prefixed values.
   - Primary + secondary → 18 keys (9 bare + 9 prefixed).
   - Helpers: `enumKey(family, weight)`, `enumValue(family, weight)`.
2. `generateUseFontsBlocks(primary, secondary)` returns 3 strings keyed to the 3 sentinels:
   - `useFontsImport`: `import { useFonts } from "expo-font";` (or `""` if primary empty).
   - `useFontsHook`: `const [fontsLoaded, fontError] = useFonts({ ... });` (or `""`).
   - `useFontsGuard`: `if (!fontsLoaded && !fontError) return null;` (or `""`).
3. `generateBottomSheetProviderBlocks(bottomSheet)` returns 3 strings:
   - `import`: `import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";`
   - `open`: `<BottomSheetModalProvider>` (own line).
   - `close`: `</BottomSheetModalProvider>` (own line).
   - All `""` if `bottomSheet === false`.
4. `src/patch.ts::patchLayout(target, answers)`:
   - Read `src/ui/theme/fonts.ts`, replace `// @@FONTS_ENUM@@` with `generateFontsEnum(...)`.
   - Read `src/app/_layout.tsx`, replace 6 sentinels:
     `// @@USE_FONTS_IMPORT@@`, `// @@USE_FONTS_HOOK@@`, `// @@USE_FONTS_GUARD@@`,
     `// @@BOTTOM_SHEET_PROVIDER_IMPORT@@`, `// @@BOTTOM_SHEET_PROVIDER_OPEN@@`, `// @@BOTTOM_SHEET_PROVIDER_CLOSE@@`.
   - **[NEW]** Empty replacements drop the whole sentinel line (no orphan blank).
5. Unit tests:
   - `generateFontsEnum` for 4 cases.
   - Patcher leaves no `@@` token in output.
   - Empty blocks produce no blank lines.

**Exit criterion:** No `@@PLACEHOLDER@@` tokens left in generated project for any combination; tests green.

---

## Phase 7 — `package.json` / `tsconfig.json` / `babel.config.js` patching **[CHANGED — deps list, babel merge, reanimated, dev-client]**

### Tasks

1. **[CHANGED]** `src/patch.ts::patchPackageJson(target, answers)`:
   - Merge always-installed deps from static list (SPEC §7) **plus**:
     - `expo-dev-client` (always — generated project requires it because `react-native-mmkv` + `react-native-keyboard-controller` won't run in Expo Go).
     - `react-native-worklets` (always — required peer of `react-native-reanimated` SDK 54+).
   - If `answers.bottomSheet` → add `@gorhom/bottom-sheet`.
   - If `answers.imagePicker` → add `expo-image-picker`.
   - Add scripts:
     - `"start": "expo start --dev-client"`
     - `"android": "expo run:android"`
     - `"ios": "expo run:ios"`
     - `"web": "expo start --web"`
     - `"lint": "eslint ."`
   - Preserve `main: "expo-router/entry"` set in Phase 4.
2. **[CHANGED]** `src/patch.ts::patchTsconfig(target)`:
   - Read existing tsconfig (it extends `expo/tsconfig.base` — preserve `extends`).
   - Read `compilerOptions.paths` if present; merge SPEC §9 aliases.
   - **[NEW]** Detect collision on `@/*` — if base already maps `@/*` to `./*`, override with our `src/*` mapping and log a warning.
3. **[CHANGED]** `src/patch.ts::patchBabel(target)`:
   - Always **merge** (never rewrite). create-expo-app produces:
     ```js
     module.exports = function (api) {
       api.cache(true);
       return { presets: ['babel-preset-expo'] };
     };
     ```
   - Read file, parse as text, inject `plugins` array with `['module-resolver', { alias: {...} }]`.
   - **Do NOT** add `react-native-reanimated/plugin` — `babel-preset-expo` includes it automatically in SDK 50+.
   - If parsing the existing file fails, abort with a clear error (don't clobber).
4. Unit tests:
   - Each patch produces expected JSON keys.
   - No keys lost from the original file.
   - Babel merge preserves `babel-preset-expo` preset.
   - `tsconfig` merge preserves `extends`.
5. Manual smoke: inspect generated `tsconfig.json` — paths present, `extends` preserved; `package.json` — deps present, `main = expo-router/entry`; `babel.config.js` — module-resolver added, preset untouched; `app.json` — `scheme`, `plugins: ["expo-router", ...]` present.

**Exit criterion:** Tests green; manual inspection passes.

---

## Phase 8 — Install + success message

### Tasks

1. `src/install.ts`:
   - Detect `yarn` via `execa('yarn', ['--version'])` in try/catch (more portable than `which`).
   - Prefer `yarn install`, fallback `npm install`.
   - Inherit stdio so user sees progress.
2. Wire into `src/index.ts` after patches.
3. **[CHANGED]** Print final message:
   - Green checkmark.
   - `cd <dir>`.
   - `npx expo prebuild` reminder (because the project includes native modules requiring dev-client).
   - `yarn android` or `yarn ios` (not `yarn start` alone — Expo Go won't run this).
   - Link to README "Adding fonts" section if primary font was provided.
   - Link to README "First-time dev-client build" section.

**Exit criterion:** `node bin/cli.js test-app` end-to-end produces a project where `npx expo prebuild && yarn ios` succeeds.

---

## Phase 9 — Claude Code slash command

### Tasks

1. Author `templates/claude-command/init-app.md`:
   - Frontmatter: `description: "Bootstrap a new Expo app via @codingpixel/create-expo-app"`.
   - Body instructs Claude to use `AskUserQuestion` for each prompt + app name + target dir, then runs `npx @codingpixel/create-expo-app` with the 4 `EXPO_*` env vars set (using `"1"`/`"0"` for booleans per Phase 2 truthiness rule).
2. Document in README how to install (copy file into `.claude/commands/`).
3. Manual test in this repo's `.claude/commands/` folder.

**Exit criterion:** `/init-app` in Claude Code prompts user and produces a working project.

---

## Phase 10 — Documentation + publishing **[CHANGED — README sections]**

### Tasks

1. **[CHANGED]** Write `README.md` per SPEC §15. Add explicit sections:
   - **"Not Expo Go-compatible"** — list of native modules (`react-native-mmkv`, `react-native-keyboard-controller`, optional `@gorhom/bottom-sheet`, optional `expo-image-picker`). Explain `expo-dev-client` is included; first run requires `npx expo prebuild` + native build.
   - **"Adding fonts after install"** — drop `.ttf` into `assets/fonts/` matching enum values; Metro logs missing files.
   - **"`@/*` alias note"** — points at `src/*`, overrides `expo/tsconfig.base` default.
2. Add `LICENSE` (MIT).
3. Configure `prepublishOnly` script: `yarn build && yarn test`.
4. Verify scoped publishing: `npm publish --access public`.
5. Tag release: `git tag v0.1.0 && git push --tags`.

**Exit criterion:** `npx @codingpixel/create-expo-app new-project` works from anywhere.

---

## Summary of v1 → v2 fixes

| # | v1 issue | v2 fix |
|---|----------|--------|
| 1 | `src/app/` route root never enabled | Phase 4 `patchExpoRouterEntry` sets `main: "expo-router/entry"`; Expo Router auto-detects `src/app/`. tsconfig confirmed to extend `expo/tsconfig.base`. |
| 2 | `blank-typescript` ships `App.tsx` + non-router entry | Phase 3 `cleanupBlankTemplate` deletes `App.tsx`; Phase 4 patches `main`. |
| 3 | `app.json` not patched | Phase 4 `patchAppJson` adds `scheme` + `expo-router` plugin. |
| 4 | `expo-image-picker` permissions not configured | Phase 5 `patchAppJsonPlugins` adds plugin entry with `photosPermission` + `cameraPermission`. |
| 5 | Native modules incompatible with Expo Go, unaddressed | `expo-dev-client` added to always-install (Phase 7). README documents prebuild flow. |
| 6 | Reanimated babel plugin needed manual entry | Confirmed `babel-preset-expo` auto-handles it; only `module-resolver` is patched. `react-native-worklets` peer added to always-install. |
| 7 | Placeholder tokens broke TS parsing of template files | Switched to `// @@TOKEN@@` line-comment sentinels; replacement drops the whole line if empty. |
| 8 | Phase 4 / Phase 6 placeholder lists mismatched | Single canonical sentinel list defined in Phase 4 preamble. |
| 9 | SPEC §10 `SafeAreaInsetsProvider` likely typo | Treated as drop in implementation — provider tree uses only `SafeAreaProvider`; `useSafeAreaInsets` used inside screens as needed. (Note: also fix SPEC §10 in next doc pass.) |
| 10 | Bottom-sheet "marker file" dead weight | Removed. `answers.bottomSheet` passed directly to patcher. |
| 11 | Babel patch said "or rewrite" — clobber risk | Merge-only path; abort on parse failure. |
| 12 | `bin/cli.js` cryptic error on missing build | Wrapped dynamic import in try/catch with friendly hint. |
| 13 | Phase 1 ambiguous on absolute / `..` paths | Reject both with clear error; tests added. |
| 14 | Boolean env var truthiness undefined | Phase 2: `"1"`/`"0"` only, else throw. |
| 15 | `tsconfig` `@/*` collision with `expo/tsconfig.base` | Phase 7 detects collision, overrides, warns. |
| 16 | Final message implied Expo Go would work | Phase 8 message updated to point at prebuild + dev-client builds. |

---

## Risks + mitigations (carried from v1, plus new)

| Risk | Mitigation |
|------|------------|
| `create-expo-app` flags change | Pin to a specific major; smoke-test on every Expo SDK bump. |
| Mirrored App* components reference MyRoster-specific paths | Phase 4 import rewriting + regex audit step. |
| Font file expectations create silent runtime failures | README documents `.ttf` drop convention; Metro logs missing files. |
| Patches collide with future `create-expo-app` template changes | JSON manipulation for `package.json`/`tsconfig`/`app.json`; babel parsed as text but merge-only. Diff against upstream every Expo upgrade. |
| Scoped package publish needs `--access public` | Baked into `prepublishOnly` + documented in `CONTRIBUTING.md`. |
| **[NEW]** `babel-preset-expo` stops auto-including reanimated plugin in future SDK | Add CI smoke test that calls a worklet in the generated project and asserts it runs; bump our wrapper if it breaks. |
| **[NEW]** `expo-router` changes its `src/app/` auto-detection behavior | Doc which SDK we target per CLI version; add fallback custom entry in `index.js` if auto-detection breaks. |
| **[NEW]** User's machine has stale globally-installed `create-expo-app` overriding `npx ...@latest` | Use `npx --yes create-expo-app@latest` to force fresh fetch. |

## Definition of done (v1 ship)

- All 10 phases complete.
- Unit + smoke tests green in CI.
- Generated project boots via `yarn ios` / `yarn android` after `npx expo prebuild`.
- Package published to npm under `@codingpixel/create-expo-app`.
- Slash command available + documented.
- README covers prompt walkthrough, generated structure, Expo Go incompatibility, prebuild flow, future-work roadmap.

---

## Open SPEC.md edits required (separate pass)

Not part of this plan execution but flagged for documentation cleanup:

- §10 — drop `SafeAreaInsetsProvider` line (no such provider exists; insets come from `useSafeAreaInsets` hook).
- §6 — confirm `src/app/` is the routing root (Expo Router auto-detects this; documented above).
- §7 — append `expo-dev-client`, `react-native-worklets` to always-installed list.
- §8 — note that bottom-sheet + image-picker each contribute an `app.json` plugin entry.
- §13 — define `EXPO_INCLUDE_*` truthiness as strict `"1"` / `"0"`.
