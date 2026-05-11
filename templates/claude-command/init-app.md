---
name: init-app
description: Scaffold a new Expo project using codingpixel-expo-app with full prompt control + PM choice. Slash-command flow is non-TTY — all answers are resolved BEFORE invoking the CLI.
---

# /init-app — Scaffold Expo project

Use **AskUserQuestion** to resolve every answer up front. The CLI itself runs without a TTY (slash-command stdin is closed); any missing answer would throw with `not a TTY`.

## Step 1 — Gather answers (use AskUserQuestion)

Ask the user, in this order:

1. **App name / target directory** (required, non-empty string). This becomes the positional CLI arg AND substitutes into the env-var command below. Do NOT pass the literal string `<dir>` — substitute the real value.
2. **Include bottom-sheet support?** (yes/no → "1" or "0").
3. **Include image-picker support?** (yes/no → "1" or "0").
4. **Package manager** (yarn or npm).

Fonts are intentionally disabled in this CLI version (Deviation #9 in `docs/MIRROR_NOTES.md`) — `Fonts = {}` ships in the generated app and `EXPO_PRIMARY_FONT` / `EXPO_SECONDARY_FONT` env vars are silently ignored.

## Step 2 — Run the CLI

Substitute every answer into the command. **Replace `my-app` with the resolved app name from step 1** before invoking:

```bash
EXPO_INCLUDE_BOTTOM_SHEET="0" \
  EXPO_INCLUDE_IMAGE_PICKER="0" \
  EXPO_PACKAGE_MANAGER="yarn" \
  npx --yes codingpixel-expo-app my-app
```

## Step 3 — After the CLI completes

Show the user the printed next-steps block (`cd <dir> / npx expo prebuild / yarn ios`). The CLI's success message lists the actual produced PM (which may differ from requested if Expo CLI ignored the flag — see PM-mismatch warning if shown).

## Failure handling

If the CLI exits non-zero:
- Read its stderr — it includes a recovery hint.
- Patches are idempotent: if the user fixes the root cause (e.g. network, missing PATH entry), they can re-run the same command and the CLI converges.
- Never auto-`rm -rf` the target dir; the user owns that decision.
