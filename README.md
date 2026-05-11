# `codingpixel-expo-app`

Opinionated Expo SDK 54+ app scaffolder. Mirrors the [MyRoster](https://github.com/) project's component / redux / theme conventions; layers them on top of `create-expo-app`'s `blank-typescript` template; runs all native-dep installs through `expo install` so versions match the target SDK; ships a single lockfile (yarn OR npm — never both).

## Quickstart

```bash
npx codingpixel-expo-app my-app
cd my-app
npx expo prebuild
yarn ios       # or: npm run ios / yarn android / npm run android
```

The bin name is `codingpixel-expo` (used after global install). Invoke through `npx codingpixel-expo-app` (the package name) for one-shot runs.

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

## Fonts

Fonts are intentionally disabled in v0.1.x — generated `src/ui/theme/fonts.ts` exports `Fonts = {} as const` + `FontKey = never`, and `_layout.tsx` ships without `useFonts`. Apps that need custom fonts wire `expo-font` themselves (drop `.ttf`s into `assets/fonts/`, populate `Fonts`, add `useFonts(...)` + a loading guard in `_layout.tsx`).

`expo-font` is already in `dependencies`, so no extra install is needed.

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
