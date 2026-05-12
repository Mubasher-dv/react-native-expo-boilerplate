# Role / Feature / Screen Commands — Design

**Date:** 2026-05-12
**Status:** Approved
**CLI version target:** 0.3.0

## Goal

Add three new post-scaffold commands to the `codingpixel-expo-app` CLI so users can generate feature folders, route groups, and MVVM screens after the initial scaffold without hand-rolling boilerplate.

- `add role <name>` — creates a feature root + Expo Router group + first feature + first screen.
- `add feature <role> <name>` — adds a new feature under an existing role, with one screen.
- `add screen <role> <feature> <name>` — adds a single screen to an existing feature.

All three integrate with the existing `add` dispatcher in `src/index.ts` alongside `bottom-sheet`, `image-picker`, `app-icon`, `splash`.

## Architecture

New module: `src/commands/`

```
src/commands/
├── role.ts        # addRole()
├── feature.ts     # addFeature()
├── screen.ts      # addScreen()
└── shared.ts      # normalization, validation, file writers
```

Existing recipes stay in `src/add.ts`. `src/index.ts` gains an early dispatcher branch:

```ts
if (argv[0] === "add" && argv[1] === "role")    { await addRole(argv[2]); return; }
if (argv[0] === "add" && argv[1] === "feature") { await addFeature(argv[2], argv[3]); return; }
if (argv[0] === "add" && argv[1] === "screen")  { await addScreen(argv[2], argv[3], argv[4]); return; }
```

Falls through to existing `runAdd()` for the four existing recipes.

### `shared.ts` exports

| Function | Purpose |
| --- | --- |
| `normalizeCamelCase(input: string): string` | Splits on whitespace/`-`/`_`, camel-joins, lowercases first char |
| `pascalCase(camel: string): string` | Uppercase first char |
| `assertRoleName(name: string): string` | Validate + normalize + reject reserved; returns normalized |
| `assertFeatureName(name: string): string` | Same |
| `assertScreenName(name: string): string` | Same |
| `roleExists(target, role): boolean` | Refuse-on-existing check |
| `featureExists(target, role, feature): boolean` | Same |
| `screenExists(target, role, feature, screen): boolean` | Same |
| `routeFileExists(target, role, screen): boolean` | Collision check for `src/app/(<role>)/<screen>.tsx` |
| `writeScreenFiles(target, role, feature, screen): string[]` | Writes view + viewModel files; returns file paths |
| `writeFeatureTypes(target, role, feature): string` | Writes `types.ts`; returns path |
| `writeRouteReExport(target, role, feature, screen): string` | Writes re-export route file |
| `writeRoleGroup(target, role, initialScreen): string[]` | Writes `_layout.tsx` + `index.tsx` redirect |
| `updateRedirectTarget(target, role, screen): string` | Rewrites redirect href |
| `registerRoleInRoutes(target, role): string \| null` | Splices `<Stack.Screen name="(<role>)" />` into `routes.tsx`; null if idempotent skip |
| `printFilesChanged(files: string[]): void` | Reuses pattern from `add.ts` |

### Reserved names (rejected for any of role/feature/screen)

`add`, `role`, `feature`, `screen`, `index`, `_layout`, `app`, `features`, `routes`, `bottom-sheet`, `image-picker`, `app-icon`, `splash`. Compared case-insensitive against normalized form.

## Command behavior

### `add role <name>`

1. Validate `name` (or prompt if missing). Normalize → camelCase. Reject reserved.
2. Refuse if `src/features/<role>/` OR `src/app/(<role>)/` already exists.
3. Pre-flight `src/app/routes.tsx` parseable: contains the `<Stack screenOptions={{ headerShown: false }}>` pattern. Refuse loudly if not. **This check runs before any disk writes** so the splice failure cannot leave a partially-created role on disk.
4. Prompt: **"First feature name?"** (required, no default).
5. Prompt: **"First screen name?"** (required, no default).
6. Pre-flight collision: `src/app/(<role>)/<screen>.tsx`.
7. Write in order:
   - `src/features/<role>/<feature>/types.ts`
   - `src/features/<role>/<feature>/<screen>/index.tsx`
   - `src/features/<role>/<feature>/<screen>/viewModel/_api.ts`
   - `src/features/<role>/<feature>/<screen>/viewModel/use<Pascal>ViewModel.tsx`
   - `src/app/(<role>)/_layout.tsx` (empty Stack, `headerShown: false`)
   - `src/app/(<role>)/index.tsx` — `<Redirect href="/(<role>)/<screen>" />`
   - `src/app/(<role>)/<screen>.tsx` — re-export
8. Splice `<Stack.Screen name="(<role>)" />` into `src/app/routes.tsx`. Idempotent.
9. `printFilesChanged`.
10. Rebuild reminder (`yarn ios` / `yarn android`).

### `add feature <role> <name>`

1. Args or prompt. Validate + normalize.
2. Refuse if `src/features/<role>/` does not exist (role must be created first).
3. Refuse if `src/features/<role>/<feature>/` already exists.
4. Prompt: **"Screen name?"** (required, no default).
5. Pre-flight: refuse if `src/app/(<role>)/<screen>.tsx` exists (collision with another feature's screen — error names the existing route file).
6. Prompt: **"Make initial screen of stack?"** (yes/no).
7. Write:
   - `src/features/<role>/<feature>/types.ts`
   - `src/features/<role>/<feature>/<screen>/index.tsx` + viewModel files
   - `src/app/(<role>)/<screen>.tsx` re-export
8. If "initial" = yes → `updateRedirectTarget` on `src/app/(<role>)/index.tsx`.
9. `printFilesChanged` + rebuild reminder.

### `add screen <role> <feature> <name>`

1. Args or prompt. Validate + normalize.
2. Refuse if `src/features/<role>/<feature>/` does not exist.
3. Refuse if `src/features/<role>/<feature>/<screen>/` already exists.
4. Pre-flight: refuse if `src/app/(<role>)/<screen>.tsx` exists (collision — clear error naming the existing route file and its feature).
5. Prompt: **"Make initial screen of stack?"** (yes/no).
6. Write:
   - `src/features/<role>/<feature>/<screen>/index.tsx`
   - `src/features/<role>/<feature>/<screen>/viewModel/_api.ts`
   - `src/features/<role>/<feature>/<screen>/viewModel/use<Pascal>ViewModel.tsx`
   - `src/app/(<role>)/<screen>.tsx` re-export
7. If "initial" = yes → `updateRedirectTarget`.
8. `printFilesChanged` + rebuild reminder.

## Placeholders used in templates

In the template snippets below:

- `<role>`, `<feature>`, `<screen>` — the normalized camelCase names.
- `<Pascal>` — `pascalCase(screen)`. Example: `screen = "teamDetails"` → `<Pascal> = "TeamDetails"`.
- `<RolePascal>` — `pascalCase(role)`. Example: `role = "auth"` → `<RolePascal> = "Auth"`.

## File templates

### `features/<role>/<feature>/types.ts`

```ts
// Types/interfaces for <feature> feature.
// Add request/response shapes, domain models, prop types here.

export {};
```

### `features/<role>/<feature>/<screen>/index.tsx`

```tsx
import AppText from "@appComponents/appText";
import AppWrapper from "@appComponents/appWrapper";
import { Colors } from "@theme/colors";
import { use<Pascal>ViewModel } from "./viewModel/use<Pascal>ViewModel";

export default function <Pascal>() {
  const {} = use<Pascal>ViewModel();

  return (
    <AppWrapper>
      <AppText size={20} color={Colors.BLACK}>
        <Pascal> screen
      </AppText>
    </AppWrapper>
  );
}
```

### `features/<role>/<feature>/<screen>/viewModel/use<Pascal>ViewModel.tsx`

```tsx
// ViewModel for <Pascal> screen.
// Owns local state, derived state, side effects, handlers.
// Calls API functions from ./_api.

export function use<Pascal>ViewModel() {
  return {};
}
```

### `features/<role>/<feature>/<screen>/viewModel/_api.ts`

```ts
// API calls for <Pascal> screen.
// Group fetch/mutation functions here; consume from ViewModel.

export {};
```

### `src/app/(<role>)/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function <RolePascal>Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

### `src/app/(<role>)/index.tsx`

```tsx
import { Redirect } from "expo-router";

export default function <RolePascal>Index() {
  return <Redirect href="/(<role>)/<screen>" />;
}
```

### `src/app/(<role>)/<screen>.tsx` (re-export)

```tsx
export { default } from "@features/<role>/<feature>/<screen>";
```

### `src/app/routes.tsx` patch

Splice into Stack body before closing tag, preserving existing children:

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="index" />
  <Stack.Screen name="(<role>)" />  {/* appended */}
</Stack>
```

## Atomic writes and rollback

Every command must be all-or-nothing. If any step fails (file write, regex splice, redirect rewrite), the command must undo everything it has already written on disk and rethrow the original error so the terminal shows the failure.

### `shared.ts` adds

```ts
export type Journal = {
  created: string[];         // absolute paths of new files
  createdDirs: string[];     // absolute paths of new dirs (deepest first on rollback)
  edited: Array<{ path: string; before: string }>; // pre-edit snapshot for rewrites
};

export function newJournal(): Journal;
export function recordCreate(j: Journal, abs: string): void;
export function recordDir(j: Journal, abs: string): void;
export function recordEdit(j: Journal, abs: string, before: string): void;
export async function rollback(j: Journal): Promise<void>;
```

### Behavior

- Each writer (`writeScreenFiles`, `writeFeatureTypes`, `writeRouteReExport`, `writeRoleGroup`, `updateRedirectTarget`, `registerRoleInRoutes`) takes a `Journal` argument and records every path it touches.
- For new files: only record if the file did not exist before (so we never delete user-authored files).
- For new directories: only record if `ensureDir` created them (compare existence pre/post). Rollback removes them deepest-first, and only if still empty.
- For edits to existing files (`routes.tsx`, `(role)/index.tsx` redirect rewrite): record the pre-edit content snapshot. Rollback writes the snapshot back.
- Command functions (`addRole` / `addFeature` / `addScreen`) wrap all writes in `try { ... } catch (err) { await rollback(journal); throw err; }`.
- Validation, prompts, pre-flight checks run **before** any write so they cannot trigger a rollback.
- Terminal output on failure: `kleur.red("✖ <command> failed — rolled back changes")` followed by the underlying error message (preserve stack trace).

### Test coverage for rollback

Each command test file adds one rollback case: stub a late step to throw (e.g. force `registerRoleInRoutes` to fail by writing a malformed `routes.tsx` beforehand), then assert that none of the would-have-been-created files exist on disk afterwards and the malformed file content is unchanged from its pre-command snapshot.

## Normalization, validation, parsing

### `normalizeCamelCase` cases

| Input | Output |
| --- | --- |
| `"team details"` | `"teamDetails"` |
| `"team-details"` | `"teamDetails"` |
| `"team_details"` | `"teamDetails"` |
| `"TeamDetails"` | `"teamDetails"` |
| `"teamDetails"` | `"teamDetails"` |
| `"team123"` | `"team123"` |
| `"123team"` | reject |
| `""` / `"   "` | reject |
| `"team@details"` | reject (only alphanum + `-` / `_` / whitespace allowed pre-normalize) |

### Validation rules

- Length 1–40 chars after normalize.
- Post-normalize pattern: `/^[a-z][a-zA-Z0-9]*$/`.
- Reserved-name reject (see list above), case-insensitive vs normalized form.

### `routes.tsx` patch strategy

Use string splice with regex (matches existing `spliceMediaConstants` precedent in `add.ts`):

1. Locate `<Stack screenOptions={{ headerShown: false }}>` open tag.
2. If file already contains `<Stack.Screen name="(<role>)"` substring → idempotent skip, return null.
3. Insert `<Stack.Screen name="(<role>)" />` before the closing `</Stack>` with consistent indentation.
4. If pattern not matched → loud error: "routes.tsx not in expected shape — please update manually".

### Redirect href rewrite

Regex against `src/app/(<role>)/index.tsx`:

```
/<Redirect\s+href="\/\(<role>\)\/[^"]+"\s*\/>/
```

Replace href value with new `/(<role>)/<screen>`. Loud error if not found.

## Testing strategy

New test files (mirror `tests/add.test.ts` style — call helpers directly, no TTY prompts):

- `tests/commands/shared.test.ts` — `normalizeCamelCase`, `pascalCase`, `assertRoleName`, `assertFeatureName`, `assertScreenName`, reserved-name rejection, existence helpers.
- `tests/commands/role.test.ts` — full `addRole` flow against tmp dir: files written, routes.tsx patched once, idempotent re-splice when helper called twice directly, refuse-on-existing, refuse-on-bad-routes.
- `tests/commands/feature.test.ts` — `addFeature` adds feature + screen, refuse on missing role, refuse on existing feature, refuse on route-file collision, redirect rewrite when initial=yes.
- `tests/commands/screen.test.ts` — `addScreen` adds screen-only, refuse on missing role/feature, refuse on existing screen folder, **collision test**: two features in same role with same screen name → second refuses with error naming the existing route file and its feature.

## README updates

- `README.md`: new "Generate role/feature/screen" section with examples, MVVM diagram, collision note, "initial screen" prompt explanation.
- `templates/base/README.md`: same trio added to "Post-scaffold recipes" so the generated app's README documents the workflow.
- `templates/claude-command/`: add `add-role.md`, `add-feature.md`, `add-screen.md` slash-command docs (parity with `add-bottom-sheet.md` etc.).

## Out of scope

- Removing a role/feature/screen (no `remove` command in this iteration).
- Renaming a role/feature/screen.
- Auto-generating Redux slices, hooks, services, or theme entries for new features.
- Tab navigators inside role groups.
- Non-interactive mode beyond passing args (no `--initial` flag in this iteration — prompt always runs interactively when `add feature` / `add screen` create a route file).

## Open follow-ups (later versions)

- `--initial` flag to skip the "make initial screen?" prompt.
- `--non-interactive` end-to-end (all answers from args / env).
- `remove role` / `remove feature` / `remove screen` mirror commands.
