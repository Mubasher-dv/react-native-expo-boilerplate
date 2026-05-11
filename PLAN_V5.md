# `@codingpixel/create-expo-app` — Implementation Plan **v5**

**Date:** 2026-05-11
**Spec:** [SPEC.md](./SPEC.md)
**Supersedes:** [PLAN_V4.md](./PLAN_V4.md) (which superseded V3 → V2 → V1)
**Status:** Saved, not yet executed

Consolidates V4 + v4-r1 patches into single coherent document. No revision markers — V5 is the new baseline.

### v5-r6 (2026-05-11) — sixth-pass review fixes (this doc)

| # | Area | Change |
|---|---|---|
| 1 | Phase 7 step 4 Step C | Was checking only LAST array entry. Now iterates ALL entries between worklets index and end; throws if ANY matches our-inserted names; collects unknown-trailing names and emits single warning. Closes loop bug where `[m-r, worklets, X, Y]` only inspected Y. |
| 2 | Phase 0 probe block | Added `set -eo pipefail` at top of bash block. Previous block claimed `set -e` safe via trap but never set the flag — Probe -1 failure cascaded silently into garbage `KEY=VALUE` lines. Trap still handles cleanup on both success + first-fail abort. |
| 3 | Probe 6 rename + rescope | `EXPO_INSTALL_CHECK_OK` → `EXPO_CHECK_IDEMPOTENT_OK`. Probe documented as idempotency check on populated `node_modules`, NOT lockfile-materialization (that's Probe 7's job). Removed downstream "swap order in Phase 7" wording — Probe 7 `PROBE_PASS` is sole driver for the explicit-install branch. |
| 4 | Probe 2 redundancy + transitive check | Added secondary check: `jq -r '.dependencies."react-native-worklets" // .dependencies."react-native-reanimated" // empty' smoke-test/node_modules/babel-preset-expo/package.json`. If grep returns 0 AND transitive dep declared → `AUTO_INCLUDES=1` (preset lazy-loads via `require.resolve`); else 0. Closes false-negative when preset's plugin reference is computed. |
| 5 | Phase 4 sentinel orphan-throw | Tightened `/@@\w+@@/` → `/@@[A-Z_]+@@/` to match Phase 6 step 5 grep + the two sentinel regexes themselves. Lowercase typo `@@foo@@` now caught as orphan instead of leaking through. Both `MODULE_SENTINEL` + `JSX_SENTINEL` now use `[A-Z_]+` (was `\w+`). |
| 6 | Phase 0 probe-count claim | Header note "Numbered probes 0–8" was inaccurate (-1, 0, 0b, 1–8 = 11 probes). Reworded to "Probes -1 through 8 (with 0b sub-probe)". |
| 7 | Phase 8 mismatching-lockfile error | Was "warn but accept" — silently violated explicit user/env PM choice. Promoted to loud warning with actionable recovery hint (re-run with `EXPO_PACKAGE_MANAGER=<other>` OR manual lockfile delete + native PM install). Still non-fatal (one valid lockfile present = scaffold usable) but no longer silent. |
| 8 | Phase 4 step 3 rewriteImports regex | Extended to cover dynamic `import("...")` + `require("...")` + `jest.mock("...")` in addition to `from "..."`. Templates today are `from`-only but future mirrored files may use dynamic forms. |
| 9 | Phase 2 PM-validation timing | `EXPO_PACKAGE_MANAGER` value validation moved to a pre-Phase-1 entry point in `src/index.ts`. Throws BEFORE `resolveTargetDir` mutates fs. Was previously inside `gatherAnswers` (post-Phase-1) → orphan empty dir on invalid PM value. |
| 10 | Phase 0 deps pinning policy | Added explicit version-range guidance: `@babel/*` pinned with `~` (AST node shape can shift on minor); `execa`, `prompts`, `fs-extra` pinned with `^` (semver-stable). Documented in Phase 0 step 4. |
| 11 | Phase 7 step 2 fixture corpus | Added requirement: `tests/fixtures/expo-install-stderr/` directory containing real stderr samples per Expo CLI minor version observed. `parseFailingDep` unit test iterates all fixtures + asserts culprit identification. Prevents regex regression on Expo CLI bumps. |

### v5-r1 (2026-05-11) — review fixes (this doc, in-place)

| # | Area | Change |
|---|---|---|
| 1 | SPEC §16 sync | Removed blanket `@/` ban; clarified `@/*` is legitimate catchall, only MyRoster-prefixed aliases banned. |
| 2 | Phase 4 sentinel regex | Split single regex into two paired regexes (module vs JSX form); mismatched forms throw; inline sentinels throw. |
| 3 | Phase 6 grep | Scoped `@@TOKEN@@` assertion to `@@[A-Z_]+@@` excluding `node_modules`; added inline-sentinel rejection test (step 6). |
| 4 | Phase 7 step 4 | Pinned plugin order — module-resolver at front, worklets always last; post-patch invariant assertion. |
| 5 | Phase 0 step 10 | Added lockfile-materialization probe; Phase 8 step 1 conditionally runs explicit PM install based on probe outcome. |
| 6 | Phase 7 step 3 | `baseUrl` resolution order preserves user's existing value before Phase 0 probe result. |
| 7 | Phase 5 step 5 | `patchAppJsonPlugins` idempotency predicate specified (name-only equality; options preserved). |
| 8 | Phase 10 step 3 | `prepublishOnly` chains `audit:templates` script; new mirrored files can't bypass one-time audits. |
| 9 | Phase 7 step 7 (new) | Partial-failure handling — idempotent rerun (A) + error-message recovery hint (B); never auto-delete target. |
| 10 | Phase 4 step 0 (new) | Explicit `docs/MIRROR_NOTES.md` creation + skeleton. |
| 11 | Phase 7 step 2 | Retry caps + transient-vs-deterministic error classification; abort on network without retry. |
| 12 | Phase 0 / Phase 2 | Smoke-test cleanup (`rm -rf smoke-test`); `yarn --version` probe with 3000ms timeout. |

### v5-r2 (2026-05-11) — second-pass review fixes (this doc + SPEC §4)

| # | Area | Change |
|---|---|---|
| 1 | Phase 0 step 10 probe ordering | Lockfile-materialization probe branches on `FLAGS_OK` (set by prior flag-support probe); avoids false-negative when `--yarn` flag unsupported. Added `NPM_SEED_OK` probe for Branch B npm-lockfile path. |
| 2 | DoD sentinel claim | Replaced blanket "Zero `@@TOKEN@@` placeholders" with scoped "Zero `@@[A-Z_]+@@` sentinel residue ... excluding `node_modules` per Phase 6 step 5." Matches Phase 6 assertion. |
| 3 | Risk-table offline mitigation | Updated to reflect Phase 7 step 2's transient-vs-deterministic stderr classification (was outdated "document network requirement"). |
| 4 | Risk-table partial-failure row | Added new row pointing at Phase 7 step 7 idempotent-rerun + recovery-hint strategy. |
| 5 | Risk-table `baseUrl` row | Updated to 3-tier resolution (user-set → preserve; expo base provides → no-op; both absent → set `.`). |
| 6 | Phase 4 step 5 / Phase 5 step 0 grep | Anchored `@/assets` with `(/|["'])` terminator so it doesn't match `@/assetspath` etc. |
| 7 | Phase 7 step 4 Step C | Softened invariant: throw only when OUR patch caused trailing entry; warn-and-continue when user-added trailing entry detected. Preserves intentional user config. |
| 8 | Phase 4 step 0 MIRROR_NOTES | Added explicit placeholder-fill rules (date, sha, `_None._` for empty flags section). |
| 9 | Phase 7 step 2 Branch B | Replaced bare `"{}"` npm-lockfile seed with minimal-valid `lockfileVersion: 3` JSON (npm 7+ rejects bare `{}`). Added fallback to `npm install --package-lock-only` if Phase 0 `NPM_SEED_OK=0`. |
| 10 | Phase 7 step 4 Step A | Edge case: throw if `module-resolver` is at last index AND worklets needs insertion (refuses to silently relocate user-positioned entries). |
| 11 | Phase 2 tests | Added timeout-path test case for `yarn --version` probe. |
| 12 | SPEC §4 step 7 | Synced install-step description with Phase 7/8 Branch A/B + `PROBE_PASS` conditional install. |
| 13 | Sentinel matching | Added explicit orphan-token throw step — neither regex match + `@@\w+@@` substring → throw. Examples documented. |
| 14 | Phase 10 step 3 | Added explicit `scripts/audit-templates.sh` creation step with full script body; `chmod +x`; wire into `package.json`. |

### v5-r5 (2026-05-11) — fifth-pass review fixes (this doc)

| # | Area | Change |
|---|---|---|
| 1 | Phase 0 Probe 5 context | `npx --yes expo install --help` was running from CLI project root (no Expo project context). Wrapped in `( cd smoke-test && ... )` subshell so help text reflects in-project behavior. |
| 2 | Phase 0 Probe 0b redundancy | Second `<pm> install` after `<pm> add` was a no-op (yarn add / npm install --save-dev already syncs node_modules from package.json). Removed redundant block. |
| 3 | Phase 0 Probe 3 stderr diagnostic | Both worklets-name attempts piped stderr to `/dev/null` → `WORKLETS_PKG=UNKNOWN` surfaced with no diagnostic. Now appends stderr to `docs/SDK_NOTES_probe3-stderr.log`; SDK_NOTES.md gets a pointer line on UNKNOWN. |
| 4 | Phase 0 cleanup `set -e` safety | Bare `rm -rf smoke-test` at end didn't run if any probe failed under `set -e`. Replaced with `trap 'rm -rf smoke-test' EXIT` at top — cleanup runs on success AND failure. |
| 5 | Phase 10 `prepublishOnly` PM-agnostic | Script body hard-coded `yarn build && yarn test && yarn audit:templates` — fails when publisher uses `npm publish` without yarn installed. Switched to `npm run build && npm run test && npm run audit:templates` (npm passes through to package.json scripts identically; works under both PMs). |
| 6 | Phase 8 dual-lockfile loud error | Was "delete the non-chosen PM's lockfile + warn" — too quiet; masks Phase 7 Branch B bugs. Split into two error paths: Branch A (flags) and Branch B (seed) each emit distinct loud error pointing at the broken assumption. Never silent-delete. |
| 7 | "SPEC.md consistency" footer | Stale "V5 carries those decisions forward unchanged" wording — v5-r4 modified SPEC §9 + §13. Updated to reflect r4 SPEC edits. |
| 8 | Risks-table atomic-failure row | Predated v5-r4's concrete `retryWithIsolation`. Updated mitigation column to reference the algorithm + parseFailingDep + twice-fail termination. |
| 9 | v5-r4 header item #2 relabel | Said "Inserted Probe -1" — actually inserted Probe -1 (PM detect) + Probe 0b (install). Header note clarified. |
| 10 | Phase 4 step 10 bracket false-positive | `Fonts\s*\[` also matches `Fonts["BOLD"]` (legit bracket value access). Added comment block in pattern documentation acknowledging the false-positive class + recommended fix (prefer dot notation or `FontKey`). |
| 11 | Phase 7 step 7 callout | Partial-failure handling was numbered as a sequential step — misleading (it's cross-cutting policy, not a sequential patcher). Reframed as `### Cross-cutting: Partial-failure handling` subsection at end of Phase 7. |

### v5-r4 (2026-05-11) — fourth-pass review fixes (this doc + SPEC §9, §13)

| # | Area | Change |
|---|---|---|
| 1 | SPEC §9 `@assets` target | Was `src/assets` — contradicted §5.2 + §6 (assets live at project root). Fixed to `assets` (project root). Phase 4 step 4 alias-mapping target column reaffirmed. |
| 2 | Phase 0 probe ordering | Probe 4 (`baseUrl` jq read) required `expo` to be installed in `smoke-test`, but `smoke-test` was created `--no-install`. Inserted explicit "Probe -1" (PM-agnostic `expo` install into smoke-test) BEFORE Probes 1–8. All later probes reuse that single install. |
| 3 | Phase 0 Probe 6 "empty node_modules" | Precondition was broken — Probes 2 + 3 had already populated `node_modules`. Renamed probe to "expo install --check with populated node_modules" (matches actual measured state). New Probe -1 documents the only "empty" path. |
| 4 | Phase 0 Probes 1, 2 output format | Both wrote raw output instead of `KEY=VALUE`. Probe 1 now `EXPO_SDK_VERSION=<x>`; Probe 2 now `BABEL_PRESET_AUTO_INCLUDES_WORKLETS=1\|0`. `readSDKNote()` (Phase 7 step 4) now finds the expected keys. |
| 5 | Phase 0 Probe 2 PM dependency | `yarn add` hard-coded — breaks for npm-only users. Switched to PM detection (single shared `PM` shell var set in Probe -1) reused across all probes that mutate `smoke-test`. |
| 6 | SPEC §13 lockfile invariant | Updated to document Branch B path (pre-seeded lockfile when `--yarn`/`--npm` flags absent) — old text implied flags were always available. |
| 7 | Phase 7 step 2 atomic-failure mechanics | Was vague ("per-dep retry capped at deps list length"). Spelled out concrete algorithm: parse Expo stderr → identify failing dep → remove from list → retry `expo install <remaining>` → loop until empty or same dep fails twice. |
| 8 | Sentinel rename `FONTS_ENUM` → `FONTS_OBJECT` | The token was named after the obsolete TS-enum design. Renamed in Phase 4 step 1, Phase 4 sentinel list, Phase 6 step 4. Cosmetic but reduces reader confusion. |
| 9 | Phase 10 audit-templates.sh style | Was `&& { fail; } \|\| true` form; Phase 4/5 uses `if pipeline; then fail; fi`. Standardized on `if` form across all three scopes for single-style audit. Both forms are `set -e` safe; consistency wins. |
| 10 | Phase 4 step 10 Fonts-type audit pattern | Original pattern missed `as Fonts`, `Record<Fonts`, and other type-position uses. Extended pattern; explicit allowlist for `keyof typeof Fonts` (legit pattern via `FontKey`). |
| 11 | Phase 2 PM detection | Added explicit `npm --version` probe AFTER yarn fallback. Both missing → abort early with `"neither yarn nor npm available"` BEFORE Phase 3 mutates any directory. Prevents late install failure after irreversible work. |

### v5-r3 (2026-05-11) — third-pass review fixes (this doc)

| # | Area | Change |
|---|---|---|
| 1 | Phase 0 step 10 pwd state | Rewrote entire probe sequence as a single bash block using subshells (`( cd smoke-test && ... )`) — pwd never drifts from project root. Numbered probes 0–8. Each writes a discrete `KEY=VALUE` line to `SDK_NOTES.md`. |
| 2 | Phase 0 Probe 8 npm-seed | Replaced heredoc with single-line `echo` to avoid markdown-indented `EOF` terminator breaking quoted heredocs on copy-paste. |
| 3 | Phase 7 step 4 patchBabel | Added Step 0 decision-prelude: pre-computes `moduleResolverPresent`, `workletsNeedsInsertion`, etc. once before Step A/B/C. Resolves prior temporal ambiguity where Step A's edge-case referenced Step B's not-yet-made decision. |
| 4 | Risk-table Branch B wording | Updated "pre-seed empty lockfile" to "pre-seed lockfile (yarn: empty file; npm: minimal valid `lockfileVersion: 3` JSON, with `npm install --package-lock-only` fallback per `NPM_SEED_OK`)." |
| 5 | Phase 4 step 3 rewriteImports | Added explicit longest-source-prefix-first iteration order rule + `Object.entries(...).sort(...)` implementation. Prevents shorter prefixes from consuming longer specific ones. |
| 6 | Phase 4/5 grep `set -e` safety | Converted standalone audit greps from `grep && echo FAIL && exit` pattern (aborts under `set -e` on no-match success path) to `if find\|xargs grep; then exit 1; fi` form. Applied to Phase 4 step 5, Phase 4 step 10, Phase 5 step 0. |
| 7 | Phase 6 step 5 grep | Replaced inline `<output>` placeholder with `OUTPUT_DIR` shell var (caller passes target). Switched to command-substitution capture + emptiness check — avoids xargs hanging on stdin when find yields zero files. |
| 8 | Phase 4 step 7 expo-router predicate | Added explicit cross-reference to Phase 5 step 5 `nameOf` equality predicate for `"expo-router"` dedup. |
| 9 | Phase 7 step 7 recovery wording | Tightened to clarify Phase 1 only rejects `.` when `package.json` exists — defense-in-depth needed for draft directories with non-`package.json` content. |
| 10 | Decisions-locked baseUrl row | Updated stale "Phase 0 verifies; Phase 7 adds if missing" to 3-tier resolution wording. |
| 11 | Phase 9 slash-command dir | Documented that slash-command flow is non-TTY: all answers including `<dir>` MUST be resolved before CLI invocation; example now uses concrete `my-app` instead of `<dir>` literal. |
| 12 | Phase 8 ensureLockfile rename | `verifyLockfile` → `ensureLockfile` — the function conditionally installs before verifying; old name misled. |
| 13 | Risk-table babel.config | Spelled out detection: `.ts` / `.cjs` / `.mjs` present AND `.js` absent → abort. Phase 0 Probe 2 confirms default. |

### Decisions locked

| Topic | Decision |
|---|---|
| Bin name | `codingpixel-expo` |
| Fonts type | Object literal `as const` + `FontKey` (NOT TS `enum` — Babel-unsafe) |
| Assets path | Root `assets/` |
| Native deps | All via `npx expo install` with explicit `{ cwd: target }` |
| Babel patch | AST merge (`@babel/parser` + `traverse` + `generator`) |
| JSX-position sentinels | `{/* @@TOKEN@@ */}` |
| Module-position sentinels | `// @@TOKEN@@` |
| `@@MEDIA_CONSTANTS@@` | `patchConstants` always runs (no=empty, yes=snippet) |
| MyRoster import rewriting | Dedicated Phase 4 task; alias mapping table |
| Lockfile strategy | Detect PM once; pass `--yarn`/`--npm` flag, or pre-seed lockfile fallback |
| `compilerOptions.baseUrl` | 3-tier resolution: user-set → preserve; `expo/tsconfig.base` provides → no-op (inherited); both absent → set `.` |
| Audits | POSIX `find -print0 \| xargs -0` (not bash brace expansion) |
| Conditional template audits | Phase 5 step 0 covers `templates/bottom-sheet/` + `templates/image-picker/` |

---

## Phase 0 — Package skeleton

### Tasks

1. `mkdir codingpixel-create-expo-app && cd codingpixel-create-expo-app`
2. `npm init -y`. Edit `package.json`:
   - `"name": "@codingpixel/create-expo-app"`
   - `"version": "0.1.0"`
   - `"type": "module"`
   - `"bin": { "codingpixel-expo": "./bin/cli.js" }`
   - `"files": ["bin/", "dist/", "templates/", "README.md", "LICENSE"]`
   - `"engines": { "node": ">=18" }`
3. devDeps: `typescript`, `tsx`, `@types/node`, `vitest`, `prettier`, `eslint`.
4. Runtime deps: `prompts`, `kleur`, `execa`, `fs-extra`, `@babel/parser`, `@babel/traverse`, `@babel/generator`, `@babel/types`.
   - **v5-r6 pinning policy:**
     - `@babel/parser`, `@babel/traverse`, `@babel/generator`, `@babel/types` → use **`~`** (tilde) ranges. Babel AST node shapes can shift between minors; lock to single minor to keep `patchBabel` stable across `npm install` runs by contributors. Bump deliberately + re-snapshot the babel-config fixture.
     - `execa`, `prompts`, `fs-extra`, `kleur` → use **`^`** (caret) ranges. APIs are semver-stable; minor/patch bumps are safe.
     - `typescript` devDep → exact-pin to one version (no `^`/`~`). TypeScript releases break diagnostic output formats; tests assert exact diagnostics. Bump deliberately.
     - All other devDeps → `^` ranges.
5. `tsconfig.json`: `target ES2022`, `module NodeNext`, `outDir dist`, `strict true`.
6. `bin/cli.js` with error guard:
   ```js
   #!/usr/bin/env node
   import("../dist/index.js").catch((err) => {
     if (err?.code === "ERR_MODULE_NOT_FOUND") {
       console.error("Build artifacts missing. Did you run `yarn build`?");
       process.exit(1);
     }
     console.error(err);
     process.exit(1);
   });
   ```
   `chmod +x bin/cli.js`.
7. `src/index.ts` prints "hello from @codingpixel/create-expo-app".
8. Scripts: `build`, `dev`, `test`.
9. `git init`, initial commit.
10. Pre-exec verification (record in `docs/SDK_NOTES.md`). **All probes run from CLI project root**; subshells (`( cd smoke-test && ... )`) isolate any `cd` so outer pwd never drifts. **All output lines are `KEY=VALUE`** so Phase 7/8 can `grep '^FOO=' docs/SDK_NOTES.md` programmatically. Run probes in the order listed — order matters (Probe -1 must install `expo` before Probe 4 reads its tsconfig). **Total: Probes -1 through 8 with sub-probe 0b** (11 probes; v5-r6 corrected the earlier "Numbered probes 0–8" claim).

    ```bash
    # v5-r6: explicit strict mode. Trap fires on success AND first-failure abort.
    # Previous block claimed "set -e safe" via trap but never set the flag, so a
    # Probe -1 failure would cascade into garbage KEY=VALUE lines downstream.
    set -eo pipefail
    trap 'rm -rf smoke-test' EXIT

    # Probe -1 — detect PM once. Every later probe that mutates smoke-test reuses
    # this `PM` so the sequence never hard-codes yarn.
    if yarn --version >/dev/null 2>&1; then PM=yarn; else PM=npm; fi
    echo "SMOKE_PM=$PM" >> docs/SDK_NOTES.md

    # Probe 0 — create smoke target (no install). pwd: project root.
    npx --yes create-expo-app smoke-test --template blank-typescript --no-install

    # Probe 0b — single install pass: `<pm> add babel-preset-expo` (or `--save-dev`)
    # auto-syncs ALL template deps from package.json into node_modules, so we don't
    # need a separate `<pm> install`. This populates `smoke-test/node_modules/expo/`
    # (required by Probe 4 jq read) AND `babel-preset-expo/` (required by Probe 2 grep).
    # v5-r5: dropped redundant second-install block — was a no-op that wasted 30-60s.
    if [ "$PM" = "yarn" ]; then
      ( cd smoke-test && yarn add --dev babel-preset-expo )
    else
      ( cd smoke-test && npm install --save-dev babel-preset-expo )
    fi

    # Probe 1 — confirm target Expo SDK (template-pinned, NOT CLI version). KEY=VALUE.
    echo "EXPO_SDK_VERSION=$(jq -r '.dependencies.expo' smoke-test/package.json)" \
      >> docs/SDK_NOTES.md

    # Probe 2 — auto-inclusion check for worklets/reanimated plugin. KEY=VALUE.
    # v5-r6: dual-strategy. Primary: literal-string grep over compiled JS.
    # Fallback: transitive declaration in babel-preset-expo's own package.json
    # — preset may lazy-load plugin via `require.resolve(computed)` (no literal
    # string), so grep alone false-negatives.
    AUTO=0
    if find smoke-test/node_modules/babel-preset-expo -name "*.js" -print0 2>/dev/null \
       | xargs -0 grep -lqE "react-native-(worklets|reanimated)/plugin" 2>/dev/null; then
      AUTO=1
    else
      # Fallback: check declared deps. Transitive worklets/reanimated in the
      # preset's package.json strongly implies preset's runtime references it.
      TRANSITIVE=$(jq -r \
        '.dependencies."react-native-worklets" // .dependencies."react-native-reanimated" // empty' \
        smoke-test/node_modules/babel-preset-expo/package.json 2>/dev/null)
      if [ -n "$TRANSITIVE" ]; then AUTO=1; fi
    fi
    echo "BABEL_PRESET_AUTO_INCLUDES_WORKLETS=$AUTO" >> docs/SDK_NOTES.md

    # Probe 3 — worklets package name. v5-r5: capture stderr to log so `UNKNOWN`
    # outcome is debuggable. Each attempt appends to the same log file.
    WORKLETS_LOG=docs/SDK_NOTES_probe3-stderr.log
    : > "$WORKLETS_LOG"   # truncate / create
    if ( cd smoke-test && npx expo install react-native-worklets ) >/dev/null 2>>"$WORKLETS_LOG"; then
      echo "WORKLETS_PKG=react-native-worklets" >> docs/SDK_NOTES.md
    elif ( cd smoke-test && npx expo install react-native-worklets-core ) >/dev/null 2>>"$WORKLETS_LOG"; then
      echo "WORKLETS_PKG=react-native-worklets-core" >> docs/SDK_NOTES.md
    else
      echo "WORKLETS_PKG=UNKNOWN" >> docs/SDK_NOTES.md
      echo "# Probe 3 failure details: see $WORKLETS_LOG" >> docs/SDK_NOTES.md
      # Manual fix required: confirm correct package name against current SDK; bake into Phase 7 step 2.
    fi

    # Probe 4 — baseUrl in expo/tsconfig.base. KEY=VALUE.
    # File exists because Probe 0b populated node_modules.
    BASEURL=$(jq -r '.compilerOptions.baseUrl // "null"' \
      smoke-test/node_modules/expo/tsconfig.base.json)
    echo "EXPO_TSCONFIG_BASEURL=$BASEURL" >> docs/SDK_NOTES.md
    # $BASEURL == "null" → Phase 7 step 3 must set baseUrl per 3-tier resolution.

    # Probe 5 — expo install PM-flag support.
    # v5-r5: wrap in `( cd smoke-test && ... )` so help reflects in-project behavior
    # (some Expo CLI versions refuse `expo install --help` outside a project).
    if ( cd smoke-test && npx --yes expo install --help 2>&1 ) | grep -qE "(--yarn|--npm)"; then
      FLAGS_OK=1
    else
      FLAGS_OK=0
    fi
    echo "FLAGS_OK=$FLAGS_OK" >> docs/SDK_NOTES.md
    # FLAGS_OK=0 → Phase 7 step 2 uses Branch B (pre-seed lockfile).

    # Probe 6 — expo install --check IDEMPOTENCY on populated node_modules.
    # v5-r6 rename: was EXPO_INSTALL_CHECK_OK. Renamed to reflect what it actually
    # measures (idempotency / no-diff on already-installed deps), NOT lockfile
    # materialization — Probe 7's PROBE_PASS is the sole driver for Phase 8's
    # explicit-install branch. This probe is diagnostic only; no Phase 7/8
    # behavior keys off its value (informational for SDK_NOTES.md).
    if ( cd smoke-test && npx expo install --check >/dev/null 2>&1 ); then
      echo "EXPO_CHECK_IDEMPOTENT_OK=1" >> docs/SDK_NOTES.md
    else
      echo "EXPO_CHECK_IDEMPOTENT_OK=0" >> docs/SDK_NOTES.md
    fi

    # Probe 7 — lockfile materialization. Branches on FLAGS_OK + PM.
    # v5-r6: `|| true` on each expo install — we WANT to read the lockfile state
    # AFTER install regardless of install exit code (some Expo CLI versions warn
    # and return non-zero but still materialize the lockfile). Outer `set -e`
    # would otherwise abort the subshell before the lockfile check runs.
    (
      cd smoke-test
      rm -f yarn.lock package-lock.json
      if [ "$FLAGS_OK" = "1" ]; then
        if [ "$PM" = "yarn" ]; then
          npx --yes expo install expo-router --yarn >/dev/null 2>&1 || true
        else
          npx --yes expo install expo-router --npm >/dev/null 2>&1 || true
        fi
      else
        if [ "$PM" = "yarn" ]; then
          : > yarn.lock   # empty seed for yarn-mode auto-detect
        else
          echo '{"name":"smoke-test","version":"1.0.0","lockfileVersion":3,"requires":true,"packages":{}}' > package-lock.json
        fi
        npx --yes expo install expo-router >/dev/null 2>&1 || true
      fi
      if [ "$PM" = "yarn" ] && [ -f yarn.lock ]; then
        echo "PROBE_PASS=1"
      elif [ "$PM" = "npm" ] && [ -f package-lock.json ]; then
        echo "PROBE_PASS=1"
      else
        echo "PROBE_PASS=0"
      fi
    ) >> docs/SDK_NOTES.md
    # PROBE_PASS=0 → Phase 8 step 1 runs explicit PM install before lockfile assertion.

    # Probe 8 — Branch B npm-lockfile seed (only when FLAGS_OK=0 AND PM=npm).
    # v5-r6: `|| true` for same reason as Probe 7 above.
    if [ "$FLAGS_OK" = "0" ] && [ "$PM" = "npm" ]; then
      (
        cd smoke-test
        rm -f yarn.lock package-lock.json
        echo '{"name":"smoke-test","version":"1.0.0","lockfileVersion":3,"requires":true,"packages":{}}' \
          > package-lock.json
        npx --yes expo install expo-router >/dev/null 2>&1 || true
        if [ -f package-lock.json ]; then
          echo "NPM_SEED_OK=1"
        else
          echo "NPM_SEED_OK=0"
        fi
      ) >> docs/SDK_NOTES.md
    fi
    # NPM_SEED_OK=0 → Phase 7 step 2 Branch B invokes
    # `npm install --package-lock-only --no-audit` instead of writing JSON directly.

    # Cleanup runs automatically via the EXIT trap registered at the top.
    # (v5-r5: replaced bare `rm -rf` here with trap to handle mid-probe failures under set -e.)
    ```

    Every probe writes a `KEY=VALUE` line into `docs/SDK_NOTES.md`. `readSDKNote(key)` in CLI runtime greps `^<key>=` and returns the value.

**Exit criterion:** `yarn build && node bin/cli.js` prints hello; `SDK_NOTES.md` records verified package names, preset behavior, baseUrl status.

---

## Phase 1 — CLI arg parsing + target dir resolution

### Tasks

1. `src/util.ts` helpers: `isDirEmpty`, `ensureDir`, `log`.
2. `src/bootstrap.ts::resolveTargetDir(arg?)`:
   - Reject absolute paths + `..`-traversal with clear error.
   - `arg === "."` → return `cwd` if no `package.json`, else throw. Name = `path.basename(cwd)`.
   - `arg` non-empty → `path.join(cwd, arg)` after `mkdir -p`. Throw if non-empty.
   - `arg` empty → prompt "App name?", recurse with answer.
3. `src/index.ts` wires it up.
4. Tests:
   - `.` empty cwd → returns cwd.
   - `.` with `package.json` → throws.
   - `my-app` → creates + returns.
   - `my-app` non-empty → throws.
   - `/abs/path` → throws.
   - `../sibling` → throws.

**Exit criterion:** All modes produce expected paths; tests green.

---

## Phase 2 — Interactive prompts

### Tasks

1. `src/prompts.ts` `Answers` type — adds `packageManager`:
   ```ts
   type Answers = {
     primaryFont: string;
     secondaryFont: string;
     bottomSheet: boolean;
     imagePicker: boolean;
     packageManager: "yarn" | "npm";
   };
   ```
2. **v5-r6: `validateEnvVars()` pre-flight** — called from `src/index.ts` BEFORE `resolveTargetDir` (Phase 1). Validates every `EXPO_*` env var's SHAPE (not presence) and throws on bad values BEFORE any fs mutation. Prevents orphan empty directories on invalid input.
   ```ts
   function validateEnvVars(): void {
     const pm = process.env.EXPO_PACKAGE_MANAGER;
     if (pm !== undefined && pm !== "" && pm !== "yarn" && pm !== "npm") {
       throw new Error(`EXPO_PACKAGE_MANAGER: expected "yarn" or "npm", got "${pm}"`);
     }
     for (const key of ["EXPO_INCLUDE_BOTTOM_SHEET", "EXPO_INCLUDE_IMAGE_PICKER"]) {
       const v = process.env[key];
       if (v !== undefined && v !== "" && v !== "0" && v !== "1") {
         throw new Error(`${key}: expected "0" or "1", got "${v}"`);
       }
     }
     // EXPO_PRIMARY_FONT / EXPO_SECONDARY_FONT accept any string (incl. empty) — no shape check.
   }
   ```
   Wire ordering in `src/index.ts`: `validateEnvVars()` → `resolveTargetDir()` → `runCreateExpoApp()` → `gatherAnswers()`. PM-availability probe (yarn/npm `--version`) stays in `gatherAnswers` since it requires fs/PATH side effects only relevant once an answer is needed.

3. `gatherAnswers()`:
   - Reads 4 `EXPO_*` env vars per SPEC §13 truthiness rules (booleans `"1"`/`"0"`, strings empty-allowed). Shape validation already done by `validateEnvVars()` above; this function trusts shapes are valid.
   - Determines `packageManager`:
     - `EXPO_PACKAGE_MANAGER` env var (`"yarn"` or `"npm"`) — explicit override.
     - Else: detect `yarn --version` via `execa("yarn", ["--version"], { timeout: 3000 })` inside try/catch. Successful exit (any stdout, exit 0) → `"yarn"`. `ENOENT` / non-zero / timeout → fall through to npm probe.
     - **Fallback npm probe** (added v5-r4): `execa("npm", ["--version"], { timeout: 3000 })` inside try/catch.
       - Success → `"npm"`.
       - `ENOENT` / non-zero / timeout → throw `"Neither yarn nor npm available — install one before proceeding"` BEFORE Phase 3 mutates any directory. Prevents late install failure after irreversible work.
     - Single PM choice flows through all install steps to avoid dual-lockfile.
   - Skip secondary if primary empty.
   - Missing + non-TTY → throw.
4. Wire into `src/index.ts` (order per `validateEnvVars` note above).
5. Tests:
   - 4 prompt cases: env-all-set skips prompts; primary-empty skips secondary; bottom-sheet/image-picker default `no`; `EXPO_INCLUDE_BOTTOM_SHEET="yes"` throws.
   - `EXPO_PACKAGE_MANAGER="yarn"` → `packageManager === "yarn"`.
   - `EXPO_PACKAGE_MANAGER="pnpm"` → throws "expected yarn or npm".
   - Yarn missing on PATH (`ENOENT`) → fallback to `"npm"`.
   - `yarn --version` exceeds 3000ms timeout (simulate via mocked `execa` rejecting with `TimeoutError`) → fallback to `"npm"`.
   - **v5-r4:** Both yarn AND npm missing (simulate both `execa` mocks rejecting with `ENOENT`) → throws `"Neither yarn nor npm available — install one before proceeding"`. Assert throw happens before any other side effect (no fs writes, no other probes).
   - **v5-r6 — `validateEnvVars` pre-flight tests:**
     - `EXPO_PACKAGE_MANAGER="pnpm"` → throws BEFORE `resolveTargetDir` runs (assert via fs-mock: zero `mkdir` calls).
     - `EXPO_INCLUDE_BOTTOM_SHEET="yes"` → throws before any fs mutation.
     - `EXPO_INCLUDE_IMAGE_PICKER="true"` → throws (strict `0`/`1`).
     - All-empty env vars → no-op (no throw); pipeline continues to prompt path.

**Exit criterion:** Manual + env-driven runs work; PM detected; tests green; invalid env vars rejected before fs side effects.

---

## Phase 3 — Wrap `create-expo-app`

### Tasks

1. `src/bootstrap.ts::runCreateExpoApp(dir, name)`: `npx --yes create-expo-app@latest <dir> --template blank-typescript --no-install` via `execa`, inherit stdio. `--yes` forces fresh fetch (skip stale globals).
2. `cleanupBlankTemplate(target)`: delete `<target>/App.tsx` only (blank-typescript ships it; collides with expo-router auto-detection of `src/app/`).
3. Wire after `resolveTargetDir` in `src/index.ts`.
4. Smoke test: `node bin/cli.js test-output` produces shell with `App.tsx` removed.

**Exit criterion:** Shell exists, `App.tsx` deleted.

---

## Phase 4 — Template overlay

### Placeholder conventions

Two sentinel forms, picked by position:

| Position | Form | Reason |
|---|---|---|
| Module scope (imports, top-level statements) | `// @@TOKEN@@` (line comment, own line) | Valid TS at module scope |
| Inside JSX children | `{/* @@TOKEN@@ */}` (JSX expression with comment) | Required — bare `//` invalid as JSX child |

Sentinel list:

```
// @@USE_FONTS_IMPORT@@           (module — _layout.tsx imports)
// @@USE_FONTS_HOOK@@             (module — inside function body)
// @@USE_FONTS_GUARD@@            (module — inside function body)
// @@BOTTOM_SHEET_PROVIDER_IMPORT@@  (module — _layout.tsx imports)
{/* @@BOTTOM_SHEET_PROVIDER_OPEN@@ */}   (JSX child)
{/* @@BOTTOM_SHEET_PROVIDER_CLOSE@@ */}  (JSX child)
// @@MEDIA_CONSTANTS@@            (module — constants.ts)
// @@FONTS_OBJECT@@                 (module — fonts.ts)
```

`overlay.ts` matches both forms via **two paired regexes** (single regex can't enforce opener↔closer correlation):

```ts
// v5-r6: tightened to [A-Z_]+ to match Phase 6 grep + reject lowercase typos.
const MODULE_SENTINEL = /^\s*\/\/\s*@@([A-Z_]+)@@\s*$/;          // // @@TOKEN@@
const JSX_SENTINEL    = /^\s*\{\/\*\s*@@([A-Z_]+)@@\s*\*\/\}\s*$/; // {/* @@TOKEN@@ */}
const ORPHAN_PROBE    = /@@[A-Z_]+@@/;                            // same shape, anywhere on line
```

Per line: try `MODULE_SENTINEL` first; if no match try `JSX_SENTINEL`. **Lines that match neither regex but still contain a `@@[A-Z_]+@@` substring MUST throw** — neither regex matches the mismatched/inline cases, so an explicit orphan-detection step is required to enforce the rule. **All three patterns use the same `[A-Z_]+` token class** so a lowercase typo like `@@bottom_sheet@@` is caught as orphan instead of leaking through:

```ts
for (const line of lines) {
  const moduleMatch = line.match(MODULE_SENTINEL);
  const jsxMatch    = line.match(JSX_SENTINEL);
  if (moduleMatch) {
    // replace with module block
  } else if (jsxMatch) {
    // replace with JSX block
  } else if (ORPHAN_PROBE.test(line)) {
    throw new Error(
      `Malformed sentinel (not whole-line, or opener↔closer mismatched): ${line}`
    );
  } else {
    // passthrough
  }
}
```

Examples of throws:
- `// @@FOO@@ */}` — module opener with JSX closer → throw.
- `{/* @@FOO@@` — JSX opener without closer → throw.
- `const x = /* @@FOO@@ */ 1;` — inline sentinel inside live code → throw.
- `// before @@FOO@@ after` — sentinel doesn't own its line → throw.

Replaces each whole-line sentinel with generated block, OR removes the line entirely if block empty (no orphan blanks). Verification deferred to generate-then-build E2E (Phase 8) — no standalone `tsc --noEmit` on `templates/base/` (peer-dep imports unavailable in CLI package scope).

### Tasks

0. **Create `docs/MIRROR_NOTES.md`** before mirror step. Skeleton:
   ```markdown
   # MyRoster → @codingpixel/create-expo-app alias mirror

   **Date:** YYYY-MM-DD
   **Source commit:** <MyRoster sha at inspection time>

   ## Alias mapping (confirmed against source)
   | MyRoster alias (actual) | V5 alias | Notes |
   |---|---|---|
   | ... | ... | ... |

   ## Files copied
   - `path/to/file.tsx` ← `myroster/path/to/file.tsx`
   - ...

   ## Manual-review flags
   - `<file>`: relative `../` import crossing `src/` boundary — rewrote to `@<alias>/...`
   ```
   Populated during mirror step (task 5). Lives in `docs/`, NOT in `templates/`. **Placeholder-fill rules:**
   - Replace `YYYY-MM-DD` with actual mirror date (the day MyRoster was inspected).
   - Replace `<MyRoster sha at inspection time>` with output of `git -C <myroster-path> rev-parse HEAD`.
   - If zero `## Manual-review flags` items found, write literal `_None._` under that heading rather than leaving the section empty (signals "audit complete with nothing flagged" vs "audit skipped").
1. `templates/base/` paths — `assets/` at project root (not `src/assets/`):
   - `assets/fonts/.gitkeep`
   - `assets/images/.gitkeep`
   - `assets/index.ts` (`export {};`)
   - `src/app/_layout.tsx` with 6 sentinels (mixed `//` + `{/* */}` forms per "Placeholder conventions" above).
   - `src/app/routes.tsx` (dummy Stack).
   - `src/app/index.tsx` (Hello World via `AppWrapper` + `AppText`).
   - `src/core/hooks/.gitkeep`
   - `src/core/redux/` (5 files; userSlice dummy).
   - `src/core/services/.gitkeep`
   - `src/core/tanstack/` (`index.tsx` + `tanstack-keys.ts`).
   - `src/core/utils/`: `config.ts`, `endpoints.ts`, `types.ts`, `validation.ts`, `constants.ts` with `// @@MEDIA_CONSTANTS@@`.
   - `src/features/.gitkeep`
   - `src/ui/appComponents/` (24 primitives + modals — see SPEC §6.1).
   - `src/ui/components/errorFallback/index.tsx`.
   - `src/ui/iconComponents/` (7 wrappers — see SPEC §6.2).
   - `src/ui/theme/`: `colors.ts`, `responsive.ts`, `allFileStyles.ts`, `fonts.ts` with `// @@FONTS_OBJECT@@`.
2. Provider tree in `_layout.tsx` (drops `SafeAreaInsetsProvider`):
   ```
   Provider (redux store)
     PersistGate
       TanStackQueryProvider
         GestureHandlerRootView
           SafeAreaProvider
             KeyboardProvider
               {/* @@BOTTOM_SHEET_PROVIDER_OPEN@@ */}
                 ErrorBoundary
                   Routes
               {/* @@BOTTOM_SHEET_PROVIDER_CLOSE@@ */}
   ```
3. `src/overlay.ts::rewriteImports(filePath, aliasMap)`:
   - Reads file, replaces import specifiers per `aliasMap`.
   - **v5-r6: regex extended to cover all four module-reference forms** (was `from "..."` only):
     ```ts
     const SPECIFIER_FORMS = [
       /(\bfrom\s+)(["'])([^"']+)(\2)/g,            // import ... from "x" | export ... from "x"
       /(\bimport\s*\(\s*)(["'])([^"']+)(\2)/g,     // dynamic import("x")
       /(\brequire\s*\(\s*)(["'])([^"']+)(\2)/g,    // require("x")
       /(\bjest\.mock\s*\(\s*)(["'])([^"']+)(\2)/g, // jest.mock("x", ...)
     ];
     ```
     Each form captures specifier in group 3. If specifier starts with any source alias, swap prefix for target alias and reassemble. Today's templates are `from`-only but future mirrored files may use dynamic forms; covering all four prevents silent miss.
   - **Iteration order: longest source-prefix first.** Sort `aliasMap` entries by source-prefix length descending before iteration to prevent shorter prefixes (e.g. hypothetical `@/`) from consuming longer specific ones (e.g. `@/assets`). Implementation: `Object.entries(aliasMap).sort((a, b) => b[0].length - a[0].length)`.
   - Idempotent.
4. MyRoster → V5 alias mapping table (record actuals during mirror step in `docs/MIRROR_NOTES.md`):
   | MyRoster alias (assumed) | V5 alias |
   |---|---|
   | `@/theme/*` | `@theme/*` |
   | `@/utils/*` | `@utils/*` |
   | `@/redux/*` | `@redux/*` |
   | `@/core/*` | `@core/*` |
   | `@/services/*` | `@services/*` |
   | `@/hooks/*` | `@hooks/*` |
   | `@/appComponents/*` | `@appComponents/*` |
   | `@/components/*` | `@components/*` |
   | `@/icons/*` | `@icons/*` |
   | `@/features/*` | `@features/*` |
   | `@/assets` | `@assets` |
   | bare `../` relative imports crossing src boundaries | flagged for manual review |
   Mapping confirmed by inspecting MyRoster source before mirror; table updated in `MIRROR_NOTES.md` per actual aliases found.
5. Mirror step — for each MyRoster source copied into `templates/base/`:
   - Run `rewriteImports` with the mapping table.
   - Verify zero MyRoster-specific prefixes remain. `@/*` IS a legitimate V5 catchall alias — DO NOT ban it. Grep specifically for the left-column patterns expected to have been rewritten. **Use `if` form so it's safe under `set -e`** (raw `grep && exit` pattern aborts on the "no match" case when scripts use strict mode):
     ```bash
     # @/assets anchored with (/|["']) terminator so it doesn't match @/assetspath etc.
     PATTERNS='@/theme/|@/utils/|@/redux/|@/core/|@/services/|@/hooks/|@/appComponents/|@/components/|@/icons/|@/features/|@/assets(/|["'\''])'
     if find templates/base \( -name "*.ts" -o -name "*.tsx" \) -print0 \
        | xargs -0 grep -nE "from ['\"]($PATTERNS)"; then
       echo "FAIL: unmapped MyRoster prefix remains"
       exit 1
     fi
     ```
     (POSIX `find`+`xargs` — avoids bash/zsh-only brace expansion that fails silently in `sh`/`dash`.)
     Bare `@/<arbitrary>` imports allowed (resolve via `@/*` → `src/*` catchall).
6. `src/overlay.ts::copyTemplate(srcRoot, destRoot)`, `applyBase(target, answers)`.
7. `src/patch.ts::patchAppJson(target, name, answers)`:
   - `expo.scheme` = slug of `name`.
   - `expo.plugins` ensure-array, add `"expo-router"` if missing. **Idempotency:** use the `nameOf` equality predicate defined in Phase 5 step 5 — string `"expo-router"` is equivalent to `["expo-router", opts]` for dedup purposes; preserve user's options object if present.
8. `src/patch.ts::patchExpoRouterEntry(target)`:
   - `<target>/package.json` `main` = `"expo-router/entry"`.
   - Verify `tsconfig.json` extends `expo/tsconfig.base`; add if missing.
9. Wire after `runCreateExpoApp`.
10. Fonts type-position audit — POSIX-safe find, `if` form for `set -e` safety. **Pattern extended in v5-r4** to catch more type-position uses; explicit allowlist for `keyof typeof Fonts` (legit FontKey pattern):
    ```bash
    # Flag type-position uses: `: Fonts`, `<Fonts>` (generic param),
    # `Fonts[` (indexed access type), `as Fonts` (assertion), `Record<Fonts`,
    # `extends Fonts`, `implements Fonts`.
    # ALLOWED (do not flag): `Fonts.BOLD` (value access), `typeof Fonts`,
    # `keyof typeof Fonts` (FontKey pattern).
    # v5-r5 caveat: `Fonts\s*\[` ALSO matches `Fonts["BOLD"]` (legit bracket value
    # access). When audit fires on such a hit, fix is to either (a) rewrite to dot
    # notation `Fonts.BOLD`, or (b) extract via `FontKey` type if dynamic key needed.
    # Type-position bracket usage (`Fonts[KeyType]`) is the genuine target.
    PATTERN=':\s*Fonts\b|<Fonts>|Fonts\s*\[|\bas\s+Fonts\b|Record<Fonts|\bextends\s+Fonts\b|\bimplements\s+Fonts\b'
    if find templates/base \( -name "*.ts" -o -name "*.tsx" \) -print0 \
       | xargs -0 grep -nE "$PATTERN"; then
      echo "FAIL: Fonts-as-type misuse in templates/base"
      # Rewrite matches to FontKey or (typeof Fonts)[keyof typeof Fonts]; commit fix.
      exit 1
    fi
    ```
    Document result in commit. Audit script (`scripts/audit-templates.sh`, Phase 10) reuses the same `$PATTERN`.

**Exit criterion:** Files present at correct paths; expo-router entry + plugin + scheme configured; `App.tsx` gone; imports rewritten; `Fonts` type-position audit complete; zero MyRoster-specific prefixes remaining in mirrored files.

---

## Phase 5 — Conditional overlays

### Tasks

0. Rerun MyRoster audit on `templates/bottom-sheet/` + `templates/image-picker/` (same logic as Phase 4 steps 5 + 10, scoped to these dirs). Bug surfaces only when user picks yes if these dirs skip the audit. Run during template authoring (one-time), not per-CLI-invocation. **`if` form for `set -e` safety; Fonts pattern extended per v5-r4:**
   ```bash
   # @/assets anchored with (/|["']) terminator (matches Phase 4 step 5).
   PATTERNS='@/theme/|@/utils/|@/redux/|@/core/|@/services/|@/hooks/|@/appComponents/|@/components/|@/icons/|@/features/|@/assets(/|["'\''])'
   FONTS_TYPE_PATTERN=':\s*Fonts\b|<Fonts>|Fonts\s*\[|\bas\s+Fonts\b|Record<Fonts|\bextends\s+Fonts\b|\bimplements\s+Fonts\b'
   for DIR in templates/bottom-sheet templates/image-picker; do
     [ -d "$DIR" ] || continue
     if find "$DIR" \( -name "*.ts" -o -name "*.tsx" \) -print0 \
        | xargs -0 grep -nE "from ['\"]($PATTERNS)|$FONTS_TYPE_PATTERN"; then
       echo "FAIL: audit failed in $DIR"
       exit 1
     fi
   done
   ```
1. `templates/bottom-sheet/` — 5 App* components.
2. `templates/image-picker/`:
   - `src/core/services/PermissionService.ts`.
   - `media-constants.snippet.ts` — text spliced into `constants.ts`.
3. `src/overlay.ts`:
   - `applyBottomSheet(target)` if `answers.bottomSheet`.
   - `applyImagePicker(target)` copies `PermissionService.ts` if `answers.imagePicker`.
4. `src/patch.ts::patchConstants(target, answers)` — **always runs** (regardless of `imagePicker`):
   - Reads `<target>/src/core/utils/constants.ts`.
   - Replaces `// @@MEDIA_CONSTANTS@@`:
     - If `answers.imagePicker` → snippet from `templates/image-picker/media-constants.snippet.ts`.
     - Else → empty (drop sentinel line; no orphan blank).
   - Fixes v3 orphan-sentinel bug where picker=no left `@@MEDIA_CONSTANTS@@` in output.
5. `src/patch.ts::patchAppJsonPlugins(target, answers)`:
   - If `answers.imagePicker` push image-picker plugin entry. **Idempotency predicate** — plugin entry is `string | [string, object]`. Treat as duplicate iff existing entry's plugin name (`entry` itself if string, `entry[0]` if array) equals new entry's name:
     ```ts
     const nameOf = (e: unknown) => Array.isArray(e) ? e[0] : e;
     const exists = plugins.some(e => nameOf(e) === nameOf(newEntry));
     if (!exists) plugins.push(newEntry);
     ```
     Options object NOT compared (user may have customized; preserve their version). Apply same predicate for `"expo-router"` entry in `patchAppJson`.
6. Wire `applyBottomSheet` → `applyImagePicker` → `patchConstants` → `patchAppJsonPlugins` after `applyBase`.

**Exit criterion:**
- picker yes: snippet spliced; plugin entry present.
- picker no: constants file has clean tail (no sentinel, no orphan blank); no plugin entry.
- Both verified by scoped `@@[A-Z_]+@@` grep (excluding `node_modules`) per Phase 6 step 5, assuming Phase 6 also done.

---

## Phase 6 — Fonts generation + sentinel replacement

(`patchLayout` handles `_layout.tsx` + `fonts.ts` sentinels; `patchConstants` from Phase 5 handles `constants.ts`.)

### Tasks

1. `src/fonts.ts::generateFontsObject(primary, secondary)` — object literal `as const` + `FontKey`.
2. `generateUseFontsBlocks(primary, secondary)` — 3 strings.
3. `generateBottomSheetProviderBlocks(bottomSheet)` — 3 strings.
4. `src/patch.ts::patchLayout(target, answers)`:
   - `src/ui/theme/fonts.ts`: replace `// @@FONTS_OBJECT@@`.
   - `src/app/_layout.tsx`: replace 6 sentinels (mixed `//` + `{/* */}`).
   - Empty replacements drop whole line.
5. Tests as v3 + scoped assertion. Avoid blanket `grep -r "@@"` (matches JSDoc `@@deprecated`, doc strings in `node_modules`, etc.). Scope to project sources excluding `node_modules`. **`OUTPUT_DIR` is the generated project's target directory under test** (caller substitutes). `if`-form for `set -e` safety; explicit empty-input guard avoids `xargs grep` hanging on stdin when find yields zero files:
   ```bash
   OUTPUT_DIR="${1:-./test-output}"   # caller passes target; default for ad-hoc runs
   MATCHES=$(
     find "$OUTPUT_DIR" -path "*/node_modules" -prune -o \
         \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.js" \) \
         -print0 \
       | xargs -0 grep -lE "@@[A-Z_]+@@" 2>/dev/null || true
   )
   if [ -n "$MATCHES" ]; then
     echo "FAIL: @@TOKEN@@ residue in:"
     echo "$MATCHES"
     exit 1
   fi
   ```
   - Pattern `@@[A-Z_]+@@` matches only our sentinel shape, not arbitrary `@@`.
   - Capturing matches via command substitution avoids the xargs-no-input hang (no `xargs` invocation if find prints nothing — pipeline is broken when `MATCHES` is empty string).
   - `2>/dev/null || true` swallows xargs/grep stderr + non-zero exit from "no match" — we judge success by emptiness of `$MATCHES`, not by exit code.
6. **Inline-sentinel rejection test:** `overlay.ts` MUST throw on `const x = /* @@FOO@@ */ 1;` or `// before @@FOO@@ after`. Unit test feeds malformed fixture; assert throw.

**Exit criterion:** Zero `@@[A-Z_]+@@` sentinel residue in generated project sources (excluding `node_modules`) under any combination; inline sentinels throw.

---

## Phase 7 — `package.json` / `tsconfig.json` / `babel.config.js` patching

### Tasks

1. `src/patch.ts::patchPackageJsonScripts(target)`:
   - Scripts: `start`, `android`, `ios`, `web`, `lint`.
   - Preserve `main: "expo-router/entry"` + `expo` key + all create-expo-app-set keys.
2. `src/install.ts::installNativeDeps(target, answers)`:
   - **PM enforcement branch (per Phase 0 step 10 verification of `--yarn`/`--npm` flag support):**
     - **Branch A (flags supported):** `pmFlag = answers.packageManager === "yarn" ? "--yarn" : "--npm"`. Pass as final arg.
     - **Branch B (flags absent in installed `@expo/cli`):** pre-seed valid lockfile of chosen PM in `<target>`, then run `expo install` without flag — Expo CLI auto-detects PM from lockfile presence. **npm 7+ rejects bare `{}`** as missing `lockfileVersion`; seed minimal valid lockfile instead:
       ```ts
       if (answers.packageManager === "yarn") {
         fs.writeFileSync(path.join(target, "yarn.lock"), "");
       } else {
         const minimalNpmLock = {
           name: path.basename(target),
           version: "1.0.0",
           lockfileVersion: 3,
           requires: true,
           packages: {},
         };
         fs.writeFileSync(
           path.join(target, "package-lock.json"),
           JSON.stringify(minimalNpmLock, null, 2),
         );
       }
       ```
       **Phase 0 `NPM_SEED_OK` probe outcome:** if probe returned `NPM_SEED_OK=0`, replace the npm branch above with `execa("npm", ["install", "--package-lock-only", "--no-audit"], { cwd: target })` to materialize a fully valid lockfile via npm itself before `expo install` runs.
   - Runs:
     ```
     npx --yes expo install <deps...> [<pmFlag>]
     ```
     via `execa("npx", [...], { cwd: target, stdio: "inherit" })` — **cwd explicit**.
   - Always-installed list (per SPEC §7): `@reduxjs/toolkit react-redux redux-persist react-native-mmkv @tanstack/react-query axios formik yup expo-router expo-dev-client react-native-safe-area-context react-native-gesture-handler react-native-screens react-native-reanimated react-native-worklets react-native-keyboard-controller react-error-boundary react-native-responsive-fontsize @expo/vector-icons @shopify/flash-list`.
     - Substitute `react-native-worklets-core` if Phase 0 verification picked the other name.
   - If `answers.bottomSheet`: append `@gorhom/bottom-sheet` to the same `expo install` call (single invocation).
   - If `answers.imagePicker`: append `expo-image-picker`.
   - Single `expo install` call → single PM resolution pass → no dual-lockfile.
   - **On atomic failure** (any dep version resolution fails): inspect stderr first.
     - **Transient (network):** stderr contains `ETIMEDOUT`, `ECONNRESET`, `ENOTFOUND`, `network`, `socket hang up`, or registry 5xx → abort immediately with `"Network failure — check connection and retry. Target dir preserved; re-run CLI to retry."` NO per-dep retry (would multiply registry hits during outage).
     - **Deterministic (version-resolution / version-not-found / peer-conflict):** run isolation retry to identify the culprit. **Concrete algorithm (v5-r4 — was previously hand-wavy):**
       ```ts
       async function retryWithIsolation(target: string, deps: string[]): Promise<void> {
         let remaining = [...deps];                                     // working set
         const failedTwice = new Set<string>();                          // hard fails
         let lastStderr = "";
         while (remaining.length > 0) {
           const { exitCode, stderr } = await execa(
             "npx", ["--yes", "expo", "install", ...remaining],
             { cwd: target, reject: false }
           );
           if (exitCode === 0) return;                                   // success
           lastStderr = stderr;
           if (isTransientError(stderr)) {
             throw new Error("Network failure — check connection and retry. ...");
           }
           const culprit = parseFailingDep(stderr, remaining);           // see below
           if (!culprit) {
             throw new Error(`Install failed with unparseable stderr:\n${stderr}`);
           }
           if (failedTwice.has(culprit)) {
             throw new Error(`'${culprit}' failed twice; aborting.\n${stderr}`);
           }
           failedTwice.add(culprit);
           remaining = remaining.filter(d => d !== culprit);              // drop culprit, retry rest
         }
         // If loop exits with remaining empty AND at least one dep got dropped, we DID NOT install everything.
         if (failedTwice.size > 0) {
           throw new Error(
             `Could not install: ${[...failedTwice].join(", ")}\n${lastStderr}`
           );
         }
       }
       ```
       - `parseFailingDep(stderr, remaining)` — regex `/(?:Cannot find|Could not resolve|No matching version for|Conflicting peer dependency for)\s+["']?([@\w/-]+)["']?/i` matched against stderr; return name only if it appears in `remaining`. Else return last-mentioned `remaining` package name in stderr; else `null`.
       - First iteration runs against full `deps` list (single `expo install <all>` call). Only retries hit per-dep mode by progressively excluding identified culprits.
       - Worst case = `deps.length` extra calls (each retry drops one dep). Bounded.
       - Each culprit appears in error message at end. CLI prints culprits + full stderr verbatim. Still aborts non-zero — never auto-recovers.
     - **Unparseable / unknown stderr:** treat as deterministic but `parseFailingDep` returns `null` → throw immediately with full stderr. No retry (would loop forever).
   - Unit tests for `retryWithIsolation`: mock `execa` to return scripted failures; assert culprit isolation, twice-fails-throws, transient-aborts-fast, unparseable-throws-once.
   - **v5-r6 — fixture corpus for `parseFailingDep`:** maintain `tests/fixtures/expo-install-stderr/` with real captured stderr samples per Expo CLI minor version observed (e.g. `expo-cli-54.0.x-version-not-found.txt`, `expo-cli-54.0.x-peer-conflict.txt`, `expo-cli-55.0.x-network-etimedout.txt`). Unit test iterates ALL fixtures + asserts:
     - Each "deterministic" fixture → `parseFailingDep` returns expected culprit name (encoded in fixture filename).
     - Each "transient" fixture → `isTransientError` returns true.
     - When new Expo CLI version ships and stderr format shifts, add new fixture, run test → red, update regex/keyword list, green. Prevents silent regression on Expo CLI bumps.
   - Document fixture-capture procedure in `docs/MIRROR_NOTES.md` companion file `docs/EXPO_STDERR_NOTES.md` (paste recipe: deliberately request `expo install foo@99.99.99` etc).
3. `src/patch.ts::patchTsconfig(target)`:
   - Read existing tsconfig; preserve `extends: "expo/tsconfig.base"`.
   - **`baseUrl` resolution order** (preserve user intent, never silently overwrite):
     1. If user's own `tsconfig.json` already sets `compilerOptions.baseUrl` → preserve, no edit.
     2. Else if Phase 0 verified `expo/tsconfig.base` provides `baseUrl` → no edit (inherited).
     3. Else → set `compilerOptions.baseUrl = "."` in user tsconfig.
   - Merge `compilerOptions.paths` with SPEC §9 aliases (deep merge — preserve any user-added paths).
   - Detect `@/*` collision (user already set `@/*` to a non-`src/*` target) → log warning, preserve user's value, skip our `@/*` injection. Other aliases (`@theme/*` etc.) still injected.
4. `src/patch.ts::patchBabel(target)` — AST merge. **Plugin order matters** (reanimated/worklets plugin MUST be last per upstream docs):
   - **File-extension detection** (first): if `babel.config.ts`, `babel.config.cjs`, or `babel.config.mjs` exists and `babel.config.js` is absent → abort with `"manual babel config (non-.js) not yet supported"`. Phase 0 Probe 2 confirms the default `.js` form for current SDK.
   - Parse `babel.config.js` via `@babel/parser`.
   - Locate returned `ObjectExpression`; ensure `plugins` array.
   - **Step 0 — decision prelude** (computed once before mutations; Step A/B/C reference these flags):
     ```ts
     const nameOf = (e: unknown): string =>
       Array.isArray(e) ? String(e[0]) : String(e);
     const isWorklets = (e: unknown): boolean =>
       /^react-native-worklets(-core)?\/plugin$/.test(nameOf(e));

     const moduleResolverPresent = plugins.some(e => nameOf(e) === "module-resolver");
     const moduleResolverIsLast  = plugins.length > 0
       && nameOf(plugins[plugins.length - 1]) === "module-resolver";
     const workletsPresent       = plugins.some(isWorklets);
     const workletsAutoIncluded  = readSDKNote("BABEL_PRESET_AUTO_INCLUDES_WORKLETS"); // Phase 0 Probe 2
     const workletsNeedsInsertion = !workletsAutoIncluded && !workletsPresent;
     ```
   - **Step A — module-resolver:**
     - If `!moduleResolverPresent` → insert `["module-resolver", { alias: <map> }]` at index 0 (front of array). Front placement guarantees it never displaces the last-slot reservation for worklets.
     - **Edge-case throw:** if `moduleResolverIsLast && workletsNeedsInsertion` (decided above, so no temporal ambiguity) → throw `"module-resolver cannot occupy the final plugin slot when worklets plugin is required; please reorder babel.config.js plugins manually."` Refuses to silently relocate user-positioned entries.
   - **Step B — worklets:**
     - `workletsAutoIncluded` true → skip (preset handles it).
     - `workletsNeedsInsertion` true → push `"react-native-worklets/plugin"` (or `-core` per Phase 0 `WORKLETS_PKG`) to **end** of array.
   - **Step C — post-patch invariant assert (with user-mutation tolerance):** locate worklets entry's index in the final `plugins` array. If none → no-op. Else if it's the last element → no-op. Else (trailing entries exist after worklets), **iterate ALL trailing entries** (was previously checking only the last index — see v5-r6 #1):
     ```ts
     const workletsIdx = plugins.findIndex(isWorklets);
     if (workletsIdx !== -1 && workletsIdx !== plugins.length - 1) {
       const trailing = plugins.slice(workletsIdx + 1);
       const OURS = new Set(["module-resolver"]);  // names we insert
       const oursAfter = trailing.filter(e => OURS.has(nameOf(e)));
       const userAfter = trailing.filter(e => !OURS.has(nameOf(e)));
       if (oursAfter.length > 0) {
         throw new Error(
           `babel.config.js: our patch corrupted plugin order — worklets must be last. ` +
           `Offending trailing entries from our patch: ${oursAfter.map(nameOf).join(", ")}`
         );
       }
       if (userAfter.length > 0) {
         console.warn(
           `babel.config.js: plugin(s) [${userAfter.map(nameOf).join(", ")}] appear after ` +
           `worklets — reanimated requires worklets last; please reorder.`
         );
       }
     }
     ```
     Closes loop bug where `[m-r, worklets, X, Y]` previously only inspected `Y`. Now every entry after worklets is classified; throws once if any our-inserted entry trails; warns once with all user-trailing names collected. Preserves user intent; problem surfaces at runtime/build if misconfigured.
   - On parse fail → explicit abort. On idempotent rerun (both plugins already in correct positions) → no-op.
5. Tests:
   - `patchPackageJsonScripts`: scripts present, `main` survives, `expo` key survives.
   - `patchTsconfig`: paths merged, `extends` preserved, `baseUrl` set when needed, collision warning emitted.
   - `patchBabel`: snapshot test against current create-expo-app fixture; idempotent rerun.
6. Manual smoke.

### Cross-cutting — Partial-failure handling

(v5-r5: extracted from former Phase 7 step 7 — this is global error-handling policy, not a sequential patcher, so the numbered-step framing was misleading.)

Phases 3–8 mutate `<target>` in place. If any phase throws mid-execution, target dir is left half-modified. Two complementary strategies — **both** active simultaneously (A is the runtime behavior; B is the user-facing message):

- **A — Idempotent rerun:** every patch detects already-applied state and no-ops. `patchPackageJsonScripts` checks each script key before write. `patchTsconfig` deep-merges (no overwrite). `patchBabel` has idempotency check via Step 0 decision prelude. `patchAppJsonPlugins` has `nameOf` equality predicate. Result: user can re-run CLI on same target after fixing root cause; CLI converges to correct state.
- **B — Error-message recovery hint:** on any uncaught throw past Phase 3 (`runCreateExpoApp`), `src/index.ts` wraps with try/catch and emits:
  ```
  CLI failed mid-patch. Target dir `<path>` is in an inconsistent state.
  Recovery: `rm -rf <path>` and re-run, OR fix the root cause and re-run
  (patches are idempotent and will converge).
  ```

**Never auto-delete the target dir.** Phase 1 rejects `.` only when `package.json` exists in cwd — a user pointing at `.` in a draft directory (only a `README.md` or unstaged notes) passes Phase 1 but would lose work to `rm -rf`. Defense-in-depth: leave target as-is; show recovery hint; user decides whether to wipe or salvage.

**Exit criterion:** Tests green; manual inspection passes; single lockfile produced (`yarn.lock` OR `package-lock.json`, not both); idempotent rerun on same target produces no diff.

---

## Phase 8 — Lockfile verification + success message

### Tasks

1. `src/install.ts::ensureLockfile(target, answers)` — renamed from `verifyLockfile` because this function conditionally **installs** before verifying (per Phase 0 probe outcome); the old name misled readers into thinking it was read-only:
   - **Per Phase 0 lockfile-materialization probe outcome (recorded in `SDK_NOTES.md`):**
     - **Probe passed** (expo install materialized lockfile): no additional install needed.
     - **Probe failed** (expo install only edited `package.json`): run explicit PM install first:
       ```ts
       const pm = answers.packageManager;
       const installCmd = pm === "yarn" ? "yarn" : "npm";
       await execa(installCmd, ["install"], { cwd: target, stdio: "inherit" });
       ```
   - Assert exactly one of (`yarn.lock`, `package-lock.json`) exists in `<target>`:
     - **Zero** → error: install failed silently. Abort with stderr from preceding install step verbatim.
     - **Two** (v5-r5: never silent-delete; fail loud — two lockfiles signal a Phase 7 bug whose root cause depends on the active branch):
       - `FLAGS_OK=1` (Branch A) → throw:
         `"Both yarn.lock and package-lock.json present after expo install --<pm> succeeded. Installed Expo CLI version is not honoring the PM flag. File an issue with Expo CLI version (npx expo --version) + this CLI's version."`
       - `FLAGS_OK=0` (Branch B) → throw:
         `"Both yarn.lock and package-lock.json present after lockfile pre-seed. expo install created the other PM's lockfile, ignoring the seed. Re-run with EXPO_PACKAGE_MANAGER=<other PM> as a workaround; file an issue."`
       Neither auto-deletes. User decides whether to wipe + retry or salvage.
     - **One matching** `answers.packageManager` → OK.
     - **One mismatching** (v5-r6: promoted from quiet warn to loud actionable warning — silently accepting violates explicit user/env PM choice). Non-fatal (one valid lockfile = scaffold usable) but emit prominent banner with recovery hint:
       ```
       ⚠️  PM MISMATCH: requested <answers.pm> but Expo CLI produced <other>.lock.
       Installed Expo CLI version likely ignored the PM flag/seed.
       Recovery options:
         (1) Accept the produced PM — your project is functional.
         (2) Re-run with EXPO_PACKAGE_MANAGER=<other> to align config with reality.
         (3) Delete <other>.lock, then run `<requested-pm> install` manually.
       ```
       Print to stderr with red/yellow ANSI so it's visible above the success message. Final success message still shows correct next-steps for the PRODUCED PM (not requested), so user-visible commands stay accurate.
2. Final message:
   - Green checkmark.
   - `cd <dir>`.
   - `npx expo prebuild` reminder.
   - `<pm> ios` / `<pm> android` (substitute `yarn` or `npm run`).
   - Link to README "Adding fonts" if primary font provided.
   - Link to README "First-time dev-client build".

**Exit criterion:** End-to-end `node bin/cli.js test-app` → `npx expo prebuild && yarn ios` (or `npm run ios`) succeeds. Single lockfile present.

---

## Phase 9 — Claude Code slash command

### Tasks

1. `templates/claude-command/init-app.md`:
   - Body uses `AskUserQuestion` for: app name, target dir, 4 prompt answers, PM choice. **All answers must be resolved before invoking the CLI** — slash-command flow is non-TTY (CLI sees no stdin), so any missing prompt answer would throw per Phase 2. The `<dir>` arg MUST be a non-empty string (never left as literal `<dir>` placeholder); if user wants prompt, slash command MUST capture the app name first via `AskUserQuestion` and substitute it into the command.
   - Env var string includes `EXPO_PACKAGE_MANAGER` (concrete example with all four `EXPO_*` vars + dir filled):
     ```bash
     EXPO_PRIMARY_FONT="" EXPO_SECONDARY_FONT="" \
       EXPO_INCLUDE_BOTTOM_SHEET="0" EXPO_INCLUDE_IMAGE_PICKER="0" \
       EXPO_PACKAGE_MANAGER="yarn" \
       npx @codingpixel/create-expo-app my-app    # substitute resolved app name here
     ```
2. README install section.
3. Manual test.

**Exit criterion:** `/init-app` prompts user, produces working project with chosen PM.

---

## Phase 10 — Documentation + publishing

### Tasks

1. Write `README.md`:
   - **"Not Expo Go-compatible"** — list native modules; explain `expo-dev-client` + prebuild flow.
   - **"Adding fonts after install"** — drop `.ttf` into `assets/fonts/` matching `Fonts` object values; Metro logs missing files.
   - **"`@/*` alias note"** — overrides `expo/tsconfig.base` default; resolves to `src/*`.
   - **"First-time dev-client build"** — `npx expo prebuild` → `yarn ios` / `yarn android`; iOS needs Xcode + CocoaPods; Android needs SDK.
   - **"Expo SDK compatibility"** — state which SDK this CLI release targets. Native dep versions inherited via `expo install`.
   - **"Bin name"** — note `bin` is `codingpixel-expo`. Invoke via `npx @codingpixel/create-expo-app` (package name) or `codingpixel-expo` (global install).
2. Add `LICENSE` (MIT).
3. **`prepublishOnly` audit chain** — guards against new mirrored files bypassing one-time template authoring audits.
   - **Create `scripts/audit-templates.sh`** consolidating the three grep audits. **v5-r4: standardized on `if pipeline; then fail; fi` form across all three audits** (matches Phase 4/5 style; both forms are `set -e` safe but a single style is easier to audit). Fonts type-position pattern matches Phase 4 step 10 extension.
     ```bash
     #!/usr/bin/env bash
     set -euo pipefail

     # @/assets anchored with (/|["']) terminator (matches Phase 4/5 grep).
     PATTERNS='@/theme/|@/utils/|@/redux/|@/core/|@/services/|@/hooks/|@/appComponents/|@/components/|@/icons/|@/features/|@/assets(/|["'\''])'
     FONTS_TYPE_PATTERN=':\s*Fonts\b|<Fonts>|Fonts\s*\[|\bas\s+Fonts\b|Record<Fonts|\bextends\s+Fonts\b|\bimplements\s+Fonts\b'

     # 1) Phase 4 step 5 — MyRoster-prefix grep over templates/base/
     if find templates/base \( -name "*.ts" -o -name "*.tsx" \) -print0 \
        | xargs -0 grep -nE "from ['\"]($PATTERNS)"; then
       echo "FAIL: MyRoster prefix remains in templates/base"
       exit 1
     fi

     # 2) Phase 4 step 10 — Fonts type-position grep over templates/base/
     if find templates/base \( -name "*.ts" -o -name "*.tsx" \) -print0 \
        | xargs -0 grep -nE "$FONTS_TYPE_PATTERN"; then
       echo "FAIL: Fonts-as-type misuse in templates/base"
       exit 1
     fi

     # 3) Phase 5 step 0 — combined grep over conditional template dirs
     for DIR in templates/bottom-sheet templates/image-picker; do
       [ -d "$DIR" ] || continue
       if find "$DIR" \( -name "*.ts" -o -name "*.tsx" \) -print0 \
          | xargs -0 grep -nE "from ['\"]($PATTERNS)|$FONTS_TYPE_PATTERN"; then
         echo "FAIL: audit failed in $DIR"
         exit 1
       fi
     done

     echo "audit:templates OK"
     ```
   - `chmod +x scripts/audit-templates.sh`.
   - Wire into `package.json`. **v5-r5: switched to `npm run` (PM-agnostic).** npm and yarn both honor `package.json` scripts identically; using `npm run` removes the implicit "publisher must have yarn installed" requirement for `npm publish` workflows.
     ```json
     {
       "scripts": {
         "audit:templates": "bash scripts/audit-templates.sh",
         "prepublishOnly": "npm run build && npm run test && npm run audit:templates"
       }
     }
     ```
   - Exit non-zero if any audit fails. Blocks `npm publish` on stale audits.
4. Scoped publish: `npm publish --access public`.
5. Tag release: `git tag v0.1.0 && git push --tags`.

**Exit criterion:** `npx @codingpixel/create-expo-app new-project` works from anywhere.

---

## Risks + mitigations

| Risk | Mitigation |
|------|------------|
| `create-expo-app` flags change | Pin to major; smoke-test per SDK bump. |
| Mirrored App* components reference MyRoster-specific paths | Phase 4 `rewriteImports` + Phase 4 step 5 grep verification; Phase 5 step 0 audits conditional templates. |
| MyRoster source uses unknown/unmapped alias prefix | Phase 4 step 5 + Phase 5 step 0 grep catch remainders; abort + manual fix. |
| Font file expectations create silent runtime failures | README documents `.ttf` drop convention; Metro logs missing files. |
| Patches collide with future `create-expo-app` template changes | JSON manipulation for `package.json`/`tsconfig`/`app.json`; babel parsed as AST. Diff upstream per Expo upgrade. |
| Scoped publish needs `--access public` | Baked into `prepublishOnly` + `CONTRIBUTING.md`. |
| `babel-preset-expo` stops auto-including worklets/reanimated plugin | Phase 0 verification; Phase 7 step 4 fallback branch appends plugin manually. |
| `react-native-worklets` package name wrong (`-core` variant) | Phase 0 step 10 confirms via `expo install` probe. |
| `expo-router` changes `src/app/` auto-detection | Doc target SDK per CLI version; fallback custom entry if broken. |
| Stale global `create-expo-app` overriding `npx ...@latest` | `npx --yes` forces fresh fetch. |
| `expo install` offline / version-resolution fails | Phase 7 step 2 classifies stderr. Transient markers (`ETIMEDOUT`, `ECONNRESET`, `ENOTFOUND`, network, 5xx) abort immediately with retry hint — no per-dep retry (would multiply registry hits during outage). Deterministic errors (version-not-found, peer-conflict) invoke `retryWithIsolation`: bounded loop ≤ `deps.length` iterations, `parseFailingDep` regex extracts culprit from stderr, twice-fail terminates with verbatim Expo stderr. Unparseable stderr → throw immediately (no retry). |
| Patch throws mid-phase, target dir left inconsistent | Phase 7 "Cross-cutting — Partial-failure handling" subsection — idempotent rerun (A) converges on rerun; recovery hint (B) tells user to `rm -rf <path>` or fix root cause; never auto-delete. |
| Babel AST merge breaks if upstream switches to `babel.config.ts` | Phase 7 step 4 file-extension detection: if `babel.config.ts`, `.cjs`, or `.mjs` present AND `babel.config.js` absent → abort with `"manual babel config (non-.js) not yet supported"`. Phase 0 Probe 2 confirms default `.js` form per SDK. |
| `$(PRODUCT_NAME)` macro Android renders verbatim (cosmetic) | README section calls this out + shows raw-string alternative. |
| `expo install --yarn`/`--npm` flag absent in installed Expo CLI | Phase 0 Probe 5 sets `FLAGS_OK`; Phase 7 step 2 Branch B pre-seeds lockfile (yarn: empty file via `: > yarn.lock`; npm: minimal valid `lockfileVersion: 3` JSON, with `npm install --package-lock-only --no-audit` fallback per Phase 0 `NPM_SEED_OK`). |
| User has both yarn + npm but wants specific one | `EXPO_PACKAGE_MANAGER` env var override (Phase 2). |
| `baseUrl` already set by user-modified tsconfig | Phase 7 step 3 3-tier resolution: user-set → preserve; `expo/tsconfig.base` provides → no-op (inherited); both absent → set `baseUrl: '.'`. |

---

## Definition of done (v1 ship)

- All 10 phases complete.
- Unit + smoke tests green in CI (Node 18 + 20).
- Generated project boots via `yarn ios` / `yarn android` (or `npm run`) after `npx expo prebuild`.
- Single lockfile per generated project.
- Zero `@@[A-Z_]+@@` sentinel residue in generated project sources (excluding `node_modules`) per Phase 6 step 5.
- Zero MyRoster-specific prefixes (`@/theme/`, `@/utils/`, etc.) remain in mirrored sources. (Bare `@/<anything>` allowed — catchall alias.)
- Published to npm under `@codingpixel/create-expo-app`.
- Slash command + README sections shipped.

---

## SPEC.md consistency

SPEC.md aligned with V5 + v5-r4 + v5-r5 + v5-r6 decisions:

- V4 baseline: fonts object literal, root `assets/` path, `EXPO_PACKAGE_MANAGER` env var, single-lockfile invariant, prebuild smoke flow, `@@TOKEN@@` sentinel naming, bin rename to `codingpixel-expo`, dropped `SafeAreaInsetsProvider`.
- v5-r4 SPEC edits: §9 `@assets` alias target corrected from `src/assets` → `assets` (project root, matches §5.2 + §6); §13 lockfile invariant documents Branch A (`--yarn`/`--npm` flag path) + Branch B (pre-seed lockfile path).
- v5-r6: no SPEC body changes required — all r6 fixes are internal to the plan (probe block hardening, regex tightening, dep pinning, ordering of env-var validation). SPEC §13 PM-mismatch behavior described loosely; PLAN_V5 Phase 8 step 1 spells out the loud-warning recovery hint added in r6.
- v5-r5 PLAN edits are PLAN-only — no SPEC changes required.
