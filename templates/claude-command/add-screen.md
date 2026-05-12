---
description: Add a screen in this project — flat under a standalone feature (2-arg) or nested under a hierarchical role/feature (3-arg).
---

Dispatched by argument arity.

## `add screen <feature> <name>` — flat (2-arg)

Run `codingpixel-expo-app add screen <feature> <name>`. Adds a sibling screen to an existing standalone feature (one created via `add feature <name>` 1-arg form). CLI prompts whether the new screen should become the feature's initial (redirect) screen.

Creates:

- `src/features/<feature>/<screen>/index.tsx`
- `src/features/<feature>/<screen>/viewModel/_api.ts`
- `src/features/<feature>/<screen>/viewModel/use<Screen>ViewModel.tsx`
- `src/app/(<feature>)/<screen>.tsx` (2-segment re-export: `@features/<feature>/<screen>`)

Refuses if the feature is not a standalone feature, the screen folder already exists, or the screen name collides with an existing route file. Collision errors name the route file and (when parseable) the owning feature.

## `add screen <role> <feature> <name>` — nested (3-arg)

Run `codingpixel-expo-app add screen <role> <feature> <name>`. Adds a sibling screen to a nested feature under a hierarchical role. CLI prompts makeInitial.

Creates:

- `src/features/<role>/<feature>/<screen>/index.tsx`
- `src/features/<role>/<feature>/<screen>/viewModel/_api.ts`
- `src/features/<role>/<feature>/<screen>/viewModel/use<Screen>ViewModel.tsx`
- `src/app/(<role>)/<screen>.tsx` (3-segment re-export: `@features/<role>/<feature>/<screen>`)

Refuses if the role/feature don't exist, the screen folder already exists, or the route name collides with another feature in the same role (error names the existing route file and its owning feature).

## Atomic

If any step fails, every file written so far is rolled back.

Rebuild after the command finishes:

```bash
yarn ios      # or yarn android
```
