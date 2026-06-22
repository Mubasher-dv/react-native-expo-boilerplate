---
name: add-fonts
description: Add Google Fonts (primary + optional secondary) to an existing react-native-expo-boilerplate project. Fetches TTFs via @expo-google-fonts tarball (no project mutation), writes them to src/assets/fonts/, populates src/ui/theme/fonts.ts, and patches src/app/_layout.tsx.
---

# /add-fonts — Add Google Fonts to an existing project

Use when the user scaffolded a project without fonts (or with a different family) and now wants Google Fonts wired in.

## Preconditions

- cwd must be the Expo project root (the dir containing `app.json`).
- Project was scaffolded by `react-native-expo-boilerplate`.

## Run

```bash
npx --yes react-native-expo-boilerplate add fonts
```

You will be prompted for primary + secondary font families.

### Non-interactive

```bash
EXPO_PRIMARY_FONT="Inter" EXPO_SECONDARY_FONT="Sansita" \
  npx --yes react-native-expo-boilerplate add fonts
```

Multi-word family names **must** be quoted — the shell splits on spaces otherwise:

```bash
EXPO_PRIMARY_FONT="Open Sans" EXPO_SECONDARY_FONT="Noto Sans" \
  npx --yes react-native-expo-boilerplate add fonts
```

## What it does

1. Looks up `@expo-google-fonts/<family>` on the npm registry via `npm view <pkg> dist.tarball`.
2. Downloads the tarball to a scratch directory, extracts it, copies TTFs to `src/assets/fonts/`, deletes the scratch dir. **Never modifies your `package.json` or lockfile.**
3. Writes `src/assets/fonts/.codingpixel-fonts.json` sidecar recording installed state (used for idempotent re-runs and splash×fonts coordination).
4. Rewrites `src/ui/theme/fonts.ts` with a populated `export enum Fonts { ... }`.
5. Patches `src/app/_layout.tsx` with the `useFonts(...)` hook + (if `expo-splash-screen` already installed) the `SplashScreen.hideAsync()` useEffect inside a marker block.

## After it completes

No native rebuild required — TTFs and `useFonts` are JS-side.

## Idempotency

- Re-running with the same family is a no-op (sidecar short-circuit — Decision #15).
- Re-running with a different family swaps the TTFs + rewrites `fonts.ts`.
- Empty primary input when fonts are installed → confirm-prompts a clean wipe (Decision #14).
- User TTFs in `src/assets/fonts/` that don't match the recipe-owned pattern (`<Family>-<Suffix>.ttf`) are preserved.
