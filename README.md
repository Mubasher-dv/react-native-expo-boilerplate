# `react-native-expo-boilerplate`

Opinionated Expo SDK 54+ app scaffolder. Provides a structured component / redux / theme setup on top of `create-expo-app`'s `blank-typescript` template; runs all native-dep installs through `expo install` so versions match the target SDK; ships a single lockfile (yarn OR npm — never both).

## Quickstart

```bash
npx react-native-expo-boilerplate my-app
cd my-app
yarn ios          # or: yarn android  (npm run ios / npm run android also work)
```

`yarn ios` / `yarn android` map to `expo run:ios` / `expo run:android` — these BUILD + install the custom dev-client + launch in one shot (3-10 min the first time, fast incremental after). No separate `expo prebuild` step needed.

For subsequent runs after the dev-client is installed, use `yarn start` (= `expo start --dev-client`) for faster iteration.

The bin name is `react-native-expo-boilerplate` (used after global install). Invoke through `npx react-native-expo-boilerplate` (the package name) for one-shot runs.

## Post-scaffold `add` commands

Skipped something at scaffold time? Retrofit it later without re-running the full scaffolder.

> **Vocabulary:** these commands run **recipes** — packaged units of change. Three flavors:
> - **font recipes** fetch Google Fonts tarballs, copy TTFs, rewrite the `Fonts` enum, and wire `useFonts` into `_layout.tsx`. Example: `fonts`.
> - **library recipes** install a third-party package + boilerplate (component overlay, constants splice, `app.json` plugin entry). Examples: `bottom-sheet`, `image-picker`.
> - **asset recipes** prompt for inputs interactively and update project assets / native config. Examples: `app-icon`, `splash`.
>
> The word "feature" is reserved for future recipes that scaffold app modules (e.g. `auth`, `home`).

### Usage

1. Open a terminal **inside your scaffolded project root** (the directory containing `app.json`). The commands are cwd-scoped and refuse to run elsewhere.
2. Run:

   ```bash
   npx react-native-expo-boilerplate add <recipe>
   ```

   `<recipe>` is one of `fonts`, `bottom-sheet`, `image-picker`, `app-icon`, `splash`.

3. Rebuild afterwards so the changes land in the native projects (see each recipe below for the exact command).

### Font recipe

**`fonts`** — interactively prompts for a primary (and optional secondary) [Google Fonts](https://fonts.google.com/) family name (e.g. `Inter`, `Roboto`, `Sansita`). Behind the scenes:

1. Fetches the `@expo-google-fonts/<family>` tarball from npm (no permanent `package.json` entry — fonts live as static assets).
2. Copies the selected `.ttf` files to `src/assets/fonts/`.
3. Rewrites `src/ui/theme/fonts.ts` with a typed `export enum Fonts { … }`.
4. Injects `useFonts(...)` + a loading guard into `src/app/_layout.tsx` (within a `// codingpixel:fonts-start` / `// codingpixel:fonts-end` marker block).

```bash
npx react-native-expo-boilerplate add fonts
```

Re-runnable to swap or remove fonts. **No native rebuild needed** — `expo-font` is already installed; restart Metro (`yarn start`) to pick up the new TTFs.

Supports `expo-splash-screen` interplay — if splash is already installed, the `useFonts` effect and `SplashScreen.hideAsync()` are colocated in the same block.

Non-interactive (CI / slash-command) usage:

```bash
EXPO_PRIMARY_FONT="Inter" EXPO_SECONDARY_FONT="Sansita" npx react-native-expo-boilerplate add fonts
```

### Library recipes

**`bottom-sheet`** — installs `@gorhom/bottom-sheet` and drops 5 components into `src/ui/appComponents/`: `customBottomSheetModal`, `appBottomSheetView`, `appBottomSheetBackdrop`, `appBottomSheetScrollView`, `BottomSheetKeyboardAwareScrollView`.

```bash
npx react-native-expo-boilerplate add bottom-sheet
```

Rebuild after: `yarn ios` / `yarn android` (or `npm run ios` / `npm run android`) — links the new native module into the dev-client.

**`image-picker`** — installs `expo-image-picker`, drops `PermissionService.ts` into `src/core/services/`, splices `MEDIA_TYPES` + `IMAGE_PICKER_OPTIONS` + `CAMERA_OPTIONS` into `src/core/utils/constants.ts`, and adds the `expo-image-picker` plugin entry to `app.json` with default photos/camera permission strings.

```bash
npx react-native-expo-boilerplate add image-picker
```

Rebuild after: `yarn ios` / `yarn android`.

### Asset recipes

**`app-icon`** — interactively prompts **only** for a source image path. Accepted format: **`.png` only** (case-insensitive). JPG / JPEG throw before any copy — per Expo SDK 54 docs, Android adaptive icon foreground requires PNG, and JPG/JPEG silently fail to render on Android. Recommended source: **1024 × 1024 square PNG**; sources below `432 × 432` (Android adaptive minimum at xxxhdpi) or below `1024 × 1024` (App Store / Play Store recommendation) still copy but log warnings.

```bash
npx react-native-expo-boilerplate add app-icon
```

The recipe:

1. Reads existing `expo.icon` from `app.json` and uses **that path** for the copy (preserves stock `create-expo-app`'s `./assets/images/icon.png` layout if present; defaults to this CLI's `./src/assets/icon.png` if absent). Same for `expo.android.adaptiveIcon.foregroundImage` (or derives a sibling `adaptive-<basename>` if absent).
2. Copies the source to both resolved destinations.
3. Cleans up stale legacy siblings (`icon.jpg` / `icon.jpeg` from v0.2.0 / v0.2.1 scaffolds — those versions accepted JPG and shipped a broken Android icon).
4. Writes **four** `app.json` fields covering both modern + older Android (and iOS):

   | Field | Purpose |
   |---|---|
   | `expo.icon` | iOS + web favicon fallback (Android default fallback too) |
   | `expo.android.icon` | Android < 8.0 non-adaptive fallback (older devices show no icon without this) |
   | `expo.android.adaptiveIcon.foregroundImage` | Android 8.0+ adaptive foreground layer |
   | `expo.android.adaptiveIcon.backgroundColor` | `#ffffff` only-if-absent (required pair — user-set value preserved) |

The CLI does **not** resize — Expo regenerates all platform sizes from the single source at prebuild time.

Rebuild after: `npx expo prebuild --clean` (regenerates `ios/` + `android/` from `app.json`), then `yarn ios` / `yarn android`.

**Android icon not updating after rebuild?** Three almost-always causes:

1. **Skipped `npx expo prebuild --clean`** — without `--clean`, `android/app/src/main/res/mipmap-*` stays stale and the new icon never gets baked into the APK.
2. **Emulator / device cached the old icon** — uninstall first (long-press → Uninstall, or `adb uninstall <expo.android.package>`), then `yarn android` again.
3. **Source PNG below 432 × 432** — Android adaptive icon may render fuzzy or fall back to launcher default. Provide a 1024 × 1024 square PNG.

iOS Simulator has the same caching behavior — delete the app from the simulator (long-press → Remove App) then rerun `yarn ios`.

**`splash`** — interactively prompts for a background color (hex, default `#ffffff`), a centered image path, and an `imageWidth` in dp (default `150`, Android-12+-safe). Then:

1. Runs `expo install expo-splash-screen` (mandatory — the plugin entry in `app.json` fails to resolve at `expo prebuild` time without the package installed; you'll see `PluginError: Failed to resolve plugin for module "expo-splash-screen"` if this step is skipped).
2. Copies the source to `src/assets/splash-icon.png`.
3. Writes the `expo-splash-screen` plugin entry to `app.json` with `resizeMode: "contain"` and your chosen `imageWidth`. Also writes a `dark: { backgroundColor: <same color> }` block so dark-mode devices don't get a default-color flash (edit `app.json` afterwards if you want a different dark color or to set a `dark.image`). Merge-preserves any existing `dark.image` / `ios` / `android` sub-blocks. If a legacy `expo.splash` field is present, that's updated to match (defensive).

   **About `imageWidth`**: Android 12+ renders the splash icon inside a 192dp × 192dp canvas (Material You spec). Values above 192 overflow the canvas and Android crops the left + right edges — the cause of "splash image cut on Android but fine on iOS" reports. Default `150` sits inside the canvas with breathing room for circular / squircle launcher masks; matches Expo's own Android-platform docs example. iOS has no equivalent constraint, so `imageWidth` only really affects Android rendering quality there. Source image content should sit within the central ~66% of the icon — content too close to the edges gets clipped by the launcher mask regardless of `imageWidth`.
4. Splices `SplashScreen.preventAutoHideAsync()` (module scope) + `useEffect(() => SplashScreen.hideAsync(), [])` (inside `RootLayout`) into `src/app/_layout.tsx`. Without this, Expo auto-hides the splash the moment the JS bundle loads (before the layout mounts), and your configured splash never actually renders. Idempotent — skips on re-run, and merges `useEffect` into an existing `from "react"` import rather than adding a duplicate line.

```bash
npx react-native-expo-boilerplate add splash
```

Adjust `imageWidth` / `resizeMode` in `app.json` `plugins["expo-splash-screen"]` afterwards if the centered image renders too small or too large.

Rebuild after: `npx expo prebuild --clean`, then `yarn ios` / `yarn android`.

### Behavior

All recipes:

- Refuse to run when `app.json` is missing — must be invoked from an Expo project root.
- Are **idempotent on the patch side** — plugin entry, constants splice, `expo install`, and asset path writes all skip / converge cleanly when already applied. **File overlays and asset copies overwrite** the destination, so re-running clobbers any local edits to the affected files.
- Auto-detect package manager from the project's lockfile (`yarn.lock` → yarn, `package-lock.json` → npm) and use it for the rebuild-reminder commands shown after success.

Asset recipes (`app-icon`, `splash`) additionally:

- Require a **TTY** — they prompt interactively. Running them from a piped / slash-command context throws with a clear error.
- **Reject source filenames containing whitespace** (e.g. `app icon.png`, `app	icon.png`). Rename to `app-icon.png` and try again. Native build tooling (Xcode, Gradle, CocoaPods) is fragile around whitespace in asset filenames, so the CLI rejects up front rather than producing a broken native build later. Spaces in parent directories (e.g. `/Users/Mac User/icons/app-icon.png`) are fine — only the filename is checked.

After the recipe completes, the CLI prints rebuild commands tailored to whether the change is a new native module (library recipes) or a re-bake of `ios/` + `android/` from `app.json` (asset recipes).

> Edge: the project name `add` is reserved — it collides with the subcommand dispatcher. Use a different name when scaffolding.

### Generate role / feature / screen

Scaffold the navigation/feature layout in an already-scaffolded project.

The CLI supports two layout shapes:

- **Hierarchical** — `role → feature → screen` (3 levels). Use for namespaces with multiple sub-modules (e.g. `customer/dashboard/home`, `customer/profile/edit`).
- **Standalone feature** — `feature → screen` (2 levels, flat). Use for tightly-scoped namespaces where each screen is independent (e.g. `auth/login`, `auth/signUp`, `auth/forgotPassword`). Owns its own Expo Router group.

Commands dispatch on argument arity — no flags.

#### `add role <name>` (hierarchical)

Creates an Expo Router group, the feature root, and one starter screen.

```bash
react-native-expo-boilerplate add role customer
# prompts: First feature name? dashboard
# prompts: First screen name?  home
```

Produces:

```
src/features/customer/dashboard/
  types.ts
  home/
    index.tsx
    viewModel/_api.ts
    viewModel/useHomeViewModel.tsx
src/app/(customer)/
  _layout.tsx     # empty <Stack headerShown:false />
  index.tsx       # <Redirect href="/(customer)/home" />
  home.tsx        # re-export from @features/customer/dashboard/home
```

Also registers `<Stack.Screen name="(customer)" />` in `src/app/routes.tsx`.

A final prompt asks **"Make this role the app's initial route?"** — answering yes rewrites `src/app/index.tsx` to `<Redirect href="/(customer)" />` so launch lands directly on the role. Default `no` (root index left untouched). Same prompt fires for `add feature <name>` (standalone, 1-arg form).

> `add role auth` is refused with a hint to use `add feature auth` — `auth` should be a standalone feature, not a role.

#### `add feature <name>` (1-arg, standalone)

Creates a standalone flat feature with its own route group and a starter screen.

```bash
react-native-expo-boilerplate add feature auth
# prompts: First screen name? login
```

Produces:

```
src/features/auth/
  types.ts
  login/
    index.tsx
    viewModel/_api.ts
    viewModel/useLoginViewModel.tsx
src/app/(auth)/
  _layout.tsx
  index.tsx       # <Redirect href="/(auth)/login" />
  login.tsx       # re-export from @features/auth/login (2-segment)
```

Also registers `<Stack.Screen name="(auth)" />` in `src/app/routes.tsx`.

#### `add feature <role> <name>` (2-arg, nested)

Adds a sibling feature under an existing hierarchical role.

```bash
react-native-expo-boilerplate add feature customer profile
# prompts: Screen name?            edit
# prompts: Make initial screen?    no
```

Refuses if the role does not exist or the feature already exists. Refuses if the chosen screen name collides with an existing route file in the same role group. The route layout is **flat per role**: `src/app/(<role>)/<screen>.tsx`, so screen names must be unique within a role.

If you answer "yes" to the initial-screen prompt, the redirect in `src/app/(<role>)/index.tsx` is rewritten to point at the new screen.

#### `add screen <feature> <name>` (2-arg, flat)

Adds a sibling screen to an existing standalone feature.

```bash
react-native-expo-boilerplate add screen auth signUp
# prompts: Make initial screen? no
```

Refuses if the feature is not a standalone feature, the screen already exists, or the screen name collides with an existing route file in the feature's route group.

#### `add screen <role> <feature> <name>` (3-arg, nested)

Adds a sibling screen to a nested feature under a hierarchical role.

```bash
react-native-expo-boilerplate add screen customer dashboard teamDetails
# prompts: Make initial screen? no
```

Refuses if the role or feature does not exist, the screen already exists, or the screen name collides with an existing route file in the role.

#### `add bottom-tab <role>` (hierarchical only)

Scaffolds an Expo Router `(tabs)/` group inside an existing hierarchical role.

```bash
react-native-expo-boilerplate add bottom-tab customer
# prompts: How many bottom tabs? (2–5) 3
# prompts: Tab #1 name? home
# prompts: Tab #2 name? bookings
# prompts: Tab #3 name? profile
```

Produces:

```
src/app/(customer)/(tabs)/
  _layout.tsx                    # <Tabs> with <Tabs.Screen> per tab + Ionicons placeholder icons
  index.tsx                      # <Redirect href="/(customer)/(tabs)/home" />
  home.tsx                       # inline placeholder (AppWrapper + AppText)
  bookings.tsx
  profile.tsx
```

Also patches `src/app/(customer)/_layout.tsx` to add `<Stack.Screen name="(tabs)" />` (converts self-closing Stack to wrapping form if needed; appends idempotently otherwise).

A final prompt asks **"Make tabs the role's landing destination?"** — answering yes rewrites `src/app/(<role>)/index.tsx` from its original first-screen redirect to `<Redirect href="/(<role>)/(tabs)" />`. Combined with `add role` answering yes to the root-initial prompt, this wires the full launch chain: `/` → `/(role)` → `/(role)/(tabs)` → first tab. Default `no` — outer redirect untouched; tabs reachable only via programmatic navigation.

Refuses when the role does not exist or is a standalone feature, when `(tabs)/` already exists, when the role layout is malformed, when tab count is outside 2–5, when tab names duplicate within the batch, or when a tab name hits the reserved list.

Swap placeholder Ionicons in `(tabs)/_layout.tsx` afterwards.

#### Naming

All names are accepted as `kebab-case`, `snake_case`, `space separated`, or `camelCase`/`PascalCase` and normalized to `camelCase`. ViewModel hooks use `PascalCase`: `teamDetails` → `useTeamDetailsViewModel`.

#### Atomic writes

Every command is all-or-nothing. If any step fails (e.g. a malformed `routes.tsx`), the command rolls back every file it just created or modified and surfaces the underlying error.

## Backend selection

The scaffold prompt `What backend type?` determines which packages are installed and which template files are copied:

| Choice (prompt) | `backendType` | Packages added | Template overlay |
|---|---|---|---|
| `Firebase (JS SDK)` | `firebase-js` | `firebase` | `templates/firebase-js/` — `src/core/firebase/index.ts` |
| `React Native Firebase` | `firebase-rn` | `@react-native-firebase/app` + auth/firestore/storage | `templates/firebase-rn/` — `src/core/firebase/index.ts` |
| `Supabase` | `supabase` | `@tanstack/react-query` + `@supabase/supabase-js` | `templates/supabase/` — `src/core/supabase/index.ts` |
| `Custom / none` | `custom-backend` | `@tanstack/react-query` + `axios` | (none) |

**Firebase sub-prompt:** selecting `Firebase` shows a second prompt — `Firebase SDK: Firebase JS SDK (Expo Go compatible)` → `firebase-js`; `React Native Firebase (requires dev client)` → `firebase-rn`.

**firebase-rn note:** React Native Firebase installs native modules that require a custom dev client. Expo Go is not supported. After scaffold, run `yarn ios` / `yarn android` to build the dev client first.

**TanStack Query provider:** inserted into `_layout.tsx` for `supabase` and `custom-backend`; omitted for firebase backends (which use Firebase's own reactivity).

**Firebase + accessToken:** when `firebase-js` or `firebase-rn` is selected, the CLI removes the `accessToken` field from `src/core/redux/slices/userSlice.ts` (and its `setAccessToken` reducer and `core/utils/config.ts` axios interceptor) — Firebase manages its own token lifecycle.

Non-interactive use: set `EXPO_BACKEND_TYPE` to one of the four values listed above (see [Environment variables](#environment-variables-non-interactive-runs)).

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

Disabled by default — `src/ui/theme/fonts.ts` exports an empty `Fonts` enum and `_layout.tsx` ships without `useFonts`. Use the `add fonts` recipe to install Google Fonts families:

```bash
npx react-native-expo-boilerplate add fonts
```

See the [`fonts` recipe](#font-recipe) section above for full details. `expo-font` is already in `dependencies` — no extra install needed, no native rebuild required.

## `@/*` alias

The template overrides `expo/tsconfig.base`'s default by setting `@/*` → `src/*`. All aliases (`@theme/*`, `@utils/*`, `@redux/*`, `@core/*`, `@services/*`, `@hooks/*`, `@appComponents/*`, `@components/*`, `@icons/*`, `@features/*`, `@assets`) resolve to their concrete dirs in `src/`. See `tsconfig.json` `compilerOptions.paths`.

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
| `EXPO_BACKEND_TYPE` | `"firebase-js"` \| `"firebase-rn"` \| `"supabase"` \| `"custom-backend"` | Backend selection. Required in non-TTY; throws when unset. Other values throw. |
| `EXPO_PRIMARY_FONT` | string | Family name for `add fonts` (e.g. `"Inter"`). Required when stdin is not a TTY. |
| `EXPO_SECONDARY_FONT` | string | Optional secondary family for `add fonts` (e.g. `"Sansita"`). Empty string = primary only. |

## Bin name

- npm package: `react-native-expo-boilerplate` (unscoped, public).
- Bin: `react-native-expo-boilerplate`.
- Run as `npx react-native-expo-boilerplate <dir>` (the package name) — `npx react-native-expo-boilerplate` only resolves after a `yarn global add` / `npm i -g` of this package.

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

`prepublishOnly` chains `npm run build && npm run test && npm run audit:templates` — `audit:templates` greps template files for unmapped import prefixes + Fonts-as-type misuse, blocking publish on stale audits. See `docs/MIRROR_NOTES.md` for the deviation log.

Publish:

```bash
npm publish
```

(Unscoped packages publish public by default — no `--access` flag needed.)

## License

MIT.
