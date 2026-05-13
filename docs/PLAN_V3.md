# `react-native-expo-boilerplate` — Implementation Plan **v3**

**Date:** 2026-05-11
**Spec:** [SPEC.md](./SPEC.md)
**Supersedes:** [PLAN_V2.md](./PLAN_V2.md)
**Status:** Saved, not yet executed

Fixes blockers + strong concerns surfaced in v2 review. Decisions locked:

| Topic | Decision |
|---|---|
| Bin name | `react-native-expo-boilerplate` (hygiene — avoids collision when both globally installed; `npx react-native-expo-boilerplate` resolves by package name regardless) |
| Fonts type | Object literal `as const` + derived type (drop `const enum` — not Babel-safe under `babel-preset-expo`) |
| Assets path | Root `assets/` (matches SPEC §6 + Expo convention; PLAN_V2's `src/assets/` was wrong) |
| Native deps | All native deps installed via `npx expo install <pkg> ...` so Expo resolves versions for target SDK — eliminates manual version pinning per SDK |
| Babel patch | AST merge via `@babel/parser` + `@babel/traverse` + `@babel/generator` (no text regex) |
| JSX-position sentinels | `{/* @@TOKEN@@ */}` so template `_layout.tsx` parses as valid TSX pre-generation |
| Module-position sentinels | `// @@TOKEN@@` (line comment) |
| `react-native-screens` | Added explicit always-install (peer of `expo-router`, not auto-installed by blank-TS template) |
| SPEC §10 provider tree | Drop `SafeAreaInsetsProvider` (no such export); `useSafeAreaInsets` used inside screens |

Phases mirror v2 numbering. `[CHANGED FROM V2]` and `[NEW]` markers preserved.

---

## Phase 0 — Package skeleton **[CHANGED FROM V2 — bin name + babel devdeps]**

### Tasks

1. `mkdir react-native-expo-boilerplate && cd react-native-expo-boilerplate`
2. `npm init -y`. Edit `package.json`:
   - `"name": "react-native-expo-boilerplate"`
   - `"version": "0.1.0"`
   - `"type": "module"`
   - **[CHANGED]** `"bin": { "react-native-expo-boilerplate": "./bin/cli.js" }` — renamed to avoid Expo bin collision. `npx react-native-expo-boilerplate` still works (single bin auto-invoked).
   - `"files": ["bin/", "dist/", "templates/", "README.md", "LICENSE"]`
   - `"engines": { "node": ">=18" }`
3. Add devDeps: `typescript`, `tsx`, `@types/node`, `vitest`, `prettier`, `eslint`.
4. **[CHANGED]** Add runtime deps: `prompts`, `kleur`, `execa`, `fs-extra`, `@babel/parser`, `@babel/traverse`, `@babel/generator`, `@babel/types`.
5. `tsconfig.json`: `target ES2022`, `module NodeNext`, `outDir dist`, `strict true`.
6. `bin/cli.js` with error guard:
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
7. `src/index.ts` prints "hello from react-native-expo-boilerplate".
8. Scripts: `build` (`tsc`), `dev` (`tsx src/index.ts`), `test` (`vitest`).
9. `git init`, initial commit.
10. **[NEW]** Pre-exec verification (record findings in `docs/SDK_NOTES.md`):
    - Confirm target Expo SDK (run `npm view create-expo-app` for default template SDK).
    - Verify `babel-preset-expo` for that SDK auto-includes worklets plugin: read `node_modules/babel-preset-expo/src/index.js` after a smoke `npx create-expo-app --template blank-typescript` run. Look for `react-native-worklets/plugin` or `react-native-reanimated/plugin`.
    - Verify exact package name Expo expects: `react-native-worklets` vs `react-native-worklets-core`. Run `npx expo install react-native-worklets` in smoke project; if it errors "no version known," try `-core` variant. Lock the working name into Phase 7 step 2.
    - If preset does NOT auto-include the worklets plugin: Phase 7 step 4 must add it as the LAST entry in babel `plugins` array (worklets plugin must be last per its own docs).
    - Verify `expo install` works against a `--no-install` project (empty `node_modules`): create with `--no-install`, then run `expo install` — should read `package.json` SDK pin and resolve. If it requires `node_modules/expo`, swap order so `yarn install` runs first.

**Exit criterion:** `yarn build && node bin/cli.js` prints hello; `SDK_NOTES.md` records verified package names + preset behavior.

---

## Phase 1 — CLI arg parsing + target dir resolution

Same as v2. No changes.

### Tasks

1. `src/util.ts` helpers: `isDirEmpty`, `ensureDir`, `log`.
2. `src/bootstrap.ts::resolveTargetDir(arg?)`:
   - Reject absolute paths + `..`-traversal.
   - `arg === "."` → return `cwd` if no `package.json`, else throw. Name = `path.basename(cwd)`.
   - `arg` non-empty → `path.join(cwd, arg)` after `mkdir -p`. Throw if non-empty.
   - `arg` empty → prompt "App name?", recurse.
3. `src/index.ts` wires it up.
4. Tests:
   - `.` empty cwd → returns cwd.
   - `.` with `package.json` → throws.
   - `my-app` → creates + returns.
   - `my-app` non-empty → throws.
   - `/abs/path` → throws.
   - `../sibling` → throws.

**Exit criterion:** All modes produce expected paths; tests green.

---

## Phase 2 — Interactive prompts

Same as v2. No changes.

### Tasks

1. `src/prompts.ts` `Answers` type — 4 fields as v2.
2. `gatherAnswers()`:
   - Read 4 `EXPO_*` env vars.
   - Booleans: `"1"`/`"0"` only, else throw `"expected 1 or 0"`. Unset/empty → missing.
   - Strings: defined (even `""`) = answered. Unset = ask.
   - All 4 resolved → return without prompting.
   - Missing + TTY → prompt; missing + non-TTY → throw.
   - Skip secondary if primary empty.
3. Wire into `src/index.ts`.
4. Tests as v2 + `EXPO_INCLUDE_BOTTOM_SHEET="yes"` throws.

**Exit criterion:** Manual + env-driven runs work; tests green.

---

## Phase 3 — Wrap `create-expo-app` **[CHANGED FROM V2 — drop dead `index.ts` deletion]**

### Tasks

1. `src/bootstrap.ts::runCreateExpoApp(dir, name)`:
   - `npx --yes create-expo-app@latest <dir> --template blank-typescript --no-install` via `execa`, inherit stdio.
   - `--yes` forces fresh fetch (skip stale globals).
2. Call after `resolveTargetDir` in `src/index.ts`.
3. **[CHANGED]** `cleanupBlankTemplate(target)`:
   - Delete `<target>/App.tsx` if present (blank-typescript ships it; conflicts with expo-router).
   - **[REMOVED]** `index.ts` root deletion (blank-typescript doesn't ship one; was dead code in v2).
4. Smoke test: `node bin/cli.js test-output` produces shell with `App.tsx` removed.

**Exit criterion:** Shell exists, `App.tsx` deleted.

---

## Phase 4 — Template overlay (static files) **[CHANGED FROM V2 — assets at root + JSX sentinel syntax]**

### Placeholder conventions **[CHANGED]**

Two sentinel forms, picked by position:

| Position | Form | Reason |
|---|---|---|
| Module scope (imports, top-level statements) | `// @@TOKEN@@` (line comment, own line) | Valid TS at module scope |
| Inside JSX children | `{/* @@TOKEN@@ */}` (JSX expression with comment) | Required — bare `//` comment invalid as JSX child |

Sentinel list:

```
// @@USE_FONTS_IMPORT@@           (module — _layout.tsx imports)
// @@USE_FONTS_HOOK@@             (module — inside function body)
// @@USE_FONTS_GUARD@@            (module — inside function body)
// @@BOTTOM_SHEET_PROVIDER_IMPORT@@  (module — _layout.tsx imports)
{/* @@BOTTOM_SHEET_PROVIDER_OPEN@@ */}   (JSX child)
{/* @@BOTTOM_SHEET_PROVIDER_CLOSE@@ */}  (JSX child)
// @@MEDIA_CONSTANTS@@            (module — constants.ts)
// @@FONTS_ENUM@@                 (module — fonts.ts)
```

`overlay.ts` replaces each whole-line sentinel with generated block or removes line entirely if block empty (no orphan blanks). Both sentinel forms matched by single regex: `/^\s*(\/\/|\{\/\*)\s*@@(\w+)@@\s*(\*\/\})?\s*$/`.

Template `_layout.tsx` must parse as valid TSX with sentinels in place. **[CHANGED]** Verification deferred to generate-then-build E2E (Phase 8 smoke test) instead of standalone `tsc --noEmit` on `templates/base/**` — the latter would fail on every peer-dep import (`expo-router`, `react-native`, etc.) since those aren't deps of the CLI package itself. Building these as devDeps of the CLI just to satisfy template typecheck is fat-install bloat. Generate-then-build covers the same concern by typechecking the actual output.

### Tasks

1. **[CHANGED]** `templates/base/` paths — `assets/` at project root (not `src/assets/`):
   - `assets/fonts/.gitkeep`
   - `assets/images/.gitkeep`
   - `assets/index.ts` (`export {};`)
   - `src/app/_layout.tsx` with 6 sentinels (mixed forms per above).
   - `src/app/routes.tsx` (dummy Stack).
   - `src/app/index.tsx` (Hello World via `AppWrapper` + `AppText`).
   - `src/core/hooks/.gitkeep`
   - `src/core/redux/` (5 files; userSlice dummy).
   - `src/core/services/.gitkeep`
   - `src/core/tanstack/` (`index.tsx` + `tanstack-keys.ts`).
   - `src/core/utils/`: `config.ts`, `endpoints.ts`, `types.ts`, `validation.ts`, `constants.ts` with `// @@MEDIA_CONSTANTS@@`.
   - `src/features/.gitkeep`
   - `src/ui/appComponents/` (24 primitives + modals).
   - `src/ui/components/errorFallback/index.tsx`.
   - `src/ui/iconComponents/` (7 wrappers).
   - `src/ui/theme/`: `colors.ts`, `responsive.ts`, `allFileStyles.ts`, `fonts.ts` with `// @@FONTS_ENUM@@`.
2. **[CHANGED]** Provider tree in `_layout.tsx` — drops nonexistent `SafeAreaInsetsProvider`:
   ```
   Provider (redux store)
     PersistGate
       TanStackQueryProvider
         GestureHandlerRootView
           SafeAreaProvider
             KeyboardProvider
               {/* @@BOTTOM_SHEET_PROVIDER_OPEN@@ */}
                 ErrorBoundary
                   Routes
               {/* @@BOTTOM_SHEET_PROVIDER_CLOSE@@ */}
   ```
3. `src/overlay.ts`:
   - `copyTemplate(srcRoot, destRoot)` walks files. Files with sentinels read → replace → write.
   - `applyBase(target, answers)` copies `templates/base/`.
4. `src/patch.ts::patchAppJson(target, name, answers)`:
   - `expo.scheme` = slug of `name` (lowercase, non-alphanumeric → `-`, collapse runs).
   - `expo.plugins` array exists; add `"expo-router"` if missing.
   - Image-picker plugin entry deferred to Phase 5.
5. `src/patch.ts::patchExpoRouterEntry(target)`:
   - `<target>/package.json`: set `main` to `"expo-router/entry"`.
   - Verify `tsconfig.json` extends `expo/tsconfig.base`; add if missing.
6. Wire `applyBase` → `patchAppJson` → `patchExpoRouterEntry` after `runCreateExpoApp`.
7. **[NEW]** Mirrored-source audit: grep `templates/base/src/ui/appComponents/**` for `: Fonts` / `<Fonts>` / `Fonts\s*\[` (type-position uses of `Fonts`). MyRoster declared `Fonts` as `enum`, which is both a value AND a type. Object-literal `as const` substitute (Phase 6) is only a value — type-position uses must be rewritten to `FontKey` or `(typeof Fonts)[keyof typeof Fonts]`. If grep finds matches, rewrite during mirror step; if none, no-op. Document result in commit.
8. Smoke test: every file lands; sentinels still in for now (replacement runs in Phase 6).

**Exit criterion:** Files present at correct paths; expo-router entry + plugin + scheme configured; `App.tsx` gone; type-position `Fonts` audit completed.

---

## Phase 5 — Conditional overlays

Same as v2 except marker file already dropped.

### Tasks

1. `templates/bottom-sheet/` — 5 App* components.
2. `templates/image-picker/`:
   - `src/core/services/PermissionService.ts`.
   - `media-constants.snippet.ts` — text spliced into `constants.ts`.
3. `src/overlay.ts`:
   - `applyBottomSheet(target)` if `answers.bottomSheet`.
   - `applyImagePicker(target)` copies `PermissionService.ts`, replaces `// @@MEDIA_CONSTANTS@@` in `constants.ts`.
4. `src/patch.ts::patchAppJsonPlugins(target, answers)`:
   - If `answers.imagePicker`, push:
     ```json
     ["expo-image-picker", {
       "photosPermission": "Allow $(PRODUCT_NAME) to access your photos.",
       "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera."
     }]
     ```
   - Idempotent: skip if already present.
5. Wire both after `applyBase`.

**Exit criterion:**
- Both yes: 5 bottom-sheet files + `PermissionService.ts` + spliced constants + image-picker plugin entry.
- Both no: no extras; constants media block empty; no image-picker entry.

---

## Phase 6 — Fonts generation + sentinel replacement **[CHANGED FROM V2 — object literal not `const enum`]**

### Tasks

1. **[CHANGED]** `src/fonts.ts::generateFontsObject(primary, secondary): string`:
   - Returns full module body:
     ```ts
     export const Fonts = {
       BOLD: "OpenSans-Bold",
       ...
     } as const;
     export type FontKey = keyof typeof Fonts;
     ```
   - Empty primary → 9 keys with `""` values.
   - Primary only → 9 keys with `<Primary>-<Weight>` values.
   - Primary + secondary → 18 keys (9 bare + 9 prefixed by secondary uppercased).
   - Helpers: `objectKey(family, weight)`, `objectValue(family, weight)`.
   - **Rationale:** `const enum` is stripped by `babel-preset-expo` (no runtime emit); fails under `isolatedModules: true` in `expo/tsconfig.base`. Object literal `as const` gives same compile-time safety + works at runtime.
2. `generateUseFontsBlocks(primary, secondary)` → 3 strings:
   - `useFontsImport`: `import { useFonts } from "expo-font";` (or `""` if primary empty).
   - `useFontsHook`: `const [fontsLoaded, fontError] = useFonts({ [Fonts.BOLD]: require("../../assets/fonts/<value>.ttf"), ... });` (or `""`).
   - `useFontsGuard`: `if (!fontsLoaded && !fontError) return null;` (or `""`).
   - **[CONFIRMED]** Require path `../../assets/fonts/...` resolves from `src/app/_layout.tsx` to root `<target>/assets/fonts/` — matches Phase 4 layout.
3. `generateBottomSheetProviderBlocks(bottomSheet)` → 3 strings:
   - `import`: `import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";`
   - `open`: `<BottomSheetModalProvider>` (own line).
   - `close`: `</BottomSheetModalProvider>` (own line).
   - All `""` if `bottomSheet === false`.
4. `src/patch.ts::patchLayout(target, answers)`:
   - `src/ui/theme/fonts.ts`: replace `// @@FONTS_ENUM@@` with `generateFontsObject(...)`.
   - `src/app/_layout.tsx`: replace all 6 sentinels (mixed `//` + `{/* */}` forms).
   - Empty replacements drop whole sentinel line (no orphan blanks).
5. Tests:
   - `generateFontsObject` 4 cases.
   - Patcher leaves no `@@` token.
   - Empty blocks → no blank lines.
   - JSX-position sentinel replacement preserves valid TSX.

**Exit criterion:** No `@@PLACEHOLDER@@` tokens in generated project for any combination; tests green.

---

## Phase 7 — `package.json` / `tsconfig.json` / `babel.config.js` patching **[CHANGED FROM V2 — `npx expo install` for native deps + AST babel merge + react-native-screens]**

### Tasks

1. **[CHANGED]** `src/patch.ts::patchPackageJsonScripts(target)`:
   - Set scripts:
     - `"start": "expo start --dev-client"`
     - `"android": "expo run:android"`
     - `"ios": "expo run:ios"`
     - `"web": "expo start --web"`
     - `"lint": "eslint ."`
   - Preserve `main: "expo-router/entry"` from Phase 4. Read-merge-write (no overwrite). Unit test asserts `main` survives.
   - Preserve all create-expo-app-set keys (`expo`, `private`, etc.).
2. **[NEW]** `src/install.ts::installNativeDeps(target, answers)` — run BEFORE final `yarn install`:
   - Always: run
     ```
     npx --yes expo install \
       @reduxjs/toolkit react-redux redux-persist react-native-mmkv \
       @tanstack/react-query axios formik yup \
       expo-router expo-dev-client \
       react-native-safe-area-context react-native-gesture-handler \
       react-native-reanimated react-native-worklets \
       react-native-keyboard-controller react-native-screens \
       react-error-boundary react-native-responsive-fontsize \
       @expo/vector-icons @shopify/flash-list
     ```
   - If `answers.bottomSheet`: `npx --yes expo install @gorhom/bottom-sheet`.
   - If `answers.imagePicker`: `npx --yes expo install expo-image-picker`.
   - **Rationale:** `expo install` picks SDK-compatible versions automatically. Eliminates manual version pinning per SDK bump. Single source of truth = installed Expo SDK in target project.
   - `expo install` writes `dependencies` directly; no need for our own version table.
3. **[CHANGED]** `src/patch.ts::patchTsconfig(target)`:
   - Read existing tsconfig; preserve `extends: "expo/tsconfig.base"`.
   - Merge `compilerOptions.paths` with SPEC §9 aliases.
   - Detect `@/*` collision with base; override + log warning.
4. **[CHANGED]** `src/patch.ts::patchBabel(target)` — **AST merge**:
   - Read `babel.config.js`. Parse via `@babel/parser` (`sourceType: "script"`).
   - Traverse with `@babel/traverse`:
     - Find `ReturnStatement` inside top-level function (the `api =>` arrow or `function(api)`).
     - Locate returned `ObjectExpression`.
     - If no `plugins` property → add `plugins: []`.
     - Push `["module-resolver", { alias: <map> }]` into `plugins` array (skip if already present — idempotent).
   - Generate output via `@babel/generator`, write back.
   - **Worklets plugin handling — verify per Phase 0 step 10:**
     - If `babel-preset-expo` auto-includes (verified): do nothing extra.
     - If it does NOT auto-include: append `"react-native-worklets/plugin"` (or `"react-native-reanimated/plugin"` for older SDKs — name from Phase 0 verification) as the LAST entry in `plugins` array. Worklets plugin must be last per its docs.
   - On parse failure: abort with explicit error message including upstream babel.config.js content; don't clobber.
5. Tests:
   - `patchPackageJsonScripts`: scripts present, `main` survives, `expo` key survives.
   - `patchTsconfig`: paths merged, `extends` preserved, collision warning emitted.
   - `patchBabel`: input fixture (current create-expo-app output) → expected AST diff (module-resolver added, preset untouched). Snapshot test.
   - `patchBabel` idempotency: running twice produces identical output.
6. Manual smoke: inspect generated files match expectations.

**Exit criterion:** Tests green; manual inspection passes.

---

## Phase 8 — Install + success message

### Tasks

1. `src/install.ts::runInstall(target)`:
   - **Note:** `expo install` calls in Phase 7 already touched `package.json` deps + installed transitively. This final step ensures lockfile parity.
   - Detect `yarn` via `execa('yarn', ['--version'])` try/catch.
   - Prefer `yarn install`, fallback `npm install`. Inherit stdio.
2. Wire after patches.
3. Final message:
   - Green checkmark.
   - `cd <dir>`.
   - `npx expo prebuild` reminder (native modules require dev-client).
   - `yarn android` / `yarn ios` (not `yarn start` alone — Expo Go won't run this).
   - Link to README "Adding fonts" if primary font provided.
   - Link to README "First-time dev-client build".

**Exit criterion:** End-to-end `node bin/cli.js test-app` → `npx expo prebuild && yarn ios` succeeds.

---

## Phase 9 — Claude Code slash command **[CHANGED FROM V2 — empty-string env clarification]**

### Tasks

1. Author `templates/claude-command/init-app.md`:
   - Frontmatter: `description: "Bootstrap a new Expo app via react-native-expo-boilerplate"`.
   - Body uses `AskUserQuestion` for: app name, target dir, 4 prompt answers.
   - Builds env var string. **[CLARIFIED]** Skip-font case = pass empty string explicitly:
     ```bash
     EXPO_PRIMARY_FONT="" EXPO_SECONDARY_FONT="" \
       EXPO_INCLUDE_BOTTOM_SHEET="0" EXPO_INCLUDE_IMAGE_PICKER="0" \
       npx react-native-expo-boilerplate <dir>
     ```
   - Document: empty string = "answered: skipped"; unset = "ask".
2. README install section: copy file into `.claude/commands/`.
3. Manual test in this repo's `.claude/commands/`.

**Exit criterion:** `/init-app` prompts user, produces working project.

---

## Phase 10 — Documentation + publishing **[CHANGED FROM V2 — explicit SDK target doc + bin rename note]**

### Tasks

1. Write `README.md`:
   - **"Not Expo Go-compatible"** — list native modules; explain `expo-dev-client` + prebuild flow.
   - **"Adding fonts after install"** — drop `.ttf` into `assets/fonts/` matching `Fonts` object values; Metro logs missing files.
   - **"`@/*` alias note"** — overrides `expo/tsconfig.base` default; resolves to `src/*`.
   - **"First-time dev-client build"** — `npx expo prebuild` → `yarn ios` / `yarn android`; iOS needs Xcode + CocoaPods, Android needs SDK.
   - **"Expo SDK compatibility"** — state which SDK this CLI release targets (set per release). Native dep versions inherited automatically from `expo install`.
   - **"Bin name"** — note `bin` is `react-native-expo-boilerplate` to avoid clash with upstream `create-expo-app`. Users invoke via `npx react-native-expo-boilerplate` (package name) or `react-native-expo-boilerplate` (after global install).
2. Add `LICENSE` (MIT).
3. `prepublishOnly`: `yarn build && yarn test`.
4. Scoped publish: `npm publish --access public`.
5. Tag: `git tag v0.1.0 && git push --tags`.

**Exit criterion:** `npx react-native-expo-boilerplate new-project` works from anywhere.

---

## Summary of v2 → v3 fixes

| # | v2 issue | v3 fix |
|---|----------|--------|
| 1 | `assets/` path mismatch (SPEC root vs PLAN_V2 `src/assets/`) | Phase 4 puts `assets/` at project root, matching SPEC §6 + `useFonts` require paths in §5.2. |
| 2 | `const enum Fonts` — not Babel-safe, breaks `isolatedModules` | Phase 6 uses `export const Fonts = {...} as const` + `type FontKey`. Same compile-time safety, works at runtime. |
| 3 | Bin name `create-expo-app` collides with upstream Expo bin | Phase 0 renames bin to `react-native-expo-boilerplate`. Package name unchanged. |
| 4 | Dead `index.ts` deletion in `cleanupBlankTemplate` | Removed (blank-typescript template doesn't ship one). |
| 5 | Manual version pinning for native deps per SDK | Phase 7 uses `npx expo install` — Expo picks SDK-compatible versions. |
| 6 | `react-native-screens` missing (expo-router peer) | Added to always-install list (via `expo install`). |
| 7 | Babel text-regex patching brittle | Phase 7 uses `@babel/parser` + `traverse` + `generator` AST merge. |
| 8 | JSX-position sentinels (`// @@TOKEN@@`) invalid as JSX children | Phase 4 switches JSX-position sentinels to `{/* @@TOKEN@@ */}`. CI runs `tsc --noEmit` on templates. |
| 9 | `patchPackageJson` could overwrite `main` from Phase 4 | Phase 7 step 1 read-merge-write + unit test asserts `main === "expo-router/entry"`. |
| 10 | SPEC §10 `SafeAreaInsetsProvider` typo | Phase 4 provider tree drops it; uses `useSafeAreaInsets` hook inside screens as needed. Open SPEC edits section flags doc fix. |
| 11 | Slash command env empty-string convention undocumented | Phase 9 explicitly documents empty string = "skip", unset = "ask". |
| 12 | `react-native-worklets` version pin risk per SDK | `expo install` handles per-SDK resolution. |

---

## Risks + mitigations (carried + new)

| Risk | Mitigation |
|------|------------|
| `create-expo-app` flags change | Pin to major; smoke-test per SDK bump. |
| Mirrored App* components reference MyRoster-specific paths | Phase 4 import rewriting + regex audit step. |
| Font file expectations create silent runtime failures | README documents `.ttf` drop convention. |
| Patches collide with future `create-expo-app` template changes | JSON manipulation; babel via AST. Diff upstream every Expo upgrade. |
| Scoped publish needs `--access public` | Baked into `prepublishOnly` + docs. |
| `babel-preset-expo` stops auto-including reanimated/worklets plugin | CI smoke test calls a worklet, asserts it runs; bump wrapper if broken. |
| `expo-router` changes `src/app/` auto-detection | Doc target SDK per CLI version; fallback custom entry if broken. |
| Stale global `create-expo-app` overriding `npx ...@latest` | `npx --yes` forces fresh fetch. |
| **[NEW]** `expo install` version-resolution fails offline | Document network requirement; final `yarn install` still runs from `package.json` lockfile. |
| **[NEW]** Babel AST merge breaks if upstream switches to `babel.config.ts` | Detect file extension; if `.ts` abort with explicit "manual babel config not yet supported" error. |
| **[NEW]** `babel-preset-expo` worklets auto-include claim wrong for target SDK | Phase 0 step 10 verifies before plan exec; Phase 7 step 4 has fallback branch to append plugin manually. |
| **[NEW]** `react-native-worklets` package name wrong (could be `-core`) | Phase 0 step 10 confirms exact name via `expo install` probe. |
| **[NEW]** `$(PRODUCT_NAME)` macro Android renders verbatim (cosmetic) | README "Adding image picker" section calls this out + shows raw-string alternative. |

---

## Definition of done (v1 ship)

- All 10 phases complete.
- Unit + smoke tests green in CI (Node 18 + 20).
- Template `tsc --noEmit` step green.
- Generated project boots via `yarn ios` / `yarn android` after `npx expo prebuild`.
- Published to npm under `react-native-expo-boilerplate`.
- Slash command + README sections shipped.

---

## SPEC.md edits required (separate pass)

Not part of plan execution; doc cleanup:

- §6 — confirm `assets/` at root (not in `src/`); confirm `src/app/` is routing root.
- §7 — append `expo-dev-client`, `react-native-worklets`, `react-native-screens` to always-installed list; note all installed via `expo install` (version inheritance).
- §8 — note bottom-sheet + image-picker each contribute an `app.json` plugin entry.
- §10 — drop `SafeAreaInsetsProvider` line.
- §13 — `EXPO_INCLUDE_*` truthiness = strict `"1"`/`"0"`; document empty-string = skip for string vars.
- §14 — update bin name to `react-native-expo-boilerplate`.
