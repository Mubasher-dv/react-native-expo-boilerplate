#!/usr/bin/env bash
# Phase 10 step 3 — prepublishOnly audit chain. Guards against mirrored files
# bypassing one-time template authoring audits. Run by `npm run audit:templates`
# (PM-agnostic — works under both yarn + npm).

set -euo pipefail

PATTERNS='@/theme/|@/utils/|@/redux/|@/core/|@/services/|@/hooks/|@/appComponents/|@/components/|@/icons/|@/features/|@/assets(/|["'\''])'
# Deviation #10: Fonts is now a `const enum` (per user request). Type-position
# uses (`: Fonts`, `keyof typeof Fonts`, etc.) are legitimate again, so the
# Phase 4 step 10 / Phase 5 step 0 Fonts-type-position audit is removed.

# 1) Phase 4 step 5 — MyRoster-prefix grep over templates/base/
if find templates/base \( -name "*.ts" -o -name "*.tsx" \) -print0 \
   | xargs -0 grep -nE "from ['\"]($PATTERNS)" 2>/dev/null; then
  echo "FAIL: MyRoster prefix remains in templates/base"
  exit 1
fi

# 2) Phase 5 step 0 — MyRoster-prefix grep over conditional template dirs
for DIR in templates/bottom-sheet templates/image-picker; do
  [ -d "$DIR" ] || continue
  if find "$DIR" \( -name "*.ts" -o -name "*.tsx" \) -print0 \
     | xargs -0 grep -nE "from ['\"]($PATTERNS)" 2>/dev/null; then
    echo "FAIL: audit failed in $DIR"
    exit 1
  fi
done

echo "audit:templates OK"
