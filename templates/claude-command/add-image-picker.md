---
name: add-image-picker
description: Retrofit image-picker support into an already-scaffolded react-native-expo-boilerplate project. Installs expo-image-picker via `expo install`, drops PermissionService, splices media constants, and adds the plugin entry to app.json.
---

# /add-image-picker — Retrofit image-picker into an existing project

Use when the user scaffolded a project with `image-picker=0` (or via an older CLI without the prompt) and now wants it.

## Preconditions

- cwd must be the Expo project root (the dir containing `app.json`).
- Project was scaffolded by `react-native-expo-boilerplate` (the `add` subcommand assumes the MyRoster-mirrored layout — `src/core/services/`, `src/core/utils/constants.ts`, lockfile at root, etc.).

## Run

```bash
npx --yes react-native-expo-boilerplate add image-picker
```

No env vars required. PM is detected from the project's lockfile (`yarn.lock` vs `package-lock.json`).

## What it does

1. Copies `PermissionService.ts` into `src/core/services/`.
2. Splices `MEDIA_TYPES` + `IMAGE_PICKER_OPTIONS` + `CAMERA_OPTIONS` into `src/core/utils/constants.ts`. Idempotent: skipped if `MEDIA_TYPES` already exported.
3. Adds the `expo-image-picker` plugin entry to `app.json` with default `photosPermission` + `cameraPermission` strings. Idempotent: skipped if entry already present.
4. Runs `expo install expo-image-picker --<pm>` so the installed version matches the project's Expo SDK.

## After it completes

Rebuild the dev-client so the new native dep links:

```bash
yarn ios       # or yarn android / npm run ios / npm run android
```

Customize the permission strings in `app.json` (`expo.plugins`) if the default copy doesn't fit the app's tone. Add `microphonePermission` manually if the app records video.

## Idempotency

- File overlay: overwrites `PermissionService.ts`. Re-running clobbers user edits.
- Constants splice: skipped on re-run.
- Plugin entry: skipped on re-run.
- `expo install`: no-op when the dep is already at SDK-compatible version.
