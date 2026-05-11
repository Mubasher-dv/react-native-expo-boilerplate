# `@codingpixel/create-expo-app`

Opinionated Expo SDK 54+ app scaffolder. Mirrors the [MyRoster](https://github.com/) project's component / redux / theme conventions; layers them on top of `create-expo-app`'s `blank-typescript` template; runs all native-dep installs through `expo install` so versions match the target SDK; ships a single lockfile (yarn OR npm — never both).

## Quickstart

```bash
npx @codingpixel/create-expo-app my-app
cd my-app
npx expo prebuild
yarn ios       # or: npm run ios / yarn android / npm run android
```

The bin name is `codingpixel-expo` (used after global install). Invoke through `npx @codingpixel/create-expo-app` (the package name) for one-shot runs.

## Not Expo Go-compatible

This template ships native modules that Expo Go can't load:

- `react-native-mmkv` (redux-persist storage)
- `react-native-gesture-handler`
- `react-native-reanimated` (+ `react-native-worklets`)
- `react-native-keyboard-controller`
- `@gorhom/bottom-sheet` (when bottom-sheet support enabled)

You **must** prebuild + run a custom dev-client:

```bash
npx expo prebuild
yarn ios       # or yarn android / npm run ios / npm run android
```

Subsequent runs use the dev-client + bundler (`yarn start`).

## Adding fonts after install

The CLI generates `src/ui/theme/fonts.ts` from your `EXPO_PRIMARY_FONT` / `EXPO_SECONDARY_FONT` answers using filename convention `<FontName>-<Weight>.ttf` for `Regular`, `Medium`, `SemiBold`, `Bold`.

Drop the matching files into `assets/fonts/` (created by the CLI):

```
assets/fonts/Inter-Regular.ttf
assets/fonts/Inter-Medium.ttf
assets/fonts/Inter-SemiBold.ttf
assets/fonts/Inter-Bold.ttf
```

Metro logs missing entries on bundle. The `useFonts(...)` call inside `_layout.tsx` references all 4 (or 8 with secondary) at once.

## `@/*` alias

The template overrides `expo/tsconfig.base`'s default by setting `@/*` → `src/*`. All MyRoster-style aliases (`@theme/*`, `@utils/*`, `@redux/*`, `@core/*`, `@services/*`, `@hooks/*`, `@appComponents/*`, `@components/*`, `@icons/*`, `@features/*`, `@assets`) resolve to their concrete dirs in `src/`. See `tsconfig.json` `compilerOptions.paths`.

If your generated app's `tsconfig.json` already has a `@/*` mapping, the CLI preserves it + warns.

## First-time dev-client build

iOS:
- Xcode + CocoaPods installed (`sudo gem install cocoapods` if missing).
- `npx expo prebuild` then `yarn ios` (or `npm run ios`) — opens the iOS simulator with your custom dev-client.

Android:
- Android SDK + emulator running (or a USB-attached device with debugging enabled).
- `JAVA_HOME` pointing at JDK 17.
- `npx expo prebuild` then `yarn android` (or `npm run android`).

## Expo SDK compatibility

Built + tested against Expo SDK 54.x (probed via `docs/SDK_NOTES.md` at template-author time). Native dep versions are inherited at scaffold time via `expo install`, so subsequent SDK bumps update the deps without a CLI release.

If `expo install` reports version-resolution failures, the CLI runs an isolation retry (`retryWithIsolation`) — drops the failing dep, retries the rest, and surfaces the failed name + verbatim Expo stderr at the end.

## Environment variables (non-interactive runs)

All four are required when stdin is not a TTY (e.g. slash-command flows). Empty string is a valid signal — `EXPO_PRIMARY_FONT=""` means "explicitly no fonts".

| Var | Type | Notes |
|---|---|---|
| `EXPO_PRIMARY_FONT` | string | Empty → skip fonts. Skips secondary too. |
| `EXPO_SECONDARY_FONT` | string | Skipped automatically if primary empty. |
| `EXPO_INCLUDE_BOTTOM_SHEET` | `"0"` or `"1"` | Other values throw before any fs mutation. |
| `EXPO_INCLUDE_IMAGE_PICKER` | `"0"` or `"1"` | Same. |
| `EXPO_PACKAGE_MANAGER` | `"yarn"` or `"npm"` | Optional override; auto-detect otherwise. Other values throw. |

## Bin name + scope

- npm package: `@codingpixel/create-expo-app` (scoped, public).
- Bin: `codingpixel-expo`.
- Run as `npx @codingpixel/create-expo-app <dir>` (the package name) — `npx codingpixel-expo` only resolves after a `yarn global add` / `npm i -g` of this package.

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
npm publish --access public
```

(Scoped packages default to private; `--access public` is required for the npm registry.)

## License

MIT.
