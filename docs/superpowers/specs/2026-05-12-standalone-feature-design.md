# Standalone Feature (auth-style) — Design

**Date:** 2026-05-12
**Status:** Approved
**CLI version target:** 0.3.2
**Builds on:** `2026-05-12-role-feature-screen-commands-design.md`

## Goal

Extend `react-native-expo-boilerplate` with a **standalone feature** concept — a top-level feature that owns its own Expo Router group and contains screens directly (no intermediate feature subfolder). Designed for cases like `auth` where each "thing" (login, signUp, forgotPassword) is just a screen, and the 3-level role/feature/screen hierarchy is overkill.

Existing hierarchical role/feature/screen flow stays unchanged for cases like `customer/dashboard/home`.

### Concrete target

```
react-native-expo-boilerplate add feature auth                # standalone: creates (auth) + features/auth/ + first screen
react-native-expo-boilerplate add screen auth login           # flat screen directly under auth
react-native-expo-boilerplate add screen auth signUp          # ...
react-native-expo-boilerplate add screen auth forgotPassword  # ...
```

Versus unchanged hierarchical:

```
react-native-expo-boilerplate add role customer
react-native-expo-boilerplate add feature customer dashboard
react-native-expo-boilerplate add screen customer dashboard home
```

## Command grammar — arity dispatch

| Command | Arity | Behavior |
| --- | --- | --- |
| `add role <name>` | 1 | **Existing.** Hierarchical role + first feature + first screen. `auth` is refused with a hint to use `add feature auth`. |
| `add feature <name>` | **1 (NEW)** | Standalone flat feature. Creates `(name)` route group + `features/<name>/types.ts` + first screen (prompt). |
| `add feature <role> <name>` | 2 | **Existing.** Nested feature under role. |
| `add screen <feature> <name>` | **2 (NEW)** | Flat screen under standalone feature. Prompts: `makeInitial`. |
| `add screen <role> <feature> <name>` | 3 | **Existing.** Nested screen. |

Dispatcher in `src/index.ts`:

```ts
if (argv[0] === "add" && argv[1] === "feature") {
  if (argv[3]) await addFeature(argv[2], argv[3]);            // 2-arg (nested)
  else        await addStandaloneFeature(argv[2]);            // 1-arg (NEW, flat)
  return;
}
if (argv[0] === "add" && argv[1] === "screen") {
  if (argv[4]) await addScreen(argv[2], argv[3], argv[4]);    // 3-arg (nested)
  else        await addFlatScreen(argv[2], argv[3]);          // 2-arg (NEW, flat)
  return;
}
```

Pure argv-length dispatch — no flags, no marker files, no filesystem inspection at dispatch time.

## File layout

`add feature auth` (prompts first screen = `login`):

```
src/features/auth/
  types.ts                              # shared types for all auth screens
  login/
    index.tsx                           # default export <Login>
    viewModel/
      _api.ts
      useLoginViewModel.tsx
src/app/(auth)/
  _layout.tsx                           # <Stack screenOptions={{ headerShown: false }} />
  index.tsx                             # <Redirect href="/(auth)/login" />
  login.tsx                             # re-export from @features/auth/login
src/app/routes.tsx                      # spliced: <Stack.Screen name="(auth)" />
```

`add screen auth signUp` later:

```
src/features/auth/signUp/index.tsx + viewModel/...
src/app/(auth)/signUp.tsx
```

Re-export for flat: `export { default } from "@features/<feature>/<screen>";` — **2 segments**. Hierarchical stays 3 segments (`@features/<role>/<feature>/<screen>`).

## `shared.ts` additions

| Function / const | Purpose |
| --- | --- |
| `ROLE_REFUSAL_HINTS: Record<string, string>` | Names that should be features, not roles. Initial entry: `{ auth: "use \`add feature auth\` instead" }`. |
| `assertNotRoleRefusal(role: string): void` | Throws if `role` (post-normalize, lowercase) is in `ROLE_REFUSAL_HINTS`. |
| `isStandaloneFeature(target, name): boolean` | True if `src/app/(<name>)/` exists. (Hierarchical roles also have this; combined with the absence of nested feature dirs in `features/<name>/`, this is sufficient.) |
| `standaloneFeatureExists(target, name): boolean` | True if `features/<name>/` exists AND `src/app/(<name>)/` exists. |
| `topLevelNameTaken(target, name): { kind: "role" \| "standalone" \| "groupOnly" \| "featuresOnly" } \| null` | Reports collision with role OR standalone feature OR partial state. |
| `flatScreenDir(target, feature, screen): string` | `features/<feature>/<screen>/` |
| `flatViewModelDir(target, feature, screen): string` | `features/<feature>/<screen>/viewModel/` |
| `writeStandaloneFeatureTypes(target, feature, j): string` | Writes `features/<feature>/types.ts`. |
| `writeFlatScreenFiles(target, feature, screen, j): string[]` | index + _api + viewModel. |
| `buildFlatScreenReExport(feature, screen): string` | `export { default } from "@features/<feature>/<screen>";\n` |
| `writeFlatRouteReExport(target, feature, screen, j): string` | Writes `src/app/(<feature>)/<screen>.tsx`. |
| `readFlatRouteFileFeatureOwner(target, feature, screen): string \| null` | Parses `@features/<feature>/<screen>` from existing re-export; returns feature name when collision points at flat re-export, otherwise null. |

Existing exports reused unchanged:
- `assertFeatureName`, `assertScreenName`, `normalizeCamelCase`, `pascalCase`.
- `assertRoutesParseable`, `registerRoleInRoutes` (works for any `(name)` group — role or standalone).
- `updateRedirectTarget` (works on `(feature)/index.tsx` same as `(role)/index.tsx`).
- `writeRoleGroup` (writes `_layout` + redirect index — same shape for standalone).
- `buildRoleLayout`, `buildRoleRedirect` — reused; PascalCase fn name reads naturally for both (`AuthLayout`, `AuthIndex`).
- `routeFile`, `routeGroupDir`, `layoutFile`, `redirectFile` — paths are identical (just `<role>` swapped for `<feature>`).

## Command behavior

### `add feature <name>` (1-arg, standalone) — new `src/commands/standaloneFeature.ts`

1. `assertExpoApp(target)`.
2. `name = assertFeatureName(arg)` (reuse feature-name validator — same rules: reserved-name reject, length, pattern).
3. Refuse if `topLevelNameTaken(target, name)` → error names the collision kind (`role`, `standalone`, or partial state with diagnostic path).
4. `assertRoutesParseable(target)` — runs **before any disk writes**.
5. Prompt: **"First screen name?"** (required, no default).
6. `screen = assertScreenName(prompt)`.
7. Pre-flight: refuse if `routeFileExists(target, name, screen)` — clear error naming `src/app/(<name>)/<screen>.tsx`.
8. Atomic writes (Journal):
   - `features/<name>/types.ts`
   - `features/<name>/<screen>/index.tsx`
   - `features/<name>/<screen>/viewModel/_api.ts`
   - `features/<name>/<screen>/viewModel/use<Pascal>ViewModel.tsx`
   - `src/app/(<name>)/_layout.tsx`
   - `src/app/(<name>)/index.tsx` (redirect to first screen)
   - `src/app/(<name>)/<screen>.tsx` (flat re-export — 2 segments)
9. `registerRoleInRoutes(target, name, j)` — splice `<Stack.Screen name="(<name>)" />`.
10. `printFilesChanged` + `printRebuildReminder`.

Try/catch wraps 8–9; rollback restores all recorded creates/edits on failure.

### `add screen <feature> <name>` (2-arg, flat) — new `src/commands/flatScreen.ts`

1. `assertExpoApp(target)`.
2. `feature = assertFeatureName(featureArg)`.
3. Refuse if NOT `isStandaloneFeature(target, feature)` — error: *"`<feature>` is not a standalone feature. For hierarchical roles, use `add screen <role> <feature> <name>` (3-arg form)."*
4. `screen = assertScreenName(nameArg)`.
5. Refuse if `flatScreenDir` already exists.
6. Refuse if `routeFileExists(target, feature, screen)` — names the existing route file; if a re-export `@features/<X>/<screen>` is parseable, names the owning feature `X` too.
7. Prompt: **"Make initial screen of stack?"** (yes/no).
8. Atomic writes:
   - `features/<feature>/<screen>/index.tsx`
   - `features/<feature>/<screen>/viewModel/_api.ts`
   - `features/<feature>/<screen>/viewModel/use<Pascal>ViewModel.tsx`
   - `src/app/(<feature>)/<screen>.tsx` (flat re-export)
9. If `makeInitial` → `updateRedirectTarget(target, feature, screen, j)`.
10. `printFilesChanged` + `printRebuildReminder`.

### `add role <name>` — additions

Insert two new guards immediately after the existing `assertRoleName` normalize step:

1. `assertNotRoleRefusal(role)` — throws on `auth` (and any future entries in `ROLE_REFUSAL_HINTS`) with hint to use `add feature <name>` instead.
2. Extend the role-existence guard to use `topLevelNameTaken(target, role)` so it also refuses when a **standalone feature** with the same name exists.

## `ROLE_REFUSAL_HINTS`

Initial map:

```ts
export const ROLE_REFUSAL_HINTS: Record<string, string> = {
  auth: "use `add feature auth` instead",
};
```

Lookup is case-insensitive against the normalized form (camelCase, lowercased). Extending the map in future iterations is a non-breaking change.

## File templates

Reuse all existing builders unchanged:
- `buildFeatureTypes(feature)` — `// Types for <feature>` + `export {};`. Identical for flat root types.
- `buildScreenIndex`, `buildScreenViewModel`, `buildScreenApi`, `buildRoleLayout`, `buildRoleRedirect` — identical.

New builder:

```ts
buildFlatScreenReExport(feature, screen) →
  `export { default } from "@features/${feature}/${screen}";\n`
```

## Atomic writes and rollback

Same `Journal` pattern as existing commands. Each new command (`addStandaloneFeature`, `addFlatScreen`) builds a journal, wraps writes in try/catch, calls `rollback(j)` on failure, rethrows original error.

Pre-flight checks (`assertExpoApp`, `assertFeatureName`, `topLevelNameTaken`, `assertRoutesParseable`, `routeFileExists`, `isStandaloneFeature`, `flatScreenDir`-exists, prompts) all run before journal creation — they cannot trigger rollback because no writes have happened.

Terminal output on failure: `log.error("add feature failed — rolling back changes")` / `add flat screen failed — rolling back changes` followed by the underlying error.

## Validation, normalization, parsing

Unchanged from the role/feature/screen spec:
- Pre-normalize: `[a-zA-Z0-9\s\-_]+`.
- Camel-join, lowercase first char.
- Post-normalize: `/^[a-z][a-zA-Z0-9]*$/`, length 1–40.
- Reserved-name reject (unchanged list).

## Testing strategy

New test files:

- **`tests/commands/standaloneFeature.test.ts`** — full `addStandaloneFeature` flow against tmp dir:
  - Files written + routes.tsx patched + flat re-export shape.
  - Refuse on `topLevelNameTaken` (role exists, standalone exists, partial state).
  - Refuse on bad routes.tsx (pre-flight, no disk writes).
  - Refuse on route-file collision (pre-flight).
  - Refuse on reserved name.
  - Rollback: `_failAfterWrites` stub → no files remain, routes.tsx unchanged.

- **`tests/commands/flatScreen.test.ts`** — `addFlatScreen`:
  - Adds sibling flat screen.
  - Refuse when feature does not exist.
  - Refuse when feature is **not standalone** (hierarchical role-feature passed in).
  - Refuse when screen folder already exists.
  - Refuse on route-file collision — error names owning feature.
  - `makeInitial = true` rewrites redirect.
  - Rollback: late failure leaves filesystem unchanged.

Extend existing test files:

- **`tests/commands/shared.test.ts`** — `assertNotRoleRefusal`, `isStandaloneFeature`, `topLevelNameTaken` cases, `writeStandaloneFeatureTypes`, `writeFlatScreenFiles`, `writeFlatRouteReExport`, `readFlatRouteFileFeatureOwner` (happy + null).

- **`tests/commands/role.test.ts`** — `add role auth` refused with hint message; `add role X` refused when standalone feature `X` already exists.

## README + slash-command updates

- **`README.md`** — extend "Generate role/feature/screen" with the standalone-feature subsection (auth example showing `add feature auth` + sibling `add screen auth signUp`). Document `add role auth` refusal.
- **`templates/base/README.md`** — single-line addition under "Generate role/feature/screen": *"`add feature <name>` (1-arg) = standalone feature (auth-style); `add feature <role> <name>` (2-arg) = nested feature under role."*
- **`templates/claude-command/add-feature.md`** — document both 1-arg and 2-arg shapes.
- **`templates/claude-command/add-screen.md`** — document both 2-arg and 3-arg shapes.
- **`templates/claude-command/add-role.md`** — note `auth` refusal + recommendation.

## Out of scope

- Migration commands (convert standalone ↔ hierarchical).
- `--initial` non-interactive flag for flat screen.
- Removing standalone features.
- Additional names in `ROLE_REFUSAL_HINTS` beyond `auth` (deliberately conservative; add as concrete cases arise).

## Open follow-ups

- `remove feature <name>` / `remove screen <feature> <name>` mirror commands for standalone forms.
- `--initial` flag to skip the makeInitial prompt.
- More entries in `ROLE_REFUSAL_HINTS` if users hit other obvious naming mistakes.
