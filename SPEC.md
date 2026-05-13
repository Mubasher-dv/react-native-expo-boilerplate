# `react-native-expo-boilerplate` — Design Spec

**Date:** 2026-05-11
**Status:** Approved, awaiting implementation plan
**Owner:** CodingPixel
**Active plan:** [PLAN_V5.md](./PLAN_V5.md)
**Last revised:** 2026-05-11 (aligned with PLAN_V5 v5-r4 decisions)

---

## 1. Purpose

Scoped npm CLI package that bootstraps an opinionated Expo TypeScript project with:

- MVVM feature module structure
- App* component library (primitives + modals; optional bottom-sheet)
- Pre-wired global stack: Redux Toolkit + redux-persist + MMKV, TanStack Query v5 + Axios, Formik + Yup, Expo Router v6
- Themed UI (colors enum, fonts object-literal `as const`, responsive helpers, shared stylesheet)
- Path aliases (`@features/*`, `@appComponents/*`, etc.)
- ErrorBoundary baseline

A companion Claude Code slash command wraps the CLI for in-editor usage.

The CLI's bootstrap step always invokes `npx create-expo-app@latest` under the hood so the user automatically inherits the latest Expo SDK + base config.

## 2. Non-goals (v1)

- Sub-commands (`generate feature`, `generate screen`, etc.) — planned for v2. v1 scaffolds the project once, end of story.
- Re-implementing Expo bootstrap. The CLI overlays on top of `create-expo-app`'s output.
- Demo features inside `src/features/`. Always empty at init.
- Demo screens beyond a single Hello World index.
- Cross-platform install detection beyond yarn → npm fallback.
- Plugin system, theming presets beyond two prompted font families and a two-color palette.

## 3. CLI invocation

```bash
npx react-native-expo-boilerplate my-app   # mkdir ./my-app/ then populate
npx react-native-expo-boilerplate .         # populate current directory
npx react-native-expo-boilerplate           # prompts user for app name
```

Mirrors the `create-expo-app` UX. No flags in v1 (everything is interactive).

## 4. Bootstrap flow

1. Parse positional arg → resolve target directory.
   - If a name was given, create `<cwd>/<name>/`. Refuse if non-empty.
   - If `.` was given, accept `cwd`. Refuse if any conflicting file (e.g. `package.json`) already exists.
   - Reject absolute paths and `..`-traversal with clear error.
   - If empty, prompt: "App name?"
2. Run `npx --yes create-expo-app@latest <dir> --template blank-typescript --no-install`. Inherit Expo SDK version exactly as Expo ships it. Skip install so we can patch `package.json` first. `--yes` forces fresh fetch (skip stale globals).
3. Delete `<target>/App.tsx` (blank-typescript ships it; collides with expo-router auto-detection of `src/app/`).
4. Run interactive prompts (§5) to gather user choices.
5. Overlay templates onto the freshly created project (§6 layout).
6. Patch `app.json` (`expo.scheme` + `expo.plugins`), `package.json` (`main: "expo-router/entry"` + scripts), `tsconfig.json` (`compilerOptions.paths`), `babel.config.js` (module-resolver alias plugin via AST merge).
7. Run `npx expo install <dep ...>` for all native deps (SDK-correct versions resolved automatically) with PM flag (Branch A) or pre-seeded lockfile fallback (Branch B) per Phase 0 verification (PLAN_V5 Phase 0 step 10 `FLAGS_OK` outcome). Run explicit `yarn install` / `npm install` only if Phase 0 lockfile-materialization probe failed (`PROBE_PASS=0`); otherwise `expo install` materializes the lockfile itself.
8. Print success message + next steps: `cd <dir>`, `npx expo prebuild`, then `yarn ios` / `yarn android`. **Expo Go is not compatible** (native modules require dev-client).

## 5. Interactive prompts

Asked in order. Defaults shown in parentheses.

| # | Prompt | Type | Effect |
|---|--------|------|--------|
| 1 | `Primary font family name? (skip to leave empty)` | string \| empty | If provided, fills weight values in `Fonts` object (`BOLD: "<Primary>-Bold"`, …). If empty, keys exist with `""` values. |
| 2 | `Secondary font family name? (optional)` — **only asked if #1 answered** | string \| empty | Adds prefixed entries: `<UPPER_SNAKE>_BOLD: "<Secondary>-Bold"`, etc. If empty or skipped, no secondary entries. |
| 3 | `Include bottom-sheet support? (y/N)` | yes/no | If yes: install `@gorhom/bottom-sheet`; copy 5 bottom-sheet App* components; wrap `_layout.tsx` with `BottomSheetModalProvider`. If no: skip all three. |
| 4 | `Include image picker support? (y/N)` | yes/no | If yes: install `expo-image-picker`; create `core/services/PermissionService.ts`; append media constants (`MEDIA_TYPES`, `MEDIA_CAMERA_TYPES`, `MEDIA_GALLERY_TYPES`) to `constants.ts`. If no: leave `core/services/` empty and omit media constants. |

### 5.1 Font naming rules

`fonts.ts` exports a `Fonts` **object literal** typed `as const` (not a TS `enum` — `const enum` is stripped by `babel-preset-expo` and fails under `isolatedModules: true`). Also exports `FontKey = keyof typeof Fonts`.

For a family name `<Family>`:

- Object key: uppercase + underscore-separated (`Open Sans` → `OPEN_SANS`).
- Object value: family with spaces stripped, suffixed by weight (`Open Sans` → `OpenSans-Bold`).

Weights covered: `BOLD`, `EXTRA_BOLD`, `MEDIUM`, `REGULAR`, `SEMI_BOLD`, `ITALIC`, `LIGHT`, `THIN`, `EXTRA_LIGHT`.

For the **primary** family the keys are the bare weight names (`BOLD`, `MEDIUM`, …). For the **secondary** family the keys are prefixed (`INTER_BOLD`, `INTER_MEDIUM`, …).

If primary is empty, all keys exist with `""` values, secondary is not asked.

### 5.2 `useFonts` integration

`src/app/_layout.tsx` includes a `useFonts({...})` call mapping each generated `Fonts` value to a `require("../../assets/fonts/<value>.ttf")` (resolves to `<target>/assets/fonts/<value>.ttf` — `assets/` lives at project root, NOT under `src/`). The call is generated only if the primary family was provided. If primary is empty the `useFonts` block, its loading guard, and the `expo-font` import are all omitted — the user is expected to add fonts manually later.

If primary is given but secondary is not, only primary entries appear in `useFonts`. If both, both families appear.

Generated font files themselves are **not** shipped; the user must drop `.ttf` files into `assets/fonts/` matching the `Fonts` object values. README documents this.

## 6. Generated project layout

```
<target-dir>/
  package.json                ← patched: main="expo-router/entry", scripts, deps via `expo install`
  tsconfig.json               ← patched: compilerOptions.paths merged, extends preserved
  babel.config.js             ← patched: module-resolver alias plugin merged via AST
  app.json                    ← patched: expo.scheme, expo.plugins=["expo-router", ...]
  assets/                     ← root-level (NOT under src/)
    fonts/                    (empty)
    images/                   (empty)
    index.ts                  (`export {};`)
  src/
    app/
      _layout.tsx             ← provider tree + ErrorBoundary + conditional useFonts/BottomSheetModalProvider
      routes.tsx              ← dummy `<Stack>` with single `index` screen
      index.tsx               ← Hello World using AppWrapper + AppText
    core/
      hooks/                  (empty directory + .gitkeep)
      redux/
        store.ts              ← configureStore + persistStore + middleware exclusions
        reducers.ts           ← combineReducers + persistReducer + persistConfig (whitelist: ["user"])
        mmkvStorage.ts        ← MMKV adapter for redux-persist
        hooks.ts              ← typed useAppDispatch + useAppSelector
        slices/
          userSlice.ts        ← dummy user shape + setUser/clearUser/updateUser actions + exports
      services/               (empty unless image-picker yes → PermissionService.ts)
      tanstack/
        index.tsx             ← QueryClient singleton + TanStackQueryProvider + useQuery/useMutation/useQueryClient/useInfiniteQuery wrappers (all in one file, mirrors MyRoster)
        tanstack-keys.ts      ← single dummy key, e.g. `example: ["example"]`
      utils/
        config.ts             ← axios instance + request/response interceptors stub
        constants.ts          ← always: ANDROID, IOS, ImageSource. +media constants if picker yes.
        endpoints.ts          ← `export const ENDPOINTS = { EXAMPLE: "/example" };`
        types.ts              ← empty file with `export {};`
        validation.ts         ← only `loginValidationSchema` (email + password + rememberMe)
    features/                 (empty + .gitkeep)
    ui/
      appComponents/          ← see §6.1
      components/             (empty + .gitkeep)
      iconComponents/         ← all 7 vector-icon wrappers (§6.2)
      theme/
        colors.ts             ← enum with PRIMARY = "#3B82F6", SECONDARY = "#8B5CF6"
        fonts.ts              ← generated from prompts (§5.1)
        responsive.ts         ← copy of MyRoster's responsive helper (RFValue, WP, HP)
        allFileStyles.ts      ← `import { StyleSheet } from "react-native"; export default StyleSheet.create({});`
```

### 6.1 `ui/appComponents/` contents

Always ships (24 components):

**Primitives (19):** `appColumnView`, `appRowView`, `appText`, `appPressable`, `appButton`, `appInput`, `appScrollView`, `appFlatList`, `appFlashList`, `appIcon`, `appWrapper`, `appKeyboardAvoidingView`, `appKeyboardAwareScrollView`, `appSafeAreaInsets`, `appStatusBar`, `appSkeleton`, `AppRefreshControl`, `appLogger`, `appTextWrapper`.

**Modals (5):** `customActivityIndicator`, `customGetPermissionModal`, `customModal`, `customTextInput`, `appTabHeader`.

Ships **only if bottom-sheet = yes** (5 components):
- `appBottomSheetBackdrop`, `appBottomSheetScrollView`, `appBottomSheetView`, `BottomSheetKeyboardAwareScrollView`, `customBottomSheetModal`

Each component lives in its own folder with `index.tsx`. File content mirrors MyRoster verbatim, with import paths rewritten to template-local aliases where needed.

### 6.2 `ui/iconComponents/` contents

Always ships 7 wrappers, mirrored from MyRoster:

`IconFontAwesome6`, `IoniconsIcons`, `antDesignicons`, `featherIcons`, `materialCommunityIcons`, `materialIcons`, `octiconsIcons`.

Each is a thin typed wrapper around `@expo/vector-icons`'s respective set. Pattern: `{ name, size, color }` props.

## 7. Always-installed dependencies

Added to `package.json` regardless of prompt answers, all via `npx expo install` so versions are resolved against the target project's Expo SDK:

- `@reduxjs/toolkit`, `react-redux`, `redux-persist`, `react-native-mmkv`
- `@tanstack/react-query`
- `axios`
- `formik`, `yup`
- `expo-router`, `expo-dev-client`
- `react-native-safe-area-context`, `react-native-gesture-handler`, `react-native-screens`
- `react-native-reanimated`, `react-native-worklets` (peer of reanimated SDK 54+; exact name confirmed per Phase 0 verification step in PLAN_V5)
- `react-native-keyboard-controller`
- `react-error-boundary`
- `react-native-responsive-fontsize`
- `@expo/vector-icons`
- `@shopify/flash-list`

DevDeps:

- `@types/react`, `typescript` (already from `create-expo-app`)

**Version policy:** Delegated to `expo install` per call — Expo's CLI picks SDK-compatible versions. CLI release notes pin the targeted Expo SDK; bumping the SDK happens by user re-running our CLI. No manual caret-range table maintained.

## 8. Conditional installs

| Trigger | Adds | `app.json` `expo.plugins` entry |
|---------|------|-------------------------------|
| bottom-sheet = yes | `@gorhom/bottom-sheet` | none |
| image-picker = yes | `expo-image-picker` | `["expo-image-picker", { "photosPermission": "Allow $(PRODUCT_NAME) to access your photos.", "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera." }]` (iOS macro `$(PRODUCT_NAME)`; Android renders verbatim) |

Plugin entries added idempotently (skip if already present).

## 9. Path aliases

`tsconfig.json` `compilerOptions.paths`:

| Alias | Resolves to |
|-------|-------------|
| `@features/*` | `src/features/*` |
| `@appComponents/*` | `src/ui/appComponents/*` |
| `@components/*` | `src/ui/components/*` |
| `@icons/*` | `src/ui/iconComponents/*` |
| `@theme/*` | `src/ui/theme/*` |
| `@core/*` | `src/core/*` |
| `@redux/*` | `src/core/redux/*` |
| `@utils/*` | `src/core/utils/*` |
| `@services/*` | `src/core/services/*` |
| `@hooks/*` | `src/core/hooks/*` |
| `@assets` | `assets` (project root, not `src/assets` — matches §6 layout + §5.2 font path) |
| `@/*` | `src/*` |

`babel.config.js` adds `babel-plugin-module-resolver` with the same alias map.

## 10. `src/app/_layout.tsx` provider tree

Order (outer to inner):

```
Provider (redux store)
  PersistGate (redux-persist)
    TanStackQueryProvider
      GestureHandlerRootView
        SafeAreaProvider
          KeyboardProvider
            [BottomSheetModalProvider if bottom-sheet=yes]
              ErrorBoundary (react-error-boundary, FallbackComponent=ErrorFallback)
                Routes
```

`useSafeAreaInsets()` is used inside screens directly — no separate provider. (Earlier draft listed a `SafeAreaInsetsProvider`; no such export exists in `react-native-safe-area-context`.)

Conditional pieces:
- `BottomSheetModalProvider` and its import: only if bottom-sheet = yes.
- `useFonts(...)` block, `expo-font` import, and font loading guard: only if primary font = provided.

`ErrorFallback` is generated as a basic centered screen using `AppWrapper` + `AppText`, with a "Try Again" `AppButton`. Lives at `src/ui/components/errorFallback/index.tsx` so it is the only seeded item in `ui/components/`. (User can delete or modify freely.)

## 11. `src/app/routes.tsx` shape

```tsx
import { Stack } from "expo-router";

export default function Routes() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
```

No auth guards, no role-based protected routes. User adds via future `g group` sub-command or by hand.

## 12. Slash command companion

File: `.claude/commands/init-app.md` (shipped inside the package's `templates/claude-command/` directory so users can copy it into their workflow, plus published as a separate gist/snippet in the README).

Behavior when invoked inside Claude Code:

1. Claude reads the command spec.
2. Asks the same prompts (§5) via `AskUserQuestion` or natural dialogue.
3. Resolves a target directory (default = a new sibling of cwd unless user says otherwise).
4. Runs `npx react-native-expo-boilerplate <args>` via `Bash`, piping answers through environment variables or non-interactive flags — see §13.
5. Reports success/failure.

The slash command is documented in the README. It is optional; the CLI works standalone.

## 13. Non-interactive mode (for slash command + scripting)

CLI accepts environment variables to bypass prompts, used by the slash command to pre-answer:

| Env var | Maps to prompt | Convention |
|---------|----------------|------------|
| `EXPO_PRIMARY_FONT` | #1 primary font family | Defined (even empty `""`) = "answered". Unset = "ask". |
| `EXPO_SECONDARY_FONT` | #2 secondary font family | Same as above. |
| `EXPO_INCLUDE_BOTTOM_SHEET` | #3 | Strict `"1"` (true) or `"0"` (false). Any other non-empty value → CLI throws `"expected 1 or 0"`. Empty/unset → "ask". |
| `EXPO_INCLUDE_IMAGE_PICKER` | #4 | Same as above. |
| `EXPO_PACKAGE_MANAGER` | (no prompt — meta) | Optional `"yarn"` or `"npm"`. Any other value → CLI throws `"expected yarn or npm"`. Unset → auto-detect via `yarn --version` probe; fallback `"npm"`. |

If all four prompt vars are set, no prompts are shown; CLI runs fully non-interactively. If any is unset and stdin is a TTY, the missing one is prompted. If stdin is not a TTY and any answer is missing, CLI errors out with a clear message listing the env vars needed.

**Slash command note:** To skip a font prompt non-interactively, pass empty string explicitly (`EXPO_PRIMARY_FONT="" ...`). Omitting the var entirely triggers a prompt and breaks non-TTY usage.

**Lockfile invariant:** Whichever PM is chosen (via env or auto-detect) is passed to `expo install` via `--yarn`/`--npm` when the installed Expo CLI supports those flags (Branch A). When the flags are absent (verified via PLAN_V5 Phase 0 Probe 5 `FLAGS_OK=0`), the chosen PM's lockfile is pre-seeded inside `<target>` before `expo install` runs so the CLI auto-detects the intended PM (Branch B; see PLAN_V5 Phase 7 step 2 — yarn pre-seeds empty `yarn.lock`, npm pre-seeds minimal valid `lockfileVersion: 3` JSON with `npm install --package-lock-only` fallback per `NPM_SEED_OK`). Either path produces a single lockfile.

## 14. Package layout

```
react-native-expo-boilerplate/
  package.json               ← name: "react-native-expo-boilerplate", bin: { "react-native-expo-boilerplate": "./bin/cli.js" }  (bin renamed to avoid collision with upstream `create-expo-app` bin; `npx react-native-expo-boilerplate` still resolves by package name)
  README.md                  ← detailed usage, prompt walkthrough, structure overview, future-work section
  LICENSE                    ← MIT
  bin/
    cli.js                   ← shebang + transpiled entry; imports dist/index.js
  src/
    index.ts                 ← main()
    prompts.ts               ← prompt definitions (use `prompts` or `enquirer`)
    bootstrap.ts             ← wraps `create-expo-app`, resolves target dir
    overlay.ts               ← copies template files conditionally
    patch.ts                 ← package.json/tsconfig/babel patches
    fonts.ts                 ← generates `fonts.ts` content from prompt answers
    install.ts               ← detects + runs yarn/npm
    util.ts                  ← shared helpers (fs, path, logging)
  templates/
    base/                    ← unconditional files, with `// @@TOKEN@@` and `{/* @@TOKEN@@ */}` sentinels (see PLAN_V5 §Phase 4)
    bottom-sheet/            ← bottom-sheet App* components + provider patch instructions
    image-picker/            ← PermissionService.ts + constants snippet
    claude-command/
      init-app.md            ← Claude Code slash command
  docs/
    SPEC.md                  ← this document
    PLAN_V5.md               ← active implementation plan
    SDK_NOTES.md             ← Phase 0 verification findings (per-SDK package names, preset behavior, baseUrl)
    MIRROR_NOTES.md          ← MyRoster→PLAN_V5 alias mapping confirmation
  tsconfig.json
  .gitignore
```

## 15. README outline

1. Hero: one-line description + animated GIF placeholder.
2. Install / usage block (three invocation modes).
3. Interactive prompts table (mirrors §5).
4. Generated structure tree (mirrors §6).
5. Always-installed dependencies (mirrors §7).
6. Path aliases (mirrors §9).
7. Slash command setup section.
8. Adding fonts after install (font files convention + `useFonts`).
9. Future work (sub-commands).
10. Contributing + license.

## 16. Testing strategy

- **Unit tests** (vitest or jest) for:
  - `fonts.ts` generator: empty primary, primary only, primary + secondary, spaces in family name.
  - `patch.ts`: package.json merge, tsconfig path injection, babel alias injection.
  - `overlay.ts`: conditional inclusion logic.
- **Smoke E2E** (manual until v2): run `npx react-native-expo-boilerplate test-app` in a temp dir with each combination of bottom-sheet × image-picker × font choices, then `cd test-app && npx expo prebuild && yarn ios` (or `npm run ios`) and confirm the dev-client build succeeds and Metro bundles without errors. **Expo Go is not compatible** — `yarn start` alone won't run this stack (native modules require dev-client).
- Assert single lockfile: `[ -f yarn.lock ] || [ -f package-lock.json ]` AND not both.
- Assert zero `@@[A-Z_]+@@` sentinel residue in generated project sources (excluding `node_modules`) per PLAN_V5 Phase 6 step 5.
- Assert zero MyRoster-specific alias prefixes (`@/theme/`, `@/utils/`, `@/redux/`, `@/core/`, `@/services/`, `@/hooks/`, `@/appComponents/`, `@/components/`, `@/icons/`, `@/features/`, `@/assets`) survive in mirrored sources. **Bare `@/<anything-else>` IS allowed — `@/*` is a legitimate catchall alias resolving to `src/*` (see §9).**
- CI matrix runs unit tests on Node 18 + 20.

## 17. Open questions

None. All design decisions resolved during brainstorming on 2026-05-11. Implementation refinements tracked in [PLAN_V5.md](./PLAN_V5.md).

## 18. Future work (v2+)

Sub-command surface, deferred from v1:

| Command | Effect |
|---------|--------|
| `npx react-native-expo-boilerplate g feature <role>/<name>` | Scaffold MVVM feature: `features/<role>/<name>/types.ts` + first screen (`<screen>/index.tsx` + `components/` + `viewModel/_api.ts` + `viewModel/use<Screen>ViewModel.ts`). Register a new key in `tanstack-keys.ts`. |
| `g screen <role>/<feature> <name>` | Add another `<name>/` screen to an existing feature. |
| `g slice <name>` | Add `core/redux/slices/<name>Slice.ts`, auto-register in `reducers.ts`. |
| `g group <name>` | Add `app/(<name>)/_layout.tsx` route group. |
| `g component <name>` | Add `ui/components/<name>/index.tsx` stub. |

NestJS-style aliases (`g` = `generate`).

Other v2 candidates:
- `--preset` flag for pre-baked answers (e.g. `--preset coach-app` mirrors MyRoster exactly).
- Plugin system for community-shared templates.
- Built-in upgrade flow (`npx react-native-expo-boilerplate upgrade`) to bump deps in an existing scaffolded project.
