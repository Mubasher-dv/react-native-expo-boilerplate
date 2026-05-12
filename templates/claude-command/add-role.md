---
description: Scaffold a role (Expo Router group + feature folder + starter screen) in this project.
---

Run `codingpixel-expo add role` from the project root. The CLI will prompt for the first feature name and first screen name, then create:

- `src/features/<role>/<feature>/types.ts`
- `src/features/<role>/<feature>/<screen>/index.tsx`
- `src/features/<role>/<feature>/<screen>/viewModel/_api.ts`
- `src/features/<role>/<feature>/<screen>/viewModel/use<Screen>ViewModel.tsx`
- `src/app/(<role>)/_layout.tsx`
- `src/app/(<role>)/index.tsx` (redirects to the starter screen)
- `src/app/(<role>)/<screen>.tsx` (re-export)
- registers `<Stack.Screen name="(<role>)" />` in `src/app/routes.tsx`.

Atomic: if anything fails, every file written so far is rolled back.

Rebuild after the command finishes:

```bash
yarn ios      # or yarn android
```
