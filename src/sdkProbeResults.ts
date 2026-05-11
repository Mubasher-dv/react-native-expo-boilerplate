// Probe values captured during template authoring (run `scripts/run-probes.sh`
// to regenerate when bumping target SDK; then update this file by hand).
//
// These values are compiled into `dist/` so the CLI has them at runtime without
// depending on `docs/SDK_NOTES.md` being shipped in the npm tarball. Shipping
// the docs file was tried earlier and left two real bugs:
//   1. `BABEL_PRESET_AUTO_INCLUDES_WORKLETS` defaulted false → patchBabel
//      added `react-native-worklets/plugin` even though babel-preset-expo
//      already auto-includes it (double-load risk + duplicate-plugin warnings).
//   2. `EXPO_TSCONFIG_BASEURL` defaulted "inherited" → `baseUrl` never set
//      → TS path resolution fragile.
//
// Constants here override `readSDKNotes` (which is now a fallback for
// out-of-tree development scenarios).

export type WorkletsPackageName =
  | "react-native-worklets"
  | "react-native-worklets-core";

export const SDK_PROBE_RESULTS = {
  /** Pinned by template-authoring date — bump alongside Expo SDK upgrades. */
  EXPO_SDK_VERSION: "~54.0.33",
  /** SDK 54+ `babel-preset-expo` auto-includes worklets/reanimated plugin. */
  BABEL_PRESET_AUTO_INCLUDES_WORKLETS: true,
  /** Canonical name per SDK 54 (vs the legacy `-core` variant). */
  WORKLETS_PKG: "react-native-worklets" as WorkletsPackageName,
  /** SDK 54 `expo/tsconfig.base` does NOT provide `baseUrl` → patcher sets ".". */
  EXPO_TSCONFIG_BASEURL_INHERITED: false,
  /** SDK 54 `npx expo install --yarn`/`--npm` flags supported (Branch A). */
  FLAGS_OK: true,
  /** SDK 54 `expo install` materializes lockfile → no explicit PM install needed. */
  PROBE_PASS: true,
} as const;
