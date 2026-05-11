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
