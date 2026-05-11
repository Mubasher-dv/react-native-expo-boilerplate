# `codingpixel-expo-app`

Opinionated Expo SDK 54+ app scaffolder. Mirrors the [MyRoster](https://github.com/) project's component / redux / theme conventions; layers them on top of `create-expo-app`'s `blank-typescript` template; runs all native-dep installs through `expo install` so versions match the target SDK; ships a single lockfile (yarn OR npm — never both).

## Quickstart

```bash
npx codingpixel-expo-app my-app
cd my-app
yarn ios          # or: yarn android  (npm run ios / npm run android also work)
```

`yarn ios` / `yarn android` map to `expo run:ios` / `expo run:android` — these BUILD + install the custom dev-client + launch in one shot (3-10 min the first time, fast incremental after). No separate `expo prebuild` step needed.

For subsequent runs after the dev-client is installed, use `yarn start` (= `expo start --dev-client`) for faster iteration.

The bin name is `codingpixel-expo` (used after global install). Invoke through `npx codingpixel-expo-app` (the package name) for one-shot runs.

## Post-scaffold commands (`add` / `generate` / `g`)

Skipped something at scaffold time? Retrofit it later without re-running the full scaffolder.

> **Vocabulary:** these commands run **recipes** — packaged units of change. Two flavors today:
> - **library recipes** install a third-party package + boilerplate (component overlay, constants splice, `app.json` plugin entry). Examples: `bottom-sheet`, `image-picker`.
> - **asset recipes** prompt for inputs interactively and update project assets / native config. Examples: `app-icon`, `splash`.
>
> The word "feature" is reserved for future recipes that scaffold app modules (e.g. `auth`, `home`).

### Usage

1. Open a terminal **inside your scaffolded project root** (the directory containing `app.json`). The commands are cwd-scoped and refuse to run elsewhere.
2. Run one of the three verbs below. All three are aliases of the same dispatcher — pick whichever you prefer:

   ```bash
   npx codingpixel-expo-app <verb> <recipe>
   ```

   - `<verb>` — one of `add`, `generate`, or `g` (short form).
   - `<recipe>` — one of `bottom-sheet`, `image-picker`, `app-icon`, `splash`.

3. Rebuild afterwards so the changes land in the native projects (see each recipe below for the exact command).

### Library recipes

**`bottom-sheet`** — installs `@gorhom/bottom-sheet` and drops 5 components into `src/ui/appComponents/`: `customBottomSheetModal`, `appBottomSheetView`, `appBottomSheetBackdrop`, `appBottomSheetScrollView`, `BottomSheetKeyboardAwareScrollView`.

```bash
npx codingpixel-expo-app add bottom-sheet
npx codingpixel-expo-app generate bottom-sheet     # same thing
npx codingpixel-expo-app g bottom-sheet            # same thing, short form
```

Rebuild after: `yarn ios` / `yarn android` (or `npm run ios` / `npm run android`) — links the new native module into the dev-client.

**`image-picker`** — installs `expo-image-picker`, drops `PermissionService.ts` into `src/core/services/`, splices `MEDIA_TYPES` + `IMAGE_PICKER_OPTIONS` + `CAMERA_OPTIONS` into `src/core/utils/constants.ts`, and adds the `expo-image-picker` plugin entry to `app.json` with default photos/camera permission strings.

```bash
npx codingpixel-expo-app add image-picker
npx codingpixel-expo-app g image-picker
```

Rebuild after: `yarn ios` / `yarn android`.

### Asset recipes

**`app-icon`** — interactively prompts for a source PNG path + target size (default `1024`, the App Store / Play Store recommendation), copies the source to both `src/assets/icon.png` (iOS + favicon fallback) and `src/assets/adaptive-icon.png` (Android adaptive icon foreground), and updates `app.json` (`expo.icon` + `expo.android.adaptiveIcon.foregroundImage`). Also fills `expo.android.adaptiveIcon.backgroundColor` with `#ffffff` when absent (required pair — the Android adaptive icon won't render without a background). User-set `backgroundColor` is preserved.

```bash
npx codingpixel-expo-app add app-icon
npx codingpixel-expo-app g app-icon
```

The CLI does **not** resize — Expo regenerates all platform sizes from the single source at prebuild time. The size answer is used only to validate that the source is large enough; you'll see a warning if the source is undersized or non-square. Recommended source: **1024 × 1024 square PNG**.

Rebuild after: `npx expo prebuild --clean` (regenerates `ios/` + `android/` from `app.json`), then `yarn ios` / `yarn android`.

**`splash`** — interactively prompts for a background color (hex, default `#ffffff`) + a centered image path. Copies the source to `src/assets/splash-icon.png` and writes the `expo-splash-screen` plugin entry to `app.json` with `resizeMode: "contain"` and `imageWidth: 200`. If a legacy `expo.splash` field is present, that's updated to match (defensive).

```bash
npx codingpixel-expo-app add splash
npx codingpixel-expo-app g splash
```

Adjust `imageWidth` / `resizeMode` in `app.json` `plugins["expo-splash-screen"]` afterwards if the centered image renders too small or too large.

Rebuild after: `npx expo prebuild --clean`, then `yarn ios` / `yarn android`.

### Behavior

All four recipes:

- Refuse to run when `app.json` is missing — must be invoked from an Expo project root.
- Are **idempotent on the patch side** — plugin entry, constants splice, `expo install`, and asset path writes all skip / converge cleanly when already applied. **File overlays and asset copies overwrite** the destination, so re-running clobbers any local edits to the affected files.
- Auto-detect package manager from the project's lockfile (`yarn.lock` → yarn, `package-lock.json` → npm) and use it for the rebuild-reminder commands shown after success.

Asset recipes (`app-icon`, `splash`) additionally:

- Require a **TTY** — they prompt interactively. Running them from a piped / slash-command context throws with a clear error.
- **Reject source filenames containing whitespace** (e.g. `app icon.png`, `app	icon.png`). Rename to `app-icon.png` and try again. Native build tooling (Xcode, Gradle, CocoaPods) is fragile around whitespace in asset filenames, so the CLI rejects up front rather than producing a broken native build later. Spaces in parent directories (e.g. `/Users/Mac User/icons/app-icon.png`) are fine — only the filename is checked.

After the recipe completes, the CLI prints rebuild commands tailored to whether the change is a new native module (library recipes) or a re-bake of `ios/` + `android/` from `app.json` (asset recipes).

> Edge: project names `add`, `generate`, and `g` are reserved — they collide with the subcommand dispatcher. Use a different name when scaffolding.

## Not Expo Go-compatible

This template ships native modules that Expo Go can't load:

- `react-native-mmkv` (redux-persist storage)
- `react-native-gesture-handler`
- `react-native-reanimated` (+ `react-native-worklets`)
- `react-native-keyboard-controller`
- `@gorhom/bottom-sheet` (when bottom-sheet support enabled)

You **must** run a custom dev-client. `yarn ios` / `yarn android` (= `expo run:ios` / `expo run:android`) handle prebuild + native build + dev-client install in one command:

```bash
yarn ios       # or yarn android / npm run ios / npm run android
```

Subsequent runs use the dev-client + bundler (`yarn start` = `expo start --dev-client`).

## Fonts

Fonts are intentionally disabled in v0.1.x — generated `src/ui/theme/fonts.ts` exports `Fonts = {} as const` + `FontKey = never`, and `_layout.tsx` ships without `useFonts`. Apps that need custom fonts wire `expo-font` themselves (drop `.ttf`s into `assets/fonts/`, populate `Fonts`, add `useFonts(...)` + a loading guard in `_layout.tsx`).

`expo-font` is already in `dependencies`, so no extra install is needed.

## `@/*` alias

The template overrides `expo/tsconfig.base`'s default by setting `@/*` → `src/*`. All MyRoster-style aliases (`@theme/*`, `@utils/*`, `@redux/*`, `@core/*`, `@services/*`, `@hooks/*`, `@appComponents/*`, `@components/*`, `@icons/*`, `@features/*`, `@assets`) resolve to their concrete dirs in `src/`. See `tsconfig.json` `compilerOptions.paths`.

If your generated app's `tsconfig.json` already has a `@/*` mapping, the CLI preserves it + warns.

## First-time dev-client build

iOS:
- Xcode + CocoaPods installed (`sudo gem install cocoapods` if missing).
- `yarn ios` (or `npm run ios`) — generates `ios/` dir, runs CocoaPods, builds the dev-client, installs in simulator, launches.

Android:
- Android SDK + emulator running (or a USB-attached device with debugging enabled).
- `JAVA_HOME` pointing at JDK 17.
- `yarn android` (or `npm run android`) — generates `android/` dir, builds the dev-client APK, installs, launches.

Bundle identifier defaults to `com.<app-name-no-dashes>` (e.g. `com.myapp`). Edit `app.json` `expo.ios.bundleIdentifier` + `expo.android.package` before submitting to App Store / Play Store.

## Expo SDK compatibility

Built + tested against Expo SDK 54.x (probed via `docs/SDK_NOTES.md` at template-author time). Native dep versions are inherited at scaffold time via `expo install`, so subsequent SDK bumps update the deps without a CLI release.

If `expo install` reports version-resolution failures, the CLI runs an isolation retry (`retryWithIsolation`) — drops the failing dep, retries the rest, and surfaces the failed name + verbatim Expo stderr at the end.

## Environment variables (non-interactive runs)

Required when stdin is not a TTY (e.g. slash-command flows).

| Var | Type | Notes |
|---|---|---|
| `EXPO_INCLUDE_BOTTOM_SHEET` | `"0"` or `"1"` | Other values throw before any fs mutation. |
| `EXPO_INCLUDE_IMAGE_PICKER` | `"0"` or `"1"` | Same. |
| `EXPO_PACKAGE_MANAGER` | `"yarn"` or `"npm"` | Optional override; auto-detect otherwise. Other values throw. |

`EXPO_PRIMARY_FONT` / `EXPO_SECONDARY_FONT` are silently ignored (fonts disabled — see "Fonts" above).

## Bin name

- npm package: `codingpixel-expo-app` (unscoped, public).
- Bin: `codingpixel-expo`.
- Run as `npx codingpixel-expo-app <dir>` (the package name) — `npx codingpixel-expo` only resolves after a `yarn global add` / `npm i -g` of this package.

## Recovery from mid-run failures

The CLI mutates `<target>` in place. If a patch throws partway through:

1. **Patches are idempotent.** Fix the root cause (e.g. install missing PATH entry, retry network) and re-run the same command. The CLI converges.
2. **Or:** `rm -rf <target>` and start fresh.

The CLI **never** auto-deletes the target dir.

## Contributing / publish

```bash
yarn install
yarn build
yarn test
yarn audit:templates    # also runs as prepublishOnly
```

`prepublishOnly` chains `npm run build && npm run test && npm run audit:templates` — `audit:templates` greps mirrored files for unmapped MyRoster prefixes + Fonts-as-type misuse, blocking publish on stale audits. See `docs/MIRROR_NOTES.md` for the deviation log.

Publish:

```bash
npm publish
```

(Unscoped packages publish public by default — no `--access` flag needed.)

## License

MIT.
