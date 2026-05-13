# **APP_NAME**

Expo SDK 54 app scaffolded by [`react-native-expo-boilerplate`](https://github.com/Mubasher-dv/react-native-expo-boilerplate).

## Run

```bash
yarn ios       # or: yarn android  (npm run ios / npm run android also work)
```

`yarn ios` / `yarn android` map to `expo run:ios` / `expo run:android` — these BUILD + install the custom dev-client + launch in one shot. First run takes 3–10 min (native build); subsequent runs are fast.

After the dev-client is installed, use `yarn start` (= `expo start --dev-client`) for the fast bundler-only loop.

## Not Expo Go-compatible

Ships native modules that Expo Go can't load — `react-native-mmkv`, `react-native-gesture-handler`, `react-native-reanimated` (+ `react-native-worklets`), `react-native-keyboard-controller`. The custom dev-client built by `yarn ios` / `yarn android` is mandatory.

iOS prerequisites: Xcode + CocoaPods (`sudo gem install cocoapods`).
Android prerequisites: Android SDK + emulator (or USB device with debugging) + `JAVA_HOME` → JDK 17.

## Project structure

```
src/
  app/                   expo-router routes (file-based)
  ui/
    appComponents/         opinionated reusable components
    components/            bare reusable components
    iconComponents/        icon font wrappers
    theme/                 colors, fonts, responsive
  core/
    redux/                 redux store + slices
    services/              service classes
    utils/                 utils + constants + endpoints
    hooks/                 custom hooks
  features/              feature modules (auth, home, …)
  assets/
    fonts/                 .ttf / .otf
    images/                project images
    icon.png               app icon (referenced from app.json)
    adaptive-icon.png      Android adaptive icon foreground
    splash-icon.png        splash centered image
```

Path aliases (configured in `tsconfig.json` + `babel.config.js`):

| Alias              | Resolves to               |
| ------------------ | ------------------------- |
| `@/*`              | `src/*`                   |
| `@theme/*`         | `src/ui/theme/*`          |
| `@utils/*`         | `src/core/utils/*`        |
| `@redux/*`         | `src/core/redux/*`        |
| `@core/*`          | `src/core/*`              |
| `@services/*`      | `src/core/services/*`     |
| `@hooks/*`         | `src/core/hooks/*`        |
| `@appComponents/*` | `src/ui/appComponents/*`  |
| `@components/*`    | `src/ui/components/*`     |
| `@icons/*`         | `src/ui/iconComponents/*` |
| `@features/*`      | `src/features/*`          |
| `@assets`          | `src/assets`              |

## Post-scaffold recipes

Add anything you skipped during scaffold — run from this directory:

```bash
npx react-native-expo-boilerplate add bottom-sheet     # @gorhom/bottom-sheet + 5 components
npx react-native-expo-boilerplate add image-picker     # expo-image-picker + PermissionService + constants
npx react-native-expo-boilerplate add app-icon         # interactive: source path → updates app.json + copies asset
npx react-native-expo-boilerplate add splash           # interactive: color + image → expo-splash-screen plugin + layout wiring
```

Rebuild after each recipe:

- Library recipes (`bottom-sheet`, `image-picker`) → `yarn ios` / `yarn android` (links new native module into dev-client).
- Asset recipes (`app-icon`, `splash`) → `npx expo prebuild --clean` then `yarn ios` / `yarn android` (regenerates ios/ + android/ from app.json).

### Generate role / feature / screen

Two layout shapes, dispatched by argument arity:

```bash
# Hierarchical role → feature → screen (3 levels)
react-native-expo-boilerplate add role <role>                       # prompts feature + screen
react-native-expo-boilerplate add feature <role> <name>             # prompts screen + initial?
react-native-expo-boilerplate add screen <role> <feature> <name>    # prompts initial?

# Standalone feature → screen (2 levels, flat; for auth-style namespaces)
react-native-expo-boilerplate add feature <name>                    # prompts first screen
react-native-expo-boilerplate add screen <feature> <name>           # prompts initial?

# Bottom tabs inside a hierarchical role
react-native-expo-boilerplate add bottom-tab <role>                 # prompts tab count (2–5) + names
```

`add role auth` is refused — use `add feature auth` instead (auth is a standalone feature).

Names are normalized to `camelCase`. ViewModels and components use `PascalCase`. Atomic: rolls back on failure.

See the project README for the full layout and collision rules.

## Bundle identifier

Defaults to `com.<app-name-no-dashes>`. Edit `app.json` `expo.ios.bundleIdentifier` + `expo.android.package` before submitting to App Store / Play Store.

## Fonts

Disabled by default — `src/ui/theme/fonts.ts` exports `Fonts = {} as const`. To enable: drop `.ttf` files into `src/assets/fonts/`, populate `Fonts`, add `useFonts(...)` + a loading guard in `src/app/_layout.tsx`. `expo-font` is already installed.

<!-- ## License

(Add yours.) -->
