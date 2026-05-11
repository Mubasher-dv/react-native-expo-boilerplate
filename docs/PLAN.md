# `@codingpixel/create-expo-app` — Implementation Plan

**Date:** 2026-05-11
**Spec:** [SPEC.md](./SPEC.md)
**Status:** Saved, not yet executed

This plan breaks v1 into phases. Each phase ends with a green test pass before moving on.

---

## Phase 0 — Package skeleton

**Goal:** Project compiles, publishes a dummy CLI that prints "hello".

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
4. Add runtime deps: `prompts`, `kleur` (colors), `execa` (subprocess), `fs-extra`.
5. Add `tsconfig.json` with `target: ES2022`, `module: NodeNext`, `outDir: dist`, `strict: true`.
6. Create `bin/cli.js`:
   ```js
   #!/usr/bin/env node
   import("../dist/index.js");
   ```
   `chmod +x bin/cli.js`.
7. Create `src/index.ts` printing "hello from @codingpixel/create-expo-app".
8. Add `scripts.build` (`tsc`), `scripts.dev` (`tsx src/index.ts`), `scripts.test` (`vitest`).
9. `git init`, initial commit.

**Exit criterion:** `yarn build && node bin/cli.js` prints hello.

---

## Phase 1 — CLI argument parsing + target directory resolution

**Goal:** `npx . my-app`, `npx . .`, and `npx .` (no arg) all resolve the correct target dir and refuse conflicts.

### Tasks

1. `src/util.ts` — small helpers: `isDirEmpty(path)`, `ensureDir(path)`, `log(message)`.
2. `src/bootstrap.ts` — export `resolveTargetDir(arg?: string): Promise<string>`:
   - If `arg === "."` → return `process.cwd()` if no `package.json` exists, else throw.
   - If `arg` non-empty → return `path.join(process.cwd(), arg)` after `mkdir`. Throw if non-empty.
   - If `arg` empty → run a `prompts` text question "App name?".
3. `src/index.ts` — parse `process.argv[2]`, call `resolveTargetDir`, log result.
4. Unit tests in `src/__tests__/bootstrap.test.ts`:
   - Returns cwd for `.` when empty.
   - Throws for `.` when `package.json` exists.
   - Creates and returns sibling dir for `my-app`.
   - Throws for non-empty `my-app`.

**Exit criterion:** All three invocation modes produce expected absolute paths in a sandbox; tests green.

---

## Phase 2 — Interactive prompts

**Goal:** All 4 prompts (§5 of spec) gather answers correctly; env vars override.

### Tasks

1. `src/prompts.ts` — define answer type `Answers`:
   ```ts
   type Answers = {
     primaryFont: string;       // "" if skipped
     secondaryFont: string;     // "" if skipped (or primary skipped)
     bottomSheet: boolean;
     imagePicker: boolean;
   };
   ```
2. Export `async function gatherAnswers(): Promise<Answers>`:
   - Read `EXPO_PRIMARY_FONT` / `EXPO_SECONDARY_FONT` / `EXPO_INCLUDE_BOTTOM_SHEET` / `EXPO_INCLUDE_IMAGE_PICKER` from `process.env`. If all present, return without prompting.
   - Otherwise use `prompts` library for missing ones, in order.
   - Skip secondary-font prompt if primary is empty.
   - If non-TTY and any missing, throw a clear error pointing at the env vars.
3. Wire into `src/index.ts`.
4. Unit tests with mocked `prompts` lib + `process.env`:
   - All four env vars set → no prompts.
   - Primary empty → secondary not asked.
   - Bottom-sheet/image-picker default = no.

**Exit criterion:** Manual run prompts correctly; env-driven non-interactive mode works; tests green.

---

## Phase 3 — Wrap `create-expo-app`

**Goal:** CLI invokes `create-expo-app` and produces a working Expo project before any overlay.

### Tasks

1. `src/bootstrap.ts` — add `runCreateExpoApp(dir, name)`:
   - Run `npx create-expo-app@latest <dir> --template blank-typescript --no-install` via `execa`, inherit stdio.
   - Surface errors clearly.
2. Call after `resolveTargetDir` in `src/index.ts`.
3. Manual smoke test: `node bin/cli.js test-output` produces a runnable Expo project (no install yet).

**Exit criterion:** `cd test-output && yarn && yarn start` boots Metro on the unmodified Expo template.

---

## Phase 4 — Template overlay (static files)

**Goal:** All unconditional files from §6 layout land in the target dir without errors.

### Tasks

1. `templates/base/` — populate with mirrored MyRoster sources, paths rooted at `<target>/`. Includes:
   - `src/app/_layout.tsx` (with `__USE_FONTS__` and `__BOTTOM_SHEET_PROVIDER__` placeholders)
   - `src/app/routes.tsx` (dummy Stack)
   - `src/app/index.tsx` (Hello World)
   - `src/assets/` skeleton
   - `src/core/hooks/.gitkeep`
   - `src/core/redux/` (5 files; userSlice with dummy shape)
   - `src/core/services/.gitkeep`
   - `src/core/tanstack/` (2 files: `index.tsx` mirroring MyRoster's QueryClient + provider + wrappers in a single file; `tanstack-keys.ts` with dummy `example` key)
   - `src/core/utils/config.ts`, `endpoints.ts`, `types.ts`, `validation.ts` (loginValidationSchema only)
   - `src/core/utils/constants.ts` (with `__MEDIA_CONSTANTS__` placeholder block)
   - `src/features/.gitkeep`
   - `src/ui/appComponents/` (24 primitives + modals; see spec §6.1)
   - `src/ui/components/.gitkeep`
   - `src/ui/components/errorFallback/index.tsx` (seeded)
   - `src/ui/iconComponents/` (7 wrappers)
   - `src/ui/theme/colors.ts` (PRIMARY + SECONDARY)
   - `src/ui/theme/responsive.ts` (verbatim)
   - `src/ui/theme/allFileStyles.ts` (`StyleSheet.create({})`)
   - `src/ui/theme/fonts.ts` placeholder (`__FONTS_ENUM__`)
2. `src/overlay.ts`:
   - `copyTemplate(srcRoot, destRoot)` walks files, copies each. Files containing placeholders are read, replaced, written.
   - `applyBase(target, answers)` copies `templates/base/` into target.
3. Wire `applyBase` after `runCreateExpoApp` in `src/index.ts`.
4. Manual smoke test: every file lands; placeholders still in for now (next phase replaces them).

**Exit criterion:** All listed files present in `test-output/`; structure matches spec §6.

---

## Phase 5 — Conditional overlays

**Goal:** Bottom-sheet and image-picker bundles apply only when chosen.

### Tasks

1. `templates/bottom-sheet/` — 5 App* components + a small marker file used by `patch.ts` to know whether to insert `BottomSheetModalProvider` into `_layout.tsx`.
2. `templates/image-picker/`:
   - `src/core/services/PermissionService.ts`
   - `media-constants.snippet.ts` — text block to splice into `constants.ts`
3. `src/overlay.ts`:
   - `applyBottomSheet(target)` copies the 5 components if `answers.bottomSheet`.
   - `applyImagePicker(target)` copies `PermissionService.ts` and splices media constants into `constants.ts`.
4. Wire both into `src/index.ts`.

**Exit criterion:** With both = yes, files present. With both = no, neither directory exists; constants file has no media block.

---

## Phase 6 — Fonts generation + `_layout.tsx` placeholder replacement

**Goal:** `fonts.ts` and `_layout.tsx` placeholders resolve correctly per all four prompt combinations.

### Tasks

1. `src/fonts.ts`:
   - `generateFontsEnum(primary: string, secondary: string): string` returning the full `export const enum Fonts { ... }` body.
   - Empty primary → 9 keys with `""` values.
   - Primary only → 9 keys with primary-prefixed values.
   - Primary + secondary → 18 keys (9 bare + 9 prefixed).
   - Helpers: `enumKey(family, weight)`, `enumValue(family, weight)` — handle spaces (strip spaces in value, snake_upper in key).
2. `generateUseFontsBlock(primary, secondary): string`:
   - Empty primary → `""` (no block).
   - Otherwise → `const [fontsLoaded, fontError] = useFonts({ ... });` plus the early-return guard and `expo-font` import.
3. `generateBottomSheetProviderBlock(bottomSheet): { import, jsxOpen, jsxClose }`:
   - If yes → import + open/close lines.
   - Else → all empty strings.
4. `src/patch.ts` orchestrates:
   - Reads `src/ui/theme/fonts.ts`, replaces `__FONTS_ENUM__` with `generateFontsEnum(...)`.
   - Reads `src/app/_layout.tsx`, replaces `__USE_FONTS__`, `__USE_FONTS_GUARD__`, `__BOTTOM_SHEET_PROVIDER_IMPORT__`, `__BOTTOM_SHEET_PROVIDER_OPEN__`, `__BOTTOM_SHEET_PROVIDER_CLOSE__`.
   - Reads `src/core/utils/constants.ts`, replaces `__MEDIA_CONSTANTS__` with either the spliced block or `""`.
5. Unit tests:
   - `generateFontsEnum` for 4 cases.
   - Patcher replaces all placeholders with no stray `__` strings remaining.

**Exit criterion:** No `__PLACEHOLDER__` tokens left in generated project for any combination of answers; tests green.

---

## Phase 7 — `package.json` / `tsconfig.json` / `babel.config.js` patching

**Goal:** Aliases work, all deps installed, scripts present.

### Tasks

1. `src/patch.ts`:
   - `patchPackageJson(target, answers)`:
     - Merge always-installed deps from a static list.
     - If `answers.bottomSheet` add `@gorhom/bottom-sheet`.
     - If `answers.imagePicker` add `expo-image-picker`.
     - Add `lint` script and `expo` scripts if missing.
   - `patchTsconfig(target)` — add `compilerOptions.paths` from spec §9.
   - `patchBabel(target)` — write `babel.config.js` with `module-resolver` plugin (or merge if `create-expo-app` produced one).
2. Unit tests:
   - Each patch produces expected JSON keys.
   - No keys lost from the original file.
3. Manual smoke: open generated `tsconfig.json` — paths present; `package.json` — deps present.

**Exit criterion:** Tests green; manual inspection passes.

---

## Phase 8 — Install + success message

**Goal:** `yarn install` (with npm fallback) succeeds, CLI reports next steps.

### Tasks

1. `src/install.ts`:
   - Detect `yarn` via `which yarn` (use `execa` + try/catch).
   - Prefer `yarn install`, fallback `npm install`.
   - Inherit stdio so user sees progress.
2. Wire into `src/index.ts` after patches.
3. Print final message: green checkmark, `cd <dir>`, `yarn start`, link to README.

**Exit criterion:** `node bin/cli.js test-app` end-to-end produces a runnable project where `yarn start` boots Metro.

---

## Phase 9 — Claude Code slash command

**Goal:** `.claude/commands/init-app.md` works when copied into a Claude Code workspace.

### Tasks

1. Author `templates/claude-command/init-app.md`:
   - Frontmatter: `description: "Bootstrap a new Expo app via @codingpixel/create-expo-app"`.
   - Body: instructs Claude to use `AskUserQuestion` for each of the 4 prompts (plus app name + target dir), then runs `npx @codingpixel/create-expo-app` with the 4 `EXPO_*` env vars set non-interactively.
2. Document in README how to install (copy file into `.claude/commands/`).
3. Manual test in this repo's `.claude/commands/` folder.

**Exit criterion:** Running `/init-app` in Claude Code prompts user and produces a working project.

---

## Phase 10 — Documentation + publishing

**Goal:** Ship to npm.

### Tasks

1. Write `README.md` per spec §15.
2. Add `LICENSE` (MIT).
3. Configure `prepublishOnly` script: `yarn build && yarn test`.
4. Verify scoped publishing: `npm publish --access public`.
5. Tag release: `git tag v0.1.0 && git push --tags`.

**Exit criterion:** `npx @codingpixel/create-expo-app new-project` works from anywhere.

---

## Risks + mitigations

| Risk | Mitigation |
|------|------------|
| `create-expo-app` flags change | Pin to a specific major in spawned command; bump intentionally per CLI release. Smoke-test the wrapper in CI on every Expo SDK bump. |
| Mirrored App* components reference MyRoster-specific paths | Phase 4 task includes import rewriting; add a regex-based audit step that fails build if any mirrored file imports something outside `@theme`, `@appComponents`, `@components`, `@icons`, `@core`, `@utils`, `@hooks`, `@assets`, `@/*`, or a node_module. |
| Font file expectations create silent runtime failures | README explicitly documents that user must drop `.ttf` files into `assets/fonts/` matching enum values; `useFonts` swallows missing files but Metro logs the issue. |
| Patches collide with future `create-expo-app` template changes | Patches use JSON manipulation (not string replacement) on `package.json`/`tsconfig`. `babel.config.js` is fully rewritten — diff against upstream on each Expo upgrade to confirm nothing else gets clobbered. |
| Scoped package publish needs `--access public` | Bake into `prepublishOnly` or document loudly in `CONTRIBUTING.md`. |

## Definition of done (v1)

- All 10 phases complete.
- Unit + smoke tests green in CI.
- Package published to npm under `@codingpixel/create-expo-app`.
- Slash command available + documented.
- README covers the full prompt walkthrough, generated structure, and future-work roadmap.
