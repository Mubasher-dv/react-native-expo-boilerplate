# MyRoster → @codingpixel/create-expo-app alias mirror

**Date:** 2026-05-11
**Source commit:** vendor/myroster-src/ (pasted by user, no git history available)

## Alias mapping (confirmed against source)

| MyRoster alias (actual) | V5 alias | Notes |
|---|---|---|
| `@theme/*`         | `@theme/*`         | Identity. (Plan v5-r1 "assumed `@/theme/*`" was wrong.) |
| `@utils/*`         | `@utils/*`         | Identity. |
| `@redux/*`         | `@redux/*`         | Identity. |
| `@core/*`          | `@core/*`          | Identity. |
| `@services/*`      | `@services/*`      | Identity. |
| `@hooks/*`         | `@hooks/*`         | Identity. (MyRoster hooks dir empty too.) |
| `@appComponents/*` | `@appComponents/*` | Identity. |
| `@components/*`    | `@components/*`    | Identity. (Limited ship set — see Deviation #1, #2.) |
| `@icons/*`         | `@icons/*`         | Identity. |
| `@features/*`      | `@features/*`      | Identity. (Empty `.gitkeep` only.) |
| `@assets`          | `@assets`          | Identity. |
| `@/*` catchall     | `@/*` catchall     | Identity → resolves to `src/*`. |

**Result:** alias mapping is identity for all 12 entries. `rewriteImports` near-no-op for current MyRoster source set, but kept active for future mirrored files / divergent third-party templates.

## Files copied

### From `vendor/myroster-src/ui/appComponents/` → `templates/base/src/ui/appComponents/`
- All 19 primitives + 5 modals + 5 bottom-sheet (placed in `templates/bottom-sheet/`).

### From `vendor/myroster-src/ui/iconComponents/` → `templates/base/src/ui/iconComponents/`
- All 7 wrappers.

### From `vendor/myroster-src/ui/theme/` → `templates/base/src/ui/theme/`
- `colors.ts`, `responsive.ts`, `allFileStyles.ts`. (`fonts.ts` regenerated per Phase 6 sentinel; not copied verbatim.)

### From `vendor/myroster-src/core/` → `templates/base/src/core/`
- `redux/` (verbatim modulo `userSlice` reduced to dummy per SPEC §6).
- `tanstack/` verbatim.
- `utils/` — only `config.ts`, `endpoints.ts`, `types.ts`, `validation.ts` copied; `constants.ts` regenerated per Phase 5 sentinel; `formatters.ts` + `greeting.ts` SKIPPED (not in SPEC §6 scope).

### From `vendor/myroster-src/ui/components/` → `templates/base/src/ui/components/` (extended ship set — see Deviation #1, #2)
- `errorFallback/` (per SPEC §6).
- `avatarBlock/` (Deviation #1).
- `backgroundGradient/` (Deviation #2).

### NOT copied
- `vendor/myroster-src/app/` — `_layout.tsx` + `routes.tsx` + `(auth)/(coach)/(parent)/` are app-specific (app routes feature-coupled to MyRoster). V5 ships sentinel-bearing skeleton authored from scratch per Phase 4 step 1-2.
- `vendor/myroster-src/features/` — feature dirs are app-specific (auth screens, coach UIs, parent UIs).
- `vendor/myroster-src/services/PermissionService.ts` — copied, but to `templates/image-picker/` per Phase 5 (conditional overlay, not always-shipped).
- `vendor/myroster-src/shims/linear-gradient.js` — local shim NOT in SPEC; replaced by upstream `expo-linear-gradient` (see Deviation #2).

## Manual-review flags / deviations

### Deviation #1 — Ship `avatarBlock` in `templates/base/src/ui/components/`
- **Reason:** `appTabHeader/index.tsx` imports `@components/avatarBlock`. SPEC §6 ships only `errorFallback` under `ui/components/`.
- **Resolution:** added `avatarBlock` to ship list. Component is small (38 LOC), uses only identity-aliased deps already in shipped scope (`@appComponents`, `@icons`, `@theme`).
- **SPEC impact:** §6.1 ship list grows by one component.

### Deviation #2 — Ship `backgroundGradient` + add `expo-linear-gradient` to install list
- **Reason:** `appWrapper/index.tsx` imports `@components/backgroundGradient`. SPEC §6 ships only `errorFallback`.
- **Resolution:** added `backgroundGradient` to ship list (uses `expo-linear-gradient`); added `expo-linear-gradient` to Phase 7 always-install dep list.
- **SPEC impact:** §6.1 ship list +1 component; §7 deps list +1.

### Deviation #3 — Strip Reactotron from `appLogger/index.tsx`
- **Reason:** MyRoster's `appLogger` imports `../../../../ReactotronConfig` (project-root file outside our shipped scope; dev-tooling specific to MyRoster).
- **Resolution:** removed Reactotron import + transport callback. Logger now uses bare `react-native-logs` with default console transport. Generated apps add Reactotron back per their own dev-tool choices.

### Deviation #4 — Extend Phase 7 always-install dep list
Plan §7 missing imports found in shipped scope. Added:
- `expo-device` — used by some appComponents for platform branching.
- `expo-image` — used by `appIcon` (image variant).
- `expo-font` — required by Phase 6 `useFonts()` block.
- `expo-linear-gradient` — see Deviation #2.
- `react-native-logs` — used by `appLogger` (post-stripping Reactotron).
- `react-native-reanimated-skeleton` — used by `appSkeleton`.

### Deviation #5 — `core/redux/slices/userSlice.ts` reduced
- MyRoster's `userSlice` likely carries app-specific user shape. Per SPEC §6 (`dummy user shape`), shipped slice is minimal: id/name/setUser/clearUser/updateUser only.
- Author from scratch rather than copy MyRoster's verbatim, then strip.

### Deviation #6 — `validation.ts` reduced
- Per SPEC §6: `only loginValidationSchema (email + password + rememberMe)`. MyRoster's validation may carry more schemas. Shipped version authored from scratch.

### Deviation #7 — Add `babel-plugin-module-resolver` to install list
- **Reason:** Phase 7 `patchBabel` injects `["module-resolver", { alias: {...} }]` into `babel.config.js`. The plugin package itself must be installed or Metro crashes with `Cannot find module 'babel-plugin-module-resolver'` on first bundle.
- **Resolution:** added to `buildAlwaysInstalledList`. (Plan §7 omitted it.)

### Deviation #19 — Bake probe results into compiled module
- **Reason:** v0.1.4 verification surfaced two real bugs: (a) `babel.config.js` got `react-native-worklets/plugin` injected even though `babel-preset-expo` auto-includes it (double-load risk + warnings); (b) `tsconfig.json` `baseUrl` never set → fragile path resolution.
- **Root cause:** CLI runtime read probe data from `docs/SDK_NOTES.md` via `readSDKNotes`. That file is NOT in `package.json#files`, so it was missing from the npm tarball. `readSDKNotes` returned an empty Map → all probe-driven branches fell into wrong defaults.
- **Resolution:** new `src/sdkProbeResults.ts` exports `SDK_PROBE_RESULTS` constants (compiled into `dist/`, always available). `index.ts` reads from constants first, with `docs/SDK_NOTES.md` as an optional override (out-of-tree dev runs only).
- **Maintenance:** when bumping target Expo SDK, re-run `scripts/run-probes.sh` and update `SDK_PROBE_RESULTS` by hand.

### Deviation #18 — Add `react-native-nitro-modules` + `expo-system-ui` to install list
- **Reason:** `react-native-mmkv` 3.x+ was rewritten on top of Nitro Modules. Without `react-native-nitro-modules` peer, gradle fails with `Project with path ':react-native-nitro-modules' could not be found in project ':react-native-mmkv'` and CocoaPods fails with `Unable to find a specification for NitroModules depended upon by NitroMmkv`. Plus default `app.json` `userInterfaceStyle: "light"` triggers `expo prebuild` warning `Install expo-system-ui in your project`.
- **Resolution:** both added to `buildAlwaysInstalledList`. Versions inherit from current SDK via `expo install`.

### Deviation #15 — Add `cameraPermission` to image-picker plugin
- **Reason:** `PermissionService.ts` requests camera permission too; without `cameraPermission` in the plugin options, iOS Info.plist lacks `NSCameraUsageDescription` and the camera request crashes.
- **Resolution:** `patchAppJsonPlugins` now sets both `photosPermission` + `cameraPermission`.

### Deviation #14 — Use `expo run:android`/`run:ios` for first launch
- **Reason:** Plan v5 set `package.json#android` = `expo start --android` (matched create-expo-app default). That command requires a custom dev-client to be PRE-INSTALLED on the device — fails with "No development build for this project is installed" on first run because we haven't built one yet.
- **Resolution:** `patchPackageJsonScripts` now writes:
  - `start` = `expo start --dev-client` (was `expo start`)
  - `android` = `expo run:android` (was `expo start --android`) — builds + installs dev-client + launches in one shot
  - `ios` = `expo run:ios` (was `expo start --ios`)
  - `prebuild` = `expo prebuild` (new — explicit access if user wants to regenerate native dirs)
- **Force-upgrades stale defaults** so re-running the CLI on existing scaffolds with the old script values converges to the new ones.
- README + success-message updated to reflect single-command flow.

### Deviation #13 — Bundle ID format `com.<safeName>` (no `codingpixel.` prefix)
- **Reason:** User feedback — don't inject app-author namespace into generated app's bundle ID. Apps that own their own scope (e.g. `com.example.myapp`) edit `app.json` after.
- **Resolution:** `bundleIdFor(name)` returns `com.<safeName>`. Examples: `My Cool App` → `com.mycoolapp`. `cpx-e2e` → `com.cpxe2e`.

### Deviation #16 — `mmkvStorage.ts` API fix (createMMKV → new MMKV)
- **Reason:** MyRoster's source uses `createMMKV()` factory — that API doesn't exist in `react-native-mmkv` 3.x+ (current 4.3.x). The package now exports `MMKV` as a class. First scaffold using mmkv would crash at module load with `createMMKV is not a function`.
- **Resolution:** rewrote `templates/base/src/core/redux/mmkvStorage.ts` to use `new MMKV()`. Also fixed `removeItem` to use `storage.delete(key)` (was `storage.remove(key)`, also nonexistent).

### Deviation #17 — `useSafeArea` re-exports `useSafeAreaInsets` directly
- **Reason:** MyRoster's `appSafeAreaInsets` defined a custom React context populated by `SafeAreaInsetsProvider`. V5 plan dropped that provider from the layout tree (deemed Android-padding tweak unnecessary). Result: `useSafeArea()` returned an empty object, so `AppWrapper`/`AppButton` got `insets.top = undefined` → no safe-area padding applied → content rendered under iPhone notch.
- **Resolution:** `useSafeArea` is now a thin re-export of `useSafeAreaInsets` from `react-native-safe-area-context`. No custom context, no missing provider. Components using `useSafeArea()` keep compiling unchanged.

### Deviation #12 — `patchAppJson` sets `android.package` + `ios.bundleIdentifier`
- **Reason:** `expo run:android` / `expo run:ios` errors with `Required property 'android.package' is not found in the project app.json` (or `ios.bundleIdentifier`). create-expo-app's blank-typescript template no longer ships defaults for these on SDK 54.
- **Resolution:** `patchAppJson` derives a reverse-DNS bundle ID from the user-supplied app name via new `bundleIdFor(name)` helper. Format: `com.codingpixel.<safeName>` where `safeName` = slugified-name with dashes stripped + leading-digit guard. Preserves user-set values.
- **Examples:** `My Cool App` → `com.codingpixel.mycoolapp`. `cpx-e2e` → `com.codingpixel.cpxe2e`. `1pp` → `com.codingpixel.app1pp`.
- **Apps that want a different namespace:** edit `app.json` `expo.ios.bundleIdentifier` + `expo.android.package` after scaffold; the patcher only fills defaults when missing.

### Deviation #11 — Add `expo-linking` + `expo-constants` to install list
- **Reason:** `expo-router` requires both as peer deps but `expo install expo-router` does NOT auto-install them. First Metro bundle in the generated app fails with `Unable to resolve "expo-linking" from .../expo-router/build/views/Unmatched.js`. Same risk for `expo-constants` (used by other expo-router internals).
- **Resolution:** added both to `buildAlwaysInstalledList`. Versions inherit from current SDK via `expo install`.

### Deviation #10 — Static `fonts.ts`, `enum`-style `Colors` + `Fonts` (per user request)
- **Reason:** User opted for `const enum Fonts { BOLD = "", ... }` (9 keys empty) over Plan v5's "object literal `as const` + FontKey" pattern. Same direction for `Colors`. Files now ship STATIC at scaffold time (no per-answer generation, no sentinel splice for fonts.ts).
- **Resolution:**
  - `templates/base/src/ui/theme/fonts.ts` — static `const enum` with 9 weights, all empty values. Apps fill PostScript names + drop matching `.ttf` into `assets/fonts/`.
  - `src/fonts.ts::buildLayoutReplacements` no longer emits `FONTS_OBJECT` key.
  - `src/patch.ts::patchLayout` no longer touches `fonts.ts` (only `_layout.tsx` sentinels).
  - `scripts/audit-templates.sh` Fonts-type-position grep removed (`enum Fonts` makes `: Fonts`, `keyof typeof Fonts`, etc. legitimate type-position uses).
- **Babel safety caveat:** Plan v5's original ban on TS `enum` was Hermes/Babel-safety motivated. `const enum` works under `babel-preset-expo` because the preset strips `const` semantics and emits a normal enum object. If it ever breaks under a future preset version, fall back to `as const` object literal — components access values as `Fonts.BOLD` either way.

### Deviation #9 — Fonts disabled (always-empty values)
- **Reason:** User opted to ship v0.1.x without fonts wiring. Removes need for users to source `.ttf` files and lets the generated app boot immediately without missing-font warnings.
- **Resolution:** `gatherAnswers()` hard-codes `primaryFont = ""` + `secondaryFont = ""`. Generators' empty branch produces `Fonts = {} as const` + drops all `USE_FONTS_*` sentinels (clean line-removal, no orphan blanks). `_layout.tsx` ships without `useFonts` import, hook, or guard. `expo-font` stays in `dependencies` so apps can opt in later without a CLI re-run.
- **Env vars:** `EXPO_PRIMARY_FONT` / `EXPO_SECONDARY_FONT` still shape-validated by `validateEnvVars` but their values are silently ignored by `gatherAnswers`. (Removing the validation would force users with leftover env vars from older CLI versions to unset them.)
- **README + slash command:** updated to drop font prompts and reference this deviation.

### Deviation #8 — `patchBabel` writes stub when `babel.config.js` absent
- **Reason:** SDK 54 `blank-typescript` template no longer ships `babel.config.js` — preset is loaded automatically via `expo-router`. Plan Phase 7 step 4 assumed file always present (`throw new Error("missing")`), which would kill the CLI mid-pipeline on every fresh SDK 54 scaffold.
- **Resolution:** when file absent, `patchBabel` writes a minimal stub (`module.exports = function (api) { api.cache(true); return { presets: ['babel-preset-expo'], plugins: [] }; };`) before the AST merge runs. Subsequent runs see the file and parse normally; idempotent.
- **Verified:** `npx create-expo-app foo --template blank-typescript --no-install` produces zero `babel.config.*` files at the time of this writing (Expo SDK 54.0.x).
