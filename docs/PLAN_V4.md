# `react-native-expo-boilerplate` — Implementation Plan **v4**

**Date:** 2026-05-11
**Spec:** [SPEC.md](./SPEC.md)
**Supersedes:** [PLAN_V3.md](./PLAN_V3.md)
**Status:** Saved, not yet executed
**Revisions:** 2026-05-11 in-place patch — 4 blockers + 5 hygiene + 4 cleanups from v4-review applied (see "Revision log" at bottom).

Fixes 8 issues surfaced in v3 review + stale text. Decisions locked (carrying v3 + new):

| Topic | Decision |
|---|---|
| Bin name | `react-native-expo-boilerplate` |
| Fonts type | Object literal `as const` + `FontKey` |
| Assets path | Root `assets/` |
| Native deps | All via `npx expo install` |
| Babel patch | AST merge (`@babel/parser` + `traverse` + `generator`) |
| JSX-position sentinels | `{/* @@TOKEN@@ */}` |
| Module-position sentinels | `// @@TOKEN@@` |
| `react-native-screens` | Always-install |
| SPEC §10 provider tree | Drops `SafeAreaInsetsProvider` |
| **[NEW v4]** `@@MEDIA_CONSTANTS@@` always-handled | `patchConstants` runs unconditionally; no=empty, yes=snippet |
| **[NEW v4]** Fonts type-position grep scope | Whole `templates/base/**/*.{ts,tsx}` |
| **[NEW v4]** `expo install` cwd | Explicit `{ cwd: target }` |
| **[NEW v4]** MyRoster import rewriting | Dedicated Phase 4 task with alias mapping table |
| **[NEW v4]** Lockfile strategy | Detect PM once; pass `--npm` or `--yarn` to `expo install` |
| **[NEW v4]** `compilerOptions.baseUrl` | Phase 0 verifies; Phase 7 adds if missing |
| **[NEW v4]** `tsc --noEmit` step | Fully removed (was stale in v3 DoD + fix table) |

Phases mirror v3. `[CHANGED FROM V3]` and `[NEW v4]` markers preserved.

---

## Phase 0 — Package skeleton **[CHANGED FROM V3 — added baseUrl + babel-preset path verification]**

### Tasks

1. `mkdir react-native-expo-boilerplate && cd react-native-expo-boilerplate`
2. `npm init -y`. Edit `package.json`:
   - `"name": "react-native-expo-boilerplate"`
   - `"version": "0.1.0"`
   - `"type": "module"`
   - `"bin": { "react-native-expo-boilerplate": "./bin/cli.js" }`
   - `"files": ["bin/", "dist/", "templates/", "README.md", "LICENSE"]`
   - `"engines": { "node": ">=18" }`
3. devDeps: `typescript`, `tsx`, `@types/node`, `vitest`, `prettier`, `eslint`.
4. Runtime deps: `prompts`, `kleur`, `execa`, `fs-extra`, `@babel/parser`, `@babel/traverse`, `@babel/generator`, `@babel/types`.
5. `tsconfig.json`: `target ES2022`, `module NodeNext`, `outDir dist`, `strict true`.
6. `bin/cli.js` with error guard (same as v3). `chmod +x bin/cli.js`.
7. `src/index.ts` prints "hello from react-native-expo-boilerplate".
8. Scripts: `build`, `dev`, `test`.
9. `git init`, initial commit.
10. **[CHANGED]** Pre-exec verification (record in `docs/SDK_NOTES.md`):
    - Smoke: `npx create-expo-app smoke-test --template blank-typescript --no-install`.
    - **[FIX v4-r1]** Confirm target Expo SDK by reading **template-pinned version**: `jq -r '.dependencies.expo' smoke-test/package.json`. (Earlier `npm view create-expo-app version` returned CLI version, not the SDK shipped.)
    - Install just inspection tools standalone (no full smoke install): `cd smoke-test && yarn add --dev babel-preset-expo` to populate that package only. Then:
      ```bash
      find smoke-test/node_modules/babel-preset-expo -name "*.js" -print0 \
        | xargs -0 grep -l -E "react-native-(worklets|reanimated)/plugin"
      ```
      Record file path that contains the auto-inclusion.
    - **[NEW v4]** Verify `react-native-worklets` package name: `cd smoke-test && npx expo install react-native-worklets`. If errors "no version known," try `react-native-worklets-core`. Lock working name into Phase 7.
    - **[NEW v4]** Verify `expo/tsconfig.base` sets `compilerOptions.baseUrl`:
      ```bash
      cat smoke-test/node_modules/expo/tsconfig.base.json | jq '.compilerOptions.baseUrl'
      ```
      If `null` → Phase 7 step 3 must add `baseUrl: "."` alongside the `paths` merge.
    - **[NEW v4-r1]** Verify `expo install` PM flag support: `npx expo install --help | grep -E "(--yarn|--npm)"`. Record whether flags supported. If absent → Phase 7 step 2 uses lockfile-pre-seed fallback branch.
    - Verify `expo install` works with empty `node_modules`: create with `--no-install`, run `npx expo install --check`. If fails, swap order in Phase 7 (PM install first).

**Exit criterion:** `yarn build && node bin/cli.js` prints hello; `SDK_NOTES.md` records verified package names, preset behavior, baseUrl status.

---

## Phase 1 — CLI arg parsing + target dir resolution

Same as v3. No changes.

---

## Phase 2 — Interactive prompts **[CHANGED FROM V3 — PM detection added]**

### Tasks

1. `src/prompts.ts` `Answers` type — adds `packageManager`:
   ```ts
   type Answers = {
     primaryFont: string;
     secondaryFont: string;
     bottomSheet: boolean;
     imagePicker: boolean;
     packageManager: "yarn" | "npm";  // [NEW v4]
   };
   ```
2. `gatherAnswers()`:
   - Reads 4 `EXPO_*` env vars (booleans `"1"`/`"0"`, strings empty-allowed) — same as v3.
   - **[NEW v4]** Determines `packageManager`:
     - `EXPO_PACKAGE_MANAGER` env var (`"yarn"` or `"npm"`) — explicit override.
     - Else: detect `yarn --version` via `execa` try/catch. Found → `"yarn"`. Missing → `"npm"`.
     - Single PM choice flows through all install steps to avoid dual-lockfile.
   - Skip secondary if primary empty.
   - Missing + non-TTY → throw.
3. Wire into `src/index.ts`.
4. Tests:
   - Carry all v3 prompt cases (4 cases — env-all-set, primary-empty skips secondary, defaults, `EXPO_INCLUDE_BOTTOM_SHEET="yes"` throws).
   - **[NEW v4]** `EXPO_PACKAGE_MANAGER="yarn"` → `packageManager === "yarn"`.
   - **[NEW v4]** `EXPO_PACKAGE_MANAGER="pnpm"` → throws "expected yarn or npm".
   - **[NEW v4]** Yarn missing on PATH → fallback to `"npm"`.

**Exit criterion:** Manual + env-driven runs work; PM detected; tests green.

---

## Phase 3 — Wrap `create-expo-app`

Same as v3.

### Tasks

1. `runCreateExpoApp(dir, name)`: `npx --yes create-expo-app@latest <dir> --template blank-typescript --no-install` via `execa`.
2. `cleanupBlankTemplate(target)`: delete `<target>/App.tsx` only.
3. Smoke test.

**Exit criterion:** Shell exists, `App.tsx` deleted.

---

## Phase 4 — Template overlay **[CHANGED FROM V3 — explicit import-rewrite task + widened grep scope]**

### Placeholder conventions

Same as v3. Two sentinel forms (line comment vs JSX comment expression).

### Tasks

1. **[INLINED v4-r1]** `templates/base/` paths — `assets/` at project root (not `src/assets/`):
   - `assets/fonts/.gitkeep`
   - `assets/images/.gitkeep`
   - `assets/index.ts` (`export {};`)
   - `src/app/_layout.tsx` with 6 sentinels (mixed `//` + `{/* */}` forms per "Placeholder conventions" above).
   - `src/app/routes.tsx` (dummy Stack).
   - `src/app/index.tsx` (Hello World via `AppWrapper` + `AppText`).
   - `src/core/hooks/.gitkeep`
   - `src/core/redux/` (5 files; userSlice dummy).
   - `src/core/services/.gitkeep`
   - `src/core/tanstack/` (`index.tsx` + `tanstack-keys.ts`).
   - `src/core/utils/`: `config.ts`, `endpoints.ts`, `types.ts`, `validation.ts`, `constants.ts` with `// @@MEDIA_CONSTANTS@@`.
   - `src/features/.gitkeep`
   - `src/ui/appComponents/` (24 primitives + modals — see SPEC §6.1).
   - `src/ui/components/errorFallback/index.tsx`.
   - `src/ui/iconComponents/` (7 wrappers — see SPEC §6.2).
   - `src/ui/theme/`: `colors.ts`, `responsive.ts`, `allFileStyles.ts`, `fonts.ts` with `// @@FONTS_ENUM@@`.
2. Provider tree in `_layout.tsx` (drops `SafeAreaInsetsProvider`):
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
3. **[NEW v4]** `src/overlay.ts::rewriteImports(filePath, aliasMap)`:
   - Reads file, replaces import specifiers per `aliasMap`.
   - Regex: `/from\s+["']([^"']+)["']/g` → if specifier starts with any source alias, swap prefix for target alias.
   - Idempotent.
4. **[NEW v4]** MyRoster → PLAN_V4 alias mapping table (record actuals during mirror step in `docs/MIRROR_NOTES.md`):
   | MyRoster alias (assumed) | PLAN_V4 alias |
   |---|---|
   | `@/theme/*` | `@theme/*` |
   | `@/utils/*` | `@utils/*` |
   | `@/redux/*` | `@redux/*` |
   | `@/core/*` | `@core/*` |
   | `@/services/*` | `@services/*` |
   | `@/hooks/*` | `@hooks/*` |
   | `@/appComponents/*` | `@appComponents/*` |
   | `@/components/*` | `@components/*` |
   | `@/icons/*` | `@icons/*` |
   | `@/features/*` | `@features/*` |
   | `@/assets` | `@assets` |
   | bare `../` relative imports crossing src boundaries | flagged for manual review |
   Mapping confirmed by inspecting MyRoster source before mirror; table updated in `MIRROR_NOTES.md` per actual aliases found.
5. **[CHANGED v4-r1]** Mirror step — for each MyRoster source copied into `templates/base/`:
   - Run `rewriteImports` with the mapping table.
   - **[FIX v4-r1]** Verify zero MyRoster-specific prefixes remain. `@/*` IS a legitimate V4 catchall alias — DO NOT ban it. Grep specifically for the left-column patterns expected to have been rewritten:
     ```bash
     PATTERNS='@/theme/|@/utils/|@/redux/|@/core/|@/services/|@/hooks/|@/appComponents/|@/components/|@/icons/|@/features/|@/assets'
     find templates/base \( -name "*.ts" -o -name "*.tsx" \) -print0 \
       | xargs -0 grep -nE "from ['\"]($PATTERNS)" \
       && echo "FAIL: unmapped MyRoster prefix remains" && exit 1
     ```
     (POSIX `find`+`xargs` — avoids bash/zsh-only brace expansion that fails silently in `sh`/`dash`.)
     Bare `@/<arbitrary>` imports allowed (resolve via `@/*` → `src/*` catchall).
6. `src/overlay.ts::copyTemplate(srcRoot, destRoot)`, `applyBase(target, answers)` — same as v3.
7. `src/patch.ts::patchAppJson(target, name, answers)`:
   - `expo.scheme` = slug of `name`.
   - `expo.plugins` ensure-array, add `"expo-router"` if missing.
8. `src/patch.ts::patchExpoRouterEntry(target)`:
   - `<target>/package.json` `main` = `"expo-router/entry"`.
   - Verify `tsconfig.json` extends `expo/tsconfig.base`; add if missing.
9. Wire after `runCreateExpoApp`.
10. **[CHANGED v4-r1]** Fonts type-position audit — POSIX-safe find:
    ```bash
    find templates/base \( -name "*.ts" -o -name "*.tsx" \) -print0 \
      | xargs -0 grep -nE ':\s*Fonts\b|<Fonts>|Fonts\s*\['
    ```
    Rewrite matches to `FontKey` or `(typeof Fonts)[keyof typeof Fonts]`. Document result in commit.

**Exit criterion:** Files present at correct paths; expo-router entry + plugin + scheme configured; `App.tsx` gone; imports rewritten; `Fonts` type-position audit complete; zero MyRoster-specific prefixes remaining in mirrored files.

---

## Phase 5 — Conditional overlays **[CHANGED FROM V3 — `patchConstants` always runs + r1 audits conditional templates]**

### Tasks

0. **[NEW v4-r1]** Rerun MyRoster audit on `templates/bottom-sheet/` + `templates/image-picker/` (same logic as Phase 4 steps 5 + 10, scoped to these dirs). Bug surfaces only when user picks yes if these dirs skip the audit. Run during template authoring (one-time), not per-CLI-invocation:
   ```bash
   for DIR in templates/bottom-sheet templates/image-picker; do
     find "$DIR" \( -name "*.ts" -o -name "*.tsx" \) -print0 \
       | xargs -0 grep -nE "from ['\"]($PATTERNS)|:\s*Fonts\b|<Fonts>|Fonts\s*\[" \
       && echo "FAIL: audit failed in $DIR" && exit 1
   done
   ```
1. `templates/bottom-sheet/` — 5 App* components.
2. `templates/image-picker/`:
   - `src/core/services/PermissionService.ts`.
   - `media-constants.snippet.ts` — text spliced into `constants.ts`.
3. `src/overlay.ts`:
   - `applyBottomSheet(target)` if `answers.bottomSheet`.
   - `applyImagePicker(target)` copies `PermissionService.ts` if `answers.imagePicker`.
4. **[NEW v4]** `src/patch.ts::patchConstants(target, answers)` — **always runs** (regardless of `imagePicker`):
   - Reads `<target>/src/core/utils/constants.ts`.
   - Replaces `// @@MEDIA_CONSTANTS@@`:
     - If `answers.imagePicker` → snippet from `templates/image-picker/media-constants.snippet.ts`.
     - Else → empty (drop sentinel line; no orphan blank).
   - Fixes v3 orphan-sentinel bug where picker=no left `@@MEDIA_CONSTANTS@@` in output.
5. `src/patch.ts::patchAppJsonPlugins(target, answers)`:
   - If `answers.imagePicker` push image-picker plugin entry (idempotent).
6. Wire `applyBottomSheet` → `applyImagePicker` → `patchConstants` → `patchAppJsonPlugins` after `applyBase`.

**Exit criterion:**
- picker yes: snippet spliced; plugin entry present.
- picker no: constants file has clean tail (no sentinel, no orphan blank); no plugin entry.
- Both verified by `! grep -rq "@@" <target>` (zero `@@` substrings anywhere, assuming Phase 6 also done).

---

## Phase 6 — Fonts generation + sentinel replacement

Same as v3. (`patchLayout` handles `_layout.tsx` + `fonts.ts` sentinels; `patchConstants` from Phase 5 handles `constants.ts`.)

### Tasks

1. `src/fonts.ts::generateFontsObject(primary, secondary)` — object literal `as const` + `FontKey` (per v3).
2. `generateUseFontsBlocks(primary, secondary)` — 3 strings (per v3).
3. `generateBottomSheetProviderBlocks(bottomSheet)` — 3 strings (per v3).
4. `src/patch.ts::patchLayout(target, answers)`:
   - `src/ui/theme/fonts.ts`: replace `// @@FONTS_ENUM@@`.
   - `src/app/_layout.tsx`: replace 6 sentinels (mixed `//` + `{/* */}`).
   - Empty replacements drop whole line.
5. Tests as v3 + assertion: `! grep -rq "@@" <output>` (zero `@@` tokens anywhere in generated project) for all combinations.

**Exit criterion:** Zero `@@PLACEHOLDER@@` tokens in generated project under any combination.

---

## Phase 7 — `package.json` / `tsconfig.json` / `babel.config.js` patching **[CHANGED FROM V3 — explicit cwd, baseUrl, PM flag]**

### Tasks

1. `src/patch.ts::patchPackageJsonScripts(target)`:
   - Scripts: `start`, `android`, `ios`, `web`, `lint` (per v3).
   - Preserve `main: "expo-router/entry"` + `expo` key + all create-expo-app-set keys.
2. **[CHANGED v4-r1]** `src/install.ts::installNativeDeps(target, answers)`:
   - **PM enforcement branch (per Phase 0 step 10 verification of `--yarn`/`--npm` flag support):**
     - **Branch A (flags supported):** `pmFlag = answers.packageManager === "yarn" ? "--yarn" : "--npm"`. Pass as final arg.
     - **Branch B (flags absent in installed `@expo/cli`):** pre-seed empty lockfile of chosen PM in `<target>`, then run `expo install` without flag — Expo CLI auto-detects PM from lockfile presence:
       ```ts
       if (answers.packageManager === "yarn") fs.writeFileSync(path.join(target, "yarn.lock"), "");
       else fs.writeFileSync(path.join(target, "package-lock.json"), "{}");
       ```
   - Runs:
     ```
     npx --yes expo install <deps...> [<pmFlag>]
     ```
     via `execa("npx", [...], { cwd: target, stdio: "inherit" })` — **cwd explicit**.
   - Always-installed list (per SPEC §7): `@reduxjs/toolkit react-redux redux-persist react-native-mmkv @tanstack/react-query axios formik yup expo-router expo-dev-client react-native-safe-area-context react-native-gesture-handler react-native-screens react-native-reanimated react-native-worklets react-native-keyboard-controller react-error-boundary react-native-responsive-fontsize @expo/vector-icons @shopify/flash-list`.
     - Substitute `react-native-worklets-core` if Phase 0 verification picked the other name.
   - If `answers.bottomSheet`: append `@gorhom/bottom-sheet` to the same `expo install` call (single invocation).
   - If `answers.imagePicker`: append `expo-image-picker`.
   - Single `expo install` call → single PM resolution pass → no dual-lockfile.
   - **[NEW v4-r1]** On atomic failure (any dep version resolution fails): retry deps one-at-a-time and report which broke. Debugging aid — doesn't change exit code; still aborts.
3. **[CHANGED v4]** `src/patch.ts::patchTsconfig(target)`:
   - Read existing tsconfig; preserve `extends: "expo/tsconfig.base"`.
   - **[NEW v4]** If Phase 0 verified `baseUrl` is unset in `expo/tsconfig.base`: set `compilerOptions.baseUrl = "."`. Else leave alone.
   - Merge `compilerOptions.paths` with SPEC §9 aliases.
   - Detect `@/*` collision; override + warn.
4. `src/patch.ts::patchBabel(target)` — AST merge (per v3):
   - Parse `babel.config.js` via `@babel/parser`.
   - Locate returned `ObjectExpression`; ensure `plugins` array; push `["module-resolver", { alias: <map> }]` (idempotent).
   - **Worklets plugin handling** (per Phase 0 verification):
     - Auto-included → no-op.
     - Not auto-included → append worklets plugin as **last** entry.
   - On parse fail → explicit abort.
5. Tests:
   - `patchPackageJsonScripts`: scripts present, `main` survives, `expo` key survives.
   - `patchTsconfig`: paths merged, `extends` preserved, `baseUrl` set when needed, collision warning emitted.
   - `patchBabel`: snapshot test against current create-expo-app fixture; idempotent rerun.
6. Manual smoke.

**Exit criterion:** Tests green; manual inspection passes; single lockfile produced (`yarn.lock` OR `package-lock.json`, not both).

---

## Phase 8 — Lockfile verification + success message **[CHANGED FROM V3 — install command picks PM, no dual-lockfile]**

### Tasks

1. **[RENAMED v4-r1]** `src/install.ts::verifyLockfile(target, answers)` (was `runFinalInstall` — name misleading; this no longer installs):
   - `expo install` in Phase 7 step 2 already installed via chosen PM. No additional install needed.
   - Assert exactly one of (`yarn.lock`, `package-lock.json`) exists in `<target>`:
     - Zero → error: install failed silently. Abort.
     - Two → delete the non-chosen PM's lockfile + warn user (expected single lockfile, found both).
     - One matching `answers.packageManager` → OK.
     - One mismatching → warn but accept (PM flag may have been ignored by Expo CLI version).
2. Final message:
   - Green checkmark.
   - `cd <dir>`.
   - `npx expo prebuild` reminder.
   - `<pm> ios` / `<pm> android` (substitute `yarn` or `npm run`).
   - Link to README "Adding fonts" if primary font provided.
   - Link to README "First-time dev-client build".

**Exit criterion:** End-to-end `node bin/cli.js test-app` → `npx expo prebuild && yarn ios` (or `npm run ios`) succeeds. Single lockfile present.

---

## Phase 9 — Claude Code slash command

Same as v3 + PM passthrough.

### Tasks

1. `templates/claude-command/init-app.md`:
   - Body uses `AskUserQuestion` for: app name, target dir, 4 prompt answers, **[NEW v4]** PM choice.
   - Env var string includes `EXPO_PACKAGE_MANAGER`:
     ```bash
     EXPO_PRIMARY_FONT="" EXPO_SECONDARY_FONT="" \
       EXPO_INCLUDE_BOTTOM_SHEET="0" EXPO_INCLUDE_IMAGE_PICKER="0" \
       EXPO_PACKAGE_MANAGER="yarn" \
       npx react-native-expo-boilerplate <dir>
     ```
2. README install section.
3. Manual test.

**Exit criterion:** `/init-app` prompts user, produces working project with chosen PM.

---

## Phase 10 — Documentation + publishing

Same as v3.

---

## Summary of v3 → v4 fixes

| # | v3 issue | v4 fix |
|---|----------|--------|
| 1 | `@@MEDIA_CONSTANTS@@` orphan when picker=no | Phase 5 step 4: `patchConstants` always runs; empty → drop line. |
| 2 | `Fonts` type-position grep scope only `appComponents/` | Phase 4 step 10: widened to `templates/base/**/*.{ts,tsx}`. |
| 3 | `expo install` cwd unspecified | Phase 7 step 2: explicit `execa(..., { cwd: target })`. |
| 4 | MyRoster import rewriting referenced but no task | Phase 4 steps 3–5: explicit alias mapping table + `rewriteImports` + post-mirror grep verification. |
| 5 | Dual-lockfile risk | Phase 2 detects PM once; Phase 7 step 2 passes `--yarn`/`--npm` flag; Phase 8 verifies single lockfile. |
| 6 | Stale `tsc --noEmit` refs (v2→v3 table row 8 + DoD) | Removed from DoD + fix-summary table. |
| 7 | `babel-preset-expo/src/index.js` path likely wrong | Phase 0 step 10: `find ... -name "*.js" \| xargs grep -l` instead of hardcoded path. |
| 8 | `compilerOptions.baseUrl` not handled | Phase 0 step 10 verifies; Phase 7 step 3 sets `baseUrl: "."` if missing. |

---

## Risks + mitigations (carried from v3 + new)

Carried as v3. New:

| Risk | Mitigation |
|------|------------|
| **[NEW v4]** MyRoster source uses unknown/unmapped alias prefix | Phase 4 step 5 grep catches `@/` remainders; abort + manual fix step. |
| **[NEW v4]** `expo install --yarn` / `--npm` flag not supported in installed Expo CLI | Phase 0 step 10 verifies; Phase 7 step 2 Branch B handles fallback inline (pre-seed empty lockfile). |
| **[NEW v4]** User has both yarn + npm but wants a specific one not auto-detected | `EXPO_PACKAGE_MANAGER` env var override (Phase 2). |
| **[NEW v4]** `baseUrl` already set by user-modified tsconfig | Phase 7 step 3 reads existing value; only sets if absent. |

---

## Definition of done (v1 ship)

- All 10 phases complete.
- Unit + smoke tests green in CI (Node 18 + 20).
- Generated project boots via `yarn ios` / `yarn android` (or `npm run`) after `npx expo prebuild`.
- Single lockfile per generated project.
- Zero `@@TOKEN@@` placeholders in generated output.
- Zero MyRoster-specific prefixes (`@/theme/`, `@/utils/`, etc.) remain in mirrored sources. (Bare `@/<anything>` allowed — catchall alias.)
- Published to npm under `react-native-expo-boilerplate`.
- Slash command + README sections shipped.

---

## SPEC.md edits

Applied in same pass as PLAN_V4 write — SPEC now consistent with V4 decisions (fonts object, paths, EXPO_PACKAGE_MANAGER, single-lockfile invariant, prebuild smoke flow, `@@TOKEN@@` sentinel naming).

---

## Revision log

### v4-r1 (2026-05-11 in-place patch)

Applied after v4 review surfaced 4 blockers + 5 hygiene + cleanups.

**Blockers fixed:**
- Phase 4 step 5: grep no longer false-positives on legitimate `@/*` catchall; pattern list restricted to MyRoster left-column prefixes.
- Phase 7 step 2: PM-flag fallback (Branch B) inlined as explicit conditional; was buried in risks table.
- Phase 0 step 10: SDK version detection corrected — reads `<smoke>/package.json` `dependencies.expo` instead of `npm view create-expo-app version`.
- Phase 5 step 0: new pre-overlay audit covers `templates/bottom-sheet/` + `templates/image-picker/` (mirrored MyRoster sources missed by Phase 4 scope).

**Hygiene fixes:**
- Line 126: "CHANGED FROM V4" → "CHANGED FROM V3".
- Phase 8: function renamed `runFinalInstall` → `verifyLockfile`; dangling `--skip-expo-install-as-final` flag dropped.
- Phase 4 steps 5 + 10: brace expansion `**/*.{ts,tsx}` replaced with POSIX `find -name`+`xargs -0` — survives `sh`/`dash`.
- Phase 4 step 1: full file list inlined (was "(per v3)" cross-ref).
- Phase 0 step 10: babel-preset inspection path committed — install `babel-preset-expo` standalone.

**Cleanups:**
- Phase 5 exit criterion: `grep -c` → `! grep -rq` (project-wide check).
- Phase 2 step 4: clarified test count.
- Phase 7 step 2: atomic-failure retry-one-at-a-time debugging aid added.
- DoD: `@/` wording refined — bare catchall allowed, only MyRoster-specific prefixes banned.
