---
description: Scaffold a bottom-tabs route group inside an existing hierarchical role.
---

Run `codingpixel-expo-app add bottom-tab <role>` from the project root. The CLI will prompt for the number of tabs (2–5) and each tab's name, then create the tabs group inside the role's Expo Router group.

Creates:

- `src/app/(<role>)/(tabs)/_layout.tsx` (Tabs layout with one `<Tabs.Screen>` per tab + placeholder Ionicons)
- `src/app/(<role>)/(tabs)/index.tsx` (redirect to first tab — Expo Router treats this as the tabs entry point)
- `src/app/(<role>)/(tabs)/<tab>.tsx` per tab (inline AppWrapper + AppText placeholder body)

Also patches `src/app/(<role>)/_layout.tsx` to add `<Stack.Screen name="(tabs)" />` to the role's Stack. Handles both self-closing (`<Stack ... />`) and wrapping (`<Stack ...>...children...</Stack>`) layout forms; idempotent if already present.

Refuses when:
- The role doesn't exist or is a standalone feature (auth-style).
- `(tabs)/` already exists for the role.
- The role's `_layout.tsx` is not in the expected Stack shape.
- Tab count is outside 2–5.
- Tab names duplicate within the batch or hit the reserved list.

Tabs are reachable via programmatic navigation to `/(<role>)/(tabs)`; the outer `(<role>)/index.tsx` redirect is left untouched. Replace placeholder icons in `(tabs)/_layout.tsx` afterwards.

Atomic: if anything fails, every file written so far is rolled back.

Rebuild after the command finishes:

```bash
yarn ios      # or yarn android
```
