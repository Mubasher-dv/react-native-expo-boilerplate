# Backend Selection Design

**Date:** 2026-05-13  
**Status:** Approved  

## Overview

Add a backend-type prompt to the scaffold CLI so users choose their backend during project creation. The choice gates which packages are installed and which template files are copied. Three backend types: `firebase`, `supabase`, `custom-backend`.

## Prompt Flow

```
? What backend type?
  ❯ firebase
    supabase
    custom-backend
```

If `firebase` selected:

```
? Firebase SDK:
  ❯ Firebase JS SDK (Expo Go compatible)
    React Native Firebase (requires dev client)
```

These two prompts collapse into a single `backendType` field on `Answers`:

```typescript
backendType: "firebase-js" | "firebase-rn" | "supabase" | "custom-backend"
```

CI env var: `EXPO_BACKEND_TYPE` — validated same as existing `EXPO_INCLUDE_BOTTOM_SHEET`.  
Validated values: `firebase-js`, `firebase-rn`, `supabase`, `custom-backend`.

## Architecture: Approach

**File-skip + new overlay dirs.** Keep `templates/base/` unchanged. Pass `backendType` into `applyBase()` to skip backend-specific files via `fse.copySync`'s `filter` callback:

```typescript
fse.copySync(baseDir, target, {
  overwrite: true,
  filter: (src) => !isSkippedForBackend(src, backendType),
});
```

Add `applyFirebaseJs()`, `applyFirebaseRn()`, `applySupabase()` overlay functions that copy new template directories on top. This mirrors the existing `applyBottomSheet()` / `applyImagePicker()` pattern.

## Template Structure

```
templates/
├── base/                          # unchanged — always applied (with skips per backend)
├── firebase-js/
│   └── src/core/firebase/
│       └── index.ts               # Firebase JS SDK: app init, auth, firestore, storage
├── firebase-rn/
│   └── src/core/firebase/
│       └── index.ts               # React Native Firebase: app, auth, firestore, storage
└── supabase/
    └── src/core/supabase/
        └── index.ts               # supabaseClient + MMKV session storage adapter
```

## File Skip Logic in `applyBase()`

| File / Dir | firebase-js | firebase-rn | supabase | custom-backend |
|---|---|---|---|---|
| `core/tanstack/` | skip | skip | keep | keep |
| `core/utils/config.ts` | skip | skip | skip | keep |
| `core/utils/endpoints.ts` | skip | skip | skip | keep |

All other base files (Redux, UI components, routing, hooks, utils) kept for all backends.

## Layout TanStack Sentinels

`templates/base/src/app/_layout.tsx` gains three new sentinels:

```tsx
// @@TANSTACK_PROVIDER_IMPORT@@

// in JSX:
{/* @@TANSTACK_PROVIDER_OPEN@@ */}
  {children}
{/* @@TANSTACK_PROVIDER_CLOSE@@ */}
```

**Firebase (js/rn):** `importBlock`/`openBlock`/`closeBlock` return `""` — `applySentinels` drops the entire sentinel line when the replacement value is empty (no blank line left behind; the line is fully removed).  
**Supabase + custom-backend:** sentinels replaced with the real import and JSX tags.

`patchLayout` calls `applySentinels`, which matches these exact sentinel forms in the file:

| Sentinel key | Form in `_layout.tsx` |
|---|---|
| `TANSTACK_PROVIDER_IMPORT` | `// @@TANSTACK_PROVIDER_IMPORT@@` |
| `TANSTACK_PROVIDER_OPEN` | `{/* @@TANSTACK_PROVIDER_OPEN@@ */}` |
| `TANSTACK_PROVIDER_CLOSE` | `{/* @@TANSTACK_PROVIDER_CLOSE@@ */}` |

This is handled in `buildLayoutReplacements()` in `src/fonts.ts` using the existing sentinel replacement system.

## Packages Per Backend

| Package | firebase-js | firebase-rn | supabase | custom-backend |
|---|---|---|---|---|
| `@tanstack/react-query` | ❌ | ❌ | ✅ | ✅ |
| `axios` | ❌ | ❌ | ❌ | ✅ |
| `firebase` | ✅ | ❌ | ❌ | ❌ |
| `@react-native-firebase/app` | ❌ | ✅ | ❌ | ❌ |
| `@react-native-firebase/auth` | ❌ | ✅ | ❌ | ❌ |
| `@react-native-firebase/firestore` | ❌ | ✅ | ❌ | ❌ |
| `@react-native-firebase/storage` | ❌ | ✅ | ❌ | ❌ |
| `@supabase/supabase-js` | ❌ | ❌ | ✅ | ❌ |

All other always-installed packages (Redux, Reanimated, Router, MMKV, etc.) unchanged.

## Redux userSlice Patch

For `firebase-js` and `firebase-rn`: patch `src/core/redux/slices/userSlice.ts` to remove `accessToken: string | null` field and its initial value. Firebase manages auth state itself via `onAuthStateChanged`. Done via string replacement in the patch step — no separate template file.

## Template File Contents

### `templates/firebase-js/src/core/firebase/index.ts`

```typescript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

### `templates/firebase-rn/src/core/firebase/index.ts`

```typescript
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

export { auth, firestore, storage };
```

### `templates/supabase/src/core/supabase/index.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { MMKV } from "react-native-mmkv";

const storage = new MMKV({ id: "supabase-auth" });

const mmkvStorageAdapter = {
  setItem: (key: string, value: string) => storage.set(key, value),
  getItem: (key: string) => storage.getString(key) ?? null,
  removeItem: (key: string) => storage.delete(key),
};

const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: mmkvStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

## CLI Source Changes

| File | Change |
|---|---|
| `src/prompts.ts` | Add backend prompt + Firebase sub-prompt + env var validation + `backendType` in `Answers` |
| `src/install.ts` | Branch package list on `backendType` |
| `src/overlay.ts` | Add `applyFirebaseJs()`, `applyFirebaseRn()`, `applySupabase()`; add skip logic in `applyBase()` |
| `src/patch.ts` | Patch `userSlice.ts` for Firebase (`accessToken` removal) |
| `src/fonts.ts` | Add `backendType` param to `buildLayoutReplacements()`; add `TANSTACK_PROVIDER_IMPORT/OPEN/CLOSE` sentinel values |
| `src/index.ts` | Call new overlay functions in Phase 5; pass `backendType` through pipeline |
| `templates/base/src/app/_layout.tsx` | Add three TanStack sentinels |

## Edge Cases

**firebase-rn:**
- `expo-dev-client` already always-installed — no change needed.
- `app.json` needs `@react-native-firebase/app` plugin — add condition in `patchAppJsonPlugins()`.
- Print post-scaffold warning: "React Native Firebase requires a dev client — Expo Go not supported."

**`tanstack-keys.ts`:**
- Lives inside `core/tanstack/` — skipped automatically when that dir is skipped.

**`core/utils/validation.ts` + `core/utils/types.ts`:**
- Not backend-specific — kept for all backends.

**`EXPO_BACKEND_TYPE` default:**
- If not provided and no interactive prompt, default to `custom-backend` to preserve existing behavior.

**`@core/firebase` path alias:**
- Base tsconfig maps `"@core/*"` → `["src/core/*"]` (wildcard). The firebase overlay places files at `src/core/firebase/index.ts` — `@core/firebase` resolves automatically. No tsconfig patch needed.
- Verify before implementation: confirm base tsconfig has a wildcard `@core/*` alias, not only named per-directory aliases.

**Cross-imports from `@core/tanstack`:**
- Risk: if any non-tanstack base file imports from `@core/tanstack`, firebase scaffolds will fail TypeScript compilation (`core/tanstack/` is skipped and absent in the output).
- Verify before shipping: `grep -r "@core/tanstack" templates/base/src --include="*.ts" --include="*.tsx" | grep -v "core/tanstack/"` must return no results.

## README

Update `README.md` after implementation to document the new `--backend` prompt and `EXPO_BACKEND_TYPE` env var.
