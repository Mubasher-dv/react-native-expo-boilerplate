---
name: add-bottom-sheet
description: Retrofit bottom-sheet support into an already-scaffolded react-native-expo-boilerplate project. Installs @gorhom/bottom-sheet via `expo install` and overlays the 5 bottom-sheet appComponents.
---

# /add-bottom-sheet — Retrofit bottom-sheet into an existing project

Use when the user scaffolded a project with `bottom-sheet=0` (or via an older CLI without the prompt) and now wants it.

## Preconditions

- cwd must be the Expo project root (the dir containing `app.json`).
- Project was scaffolded by `react-native-expo-boilerplate` (the `add` subcommand assumes the MyRoster-mirrored layout — `src/ui/appComponents/`, lockfile at root, etc.).

## Run

```bash
npx --yes react-native-expo-boilerplate add bottom-sheet
```

No env vars required. PM is detected from the project's lockfile (`yarn.lock` vs `package-lock.json`).

## What it does

1. Copies `templates/bottom-sheet/` (5 components) into `src/ui/appComponents/`.
2. Runs `expo install @gorhom/bottom-sheet --<pm>` so the installed version matches the project's Expo SDK.

## After it completes

Rebuild the dev-client so the new native dep links:

```bash
yarn ios       # or yarn android / npm run ios / npm run android
```

## Idempotency

- File overlay: overwrites. Re-running clobbers user edits to the 5 template files. Surface this if the user re-runs.
- `expo install`: no-op when the dep is already at SDK-compatible version.
