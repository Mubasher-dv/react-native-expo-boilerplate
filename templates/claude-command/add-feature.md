---
description: Add a feature in this project — standalone (1-arg, auth-style flat) or nested under a role (2-arg, hierarchical).
---

Dispatched by argument arity.

## `add feature <name>` — standalone (1-arg)

Run `codingpixel-expo-app add feature <name>`. Creates a top-level feature owning its own Expo Router group with flat screens directly underneath. Use for auth-style namespaces where each screen is independent (login / signUp / forgotPassword).

Prompts:
- First screen name
- Make this feature the app's initial route? (rewrites `src/app/index.tsx` → `<Redirect href="/(<name>)" />` on yes)

Creates:

- `src/features/<name>/types.ts`
- `src/features/<name>/<screen>/index.tsx` + `viewModel/{_api.ts, use<Screen>ViewModel.tsx}`
- `src/app/(<name>)/_layout.tsx`
- `src/app/(<name>)/index.tsx` (redirect to first screen)
- `src/app/(<name>)/<screen>.tsx` (2-segment re-export: `@features/<name>/<screen>`)
- Registers `<Stack.Screen name="(<name>)" />` in `src/app/routes.tsx`.

Add more screens with `add screen <name> <screen>` (2-arg form).

## `add feature <role> <name>` — nested (2-arg)

Run `codingpixel-expo-app add feature <role> <name>`. Adds a sibling feature under an existing hierarchical role. CLI prompts for screen name + makeInitial.

Creates:

- `src/features/<role>/<feature>/types.ts`
- `src/features/<role>/<feature>/<screen>/index.tsx` + `viewModel/` files
- `src/app/(<role>)/<screen>.tsx` (3-segment re-export: `@features/<role>/<feature>/<screen>`)

Refuses if the role doesn't exist, the feature already exists, or the screen name collides with an existing route file in the same role.

## Atomic

If any step fails, every file written so far is rolled back.

Rebuild after the command finishes:

```bash
yarn ios      # or yarn android
```
