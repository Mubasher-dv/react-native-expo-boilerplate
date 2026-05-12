# `add bottom-tab <role>` — Design

**Date:** 2026-05-13
**Status:** Approved
**CLI version target:** 0.3.3
**Builds on:** `2026-05-12-role-feature-screen-commands-design.md`, `2026-05-12-standalone-feature-design.md`

## Goal

Add a new `add bottom-tab <role>` verb that scaffolds an Expo Router `(tabs)/` group inside an existing hierarchical role. Tabs are inline (self-contained tab files with placeholder body) — no features-tree backing.

## Scope

Hierarchical roles only. Standalone features (auth-style) are explicitly out of scope for this iteration (see Open follow-ups).

## Command shape

```
codingpixel-expo-app add bottom-tab <role>
```

Prompts:
1. `role` if missing from argv.
2. **"How many bottom tabs? (2–5)"** — integer prompt; validate `2 ≤ n ≤ 5`.
3. For `i` in `1..n`: **"Tab #i name?"** — required, no default; normalized via `assertScreenName`.

Within-batch duplicate names rejected before any disk write.

## Pre-flight refusals (in order, all before any write)

1. `assertExpoApp(target)`.
2. Validate `role` via `assertRoleName`.
3. Refuse if role does not exist (`features/<role>/` AND `src/app/(<role>)/` both required — combined `roleExists` check).
4. Refuse if `<role>` resolves to a standalone feature (use `topLevelNameTaken` shape — if it's marked role-shape but lacks nested feature subdirs, error: *"`<name>` is a standalone feature, not a hierarchical role. bottom-tabs requires a role created via `add role`."*). For this iteration the heuristic is: hierarchical roles have a `types.ts` file at `features/<role>/<feature>/types.ts` for at least one nested feature; standalone features have `features/<name>/types.ts` at the root. The presence of a root-level `features/<role>/types.ts` is the signal that the name is a standalone feature.
5. Refuse if `src/app/(<role>)/(tabs)/` already exists. (No partial-replacement support; user must remove the directory manually to re-run.)
6. `assertRoleLayoutParseable(target, role)` — `src/app/(<role>)/_layout.tsx` must contain a `<Stack screenOptions={{ headerShown: false }}>` opening tag in either:
   - Self-closing form: `<Stack screenOptions={{ headerShown: false }} />`
   - Wrapping form: `<Stack screenOptions={{ headerShown: false }}>...</Stack>`
7. Prompt tab count + names. Validate each: same rules as screen name (camelCase normalize, reserved-name reject, post-normalize pattern).

## Atomic writes (Journal)

Order:

1. `src/app/(<role>)/(tabs)/_layout.tsx` — Tabs layout with N `<Tabs.Screen>` entries.
2. `src/app/(<role>)/(tabs)/index.tsx` — `<Redirect href="/(<role>)/(tabs)/<firstTab>" />`.
3. For each tab `t` (in order entered): `src/app/(<role>)/(tabs)/<t>.tsx` — inline placeholder body.
4. Patch `src/app/(<role>)/_layout.tsx` via `registerTabsInRoleLayout`:
   - If self-closing → rewrite as wrapping form with `<Stack.Screen name="(tabs)" />` as single child.
   - If wrapping → append `<Stack.Screen name="(tabs)" />` before `</Stack>` with sibling indentation.
   - Idempotent: substring probe `<Stack.Screen name="(tabs)"` → return null, no edit.

Try/catch wraps writes 1–4. On failure, rollback restores every recorded create/edit; rethrows original error.

Pre-flight checks (1–7 above) run before journal creation — cannot trigger rollback.

## Templates

Placeholders used below:
- `<role>` — normalized camelCase role name.
- `<RolePascal>` — `pascalCase(role)`.
- `<tab>` — normalized camelCase tab name.
- `<TabPascal>` — `pascalCase(tab)`.
- `<TabTitle>` — `pascalCase(tab)` (used as display title in Tabs.Screen options; same as TabPascal for now).

### `(tabs)/_layout.tsx`

```tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function <RolePascal>TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="<tab>"
        options={{
          title: "<TabTitle>",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipse-outline" color={color} size={size} />
          ),
        }}
      />
      {/* repeat per tab */}
    </Tabs>
  );
}
```

### `(tabs)/index.tsx`

```tsx
import { Redirect } from "expo-router";

export default function <RolePascal>TabsIndex() {
  return <Redirect href="/(<role>)/(tabs)/<firstTab>" />;
}
```

### `(tabs)/<tab>.tsx` (inline placeholder)

```tsx
import AppText from "@appComponents/appText";
import AppWrapper from "@appComponents/appWrapper";
import { Colors } from "@theme/colors";

export default function <TabPascal>() {
  return (
    <AppWrapper>
      <AppText size={20} color={Colors.BLACK}>
        <TabPascal> screen
      </AppText>
    </AppWrapper>
  );
}
```

### Outer `(role)/_layout.tsx` patch

Before (self-closing — produced by `add role`):
```tsx
export default function <RolePascal>Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

After:
```tsx
export default function <RolePascal>Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
```

If already wrapping (user added other children), splice `<Stack.Screen name="(tabs)" />` before `</Stack>` with sibling indentation.

## `shared.ts` additions

| Function / const | Purpose |
| --- | --- |
| `tabsGroupDir(target, role): string` | `src/app/(<role>)/(tabs)` |
| `tabRouteFile(target, role, tab): string` | `(tabs)/<tab>.tsx` |
| `tabsLayoutFile(target, role): string` | `(tabs)/_layout.tsx` |
| `tabsIndexFile(target, role): string` | `(tabs)/index.tsx` |
| `tabsGroupExists(target, role): boolean` | True if `(tabs)/` dir present |
| `buildTabsLayout(role, tabs[]): string` | Renders Tabs layout with N entries |
| `buildTabsIndexRedirect(role, firstTab): string` | Redirect-to-first-tab template |
| `buildTabPlaceholder(tab): string` | Inline AppWrapper + AppText placeholder body |
| `writeTabsGroup(target, role, tabs[], j): string[]` | Writes `_layout.tsx`, `index.tsx`, `<tab>.tsx` × N |
| `assertRoleLayoutParseable(target, role): void` | Pre-flight on `(<role>)/_layout.tsx` |
| `registerTabsInRoleLayout(target, role, j): string \| null` | Splices `<Stack.Screen name="(tabs)" />` into role's Stack; handles self-closing → wrapping conversion; idempotent |

Reserved-name list gains `bottom-tab` so role/feature/screen/tab names cannot collide with the command verb.

## Dispatcher addition in `src/index.ts`

```ts
if (argv[0] === "add" && argv[1] === "bottom-tab") {
  const { addBottomTab } = await import("./commands/bottomTab.js");
  await addBottomTab(argv[2]);
  return;
}
```

## Testing strategy

New file `tests/commands/bottomTab.test.ts`:

- Full flow — 3-tab creation; assert all 5 files exist with expected content; role's `_layout.tsx` contains `<Stack.Screen name="(tabs)" />`.
- Role `_layout.tsx` in wrapping form (with existing children) → appended cleanly.
- Role `_layout.tsx` in self-closing form → converted to wrapping with `(tabs)` child.
- Idempotent: `registerTabsInRoleLayout` called twice → second is no-op (substring probe).
- Refuse: role missing.
- Refuse: standalone feature passed in.
- Refuse: `(tabs)/` already exists.
- Refuse: malformed role `_layout.tsx` (Stack tag absent).
- Refuse: tab count <2 or >5.
- Refuse: duplicate tab names within batch.
- Refuse: reserved tab name.
- Rollback: `_failAfterWrites` stub → no files written, role `_layout.tsx` snapshot restored.

Extend `tests/commands/shared.test.ts` for new helpers (path computations, template builders, `assertRoleLayoutParseable`, `registerTabsInRoleLayout` idempotency cases).

## README + slash-command updates

- **README.md** — new "Generate bottom-tabs" subsection; full `add bottom-tab customer` example with 3 tabs; mention idempotent re-splice into outer Stack; explain tabs reachable via programmatic navigation (outer redirect untouched).
- **templates/base/README.md** — single line under recipe cheatsheet: `codingpixel-expo-app add bottom-tab <role>` with parenthetical "(2–5 tabs)".
- **templates/claude-command/add-bottom-tab.md** — NEW slash-command doc.
- **Normalize CLI invocation across all docs**: `codingpixel-expo ` (with trailing space) → `codingpixel-expo-app ` everywhere in README.md, templates/base/README.md, templates/claude-command/*.md, and the standalone-feature spec.

## Out of scope

- Per-tab icon prompts (placeholder Ionicons only).
- Standalone-feature tabs.
- `remove bottom-tab <role>` mirror command.
- Nested tabs (tabs inside tabs).
- Switching the default-first-tab after creation (manual edit only).

## Open follow-ups

- `--icons` flag prompting per-tab icon names.
- Standalone-feature tabs (`add bottom-tab` on auth-style features).
- `remove bottom-tab <role>` mirror command.
- Custom initial-route via `_layout.tsx` `<Tabs screenOptions={{ ..., initialRouteName: "..." }}>` instead of `(tabs)/index.tsx` redirect.
