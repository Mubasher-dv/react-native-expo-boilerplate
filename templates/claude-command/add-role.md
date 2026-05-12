---
description: Scaffold a role (Expo Router group + feature folder + starter screen) in this project.
---

Run `codingpixel-expo-app add role` from the project root. The CLI will prompt for the first feature name and first screen name, then create:

- `src/features/<role>/<feature>/types.ts`
- `src/features/<role>/<feature>/<screen>/index.tsx`
- `src/features/<role>/<feature>/<screen>/viewModel/_api.ts`
- `src/features/<role>/<feature>/<screen>/viewModel/use<Screen>ViewModel.tsx`
- `src/app/(<role>)/_layout.tsx`
- `src/app/(<role>)/index.tsx` (redirects to the starter screen)
- `src/app/(<role>)/<screen>.tsx` (re-export)
- registers `<Stack.Screen name="(<role>)" />` in `src/app/routes.tsx`.

> `add role auth` is refused — `auth` should be a standalone feature, not a role. Use `add feature auth` instead (1-arg form), then `add screen auth login`, `add screen auth signUp`, etc.

Atomic: if anything fails, every file written so far is rolled back.

Rebuild after the command finishes:

```bash
yarn ios      # or yarn android
```
