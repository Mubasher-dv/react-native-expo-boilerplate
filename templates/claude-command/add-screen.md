---
description: Add a screen to an existing feature in this project.
---

Run `codingpixel-expo add screen <role> <feature> <name>` from the project root. The CLI prompts whether the new screen should become the role's initial (redirect) screen.

Creates:

- `src/features/<role>/<feature>/<screen>/index.tsx`
- `src/features/<role>/<feature>/<screen>/viewModel/_api.ts`
- `src/features/<role>/<feature>/<screen>/viewModel/use<Screen>ViewModel.tsx`
- `src/app/(<role>)/<screen>.tsx` (re-export)

Refuses if the role/feature don't exist, the screen folder already exists, or the route name collides with another feature in the same role.

Rebuild after the command finishes:

```bash
yarn ios      # or yarn android
```
