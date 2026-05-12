---
description: Add a new feature (folder + one screen) under an existing role in this project.
---

Run `codingpixel-expo add feature <role> <name>` from the project root. The CLI will prompt for a screen name and whether the new screen should become the role's initial (redirect) screen.

Creates:

- `src/features/<role>/<feature>/types.ts`
- `src/features/<role>/<feature>/<screen>/index.tsx` + `viewModel/` files
- `src/app/(<role>)/<screen>.tsx` (re-export)

Refuses if the role doesn't exist, the feature already exists, or the screen name collides with an existing route file in the same role.

Rebuild after the command finishes:

```bash
yarn ios      # or yarn android
```
