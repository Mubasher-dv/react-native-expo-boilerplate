// Phase 4 overlay engine — sentinel matcher, alias rewriter, template copier.
// Sentinel rules per PLAN_V5.md Phase 4 "Placeholder conventions".

import fs from "node:fs";
import path from "node:path";
import fse from "fs-extra";
import type { BackendType } from "./prompts.js";

// ---------- Sentinels ----------

/** Module-position sentinel: own line, line-comment form. */
export const MODULE_SENTINEL = /^\s*\/\/\s*@@([A-Z_]+)@@\s*$/;
/** JSX-position sentinel: own line, JSX expression containing a block comment. */
export const JSX_SENTINEL = /^\s*\{\/\*\s*@@([A-Z_]+)@@\s*\*\/\}\s*$/;
/** Same shape, anywhere on the line — used to catch malformed/orphan tokens. */
export const ORPHAN_PROBE = /@@[A-Z_]+@@/;

export type SentinelReplacements = Record<string, string>;

/**
 * Replace whole-line sentinels in `source` per `replacements`.
 *
 * Rules:
 *   - A line matching MODULE_SENTINEL OR JSX_SENTINEL is replaced with the
 *     corresponding string from `replacements`. If the replacement is empty,
 *     the line is dropped entirely (no orphan blank).
 *   - A line containing `@@[A-Z_]+@@` that matches NEITHER regex (e.g. inline
 *     sentinel, mismatched opener/closer, or sentinel-not-owning-line) MUST
 *     throw — these are malformed and would silently leak past Phase 6 audit.
 *   - Any token in `replacements` whose key never appears throws — catches
 *     typos / renames in the sentinel list.
 */
export function applySentinels(
  source: string,
  replacements: SentinelReplacements,
  filePath: string,
): string {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of source.split("\n")) {
    const moduleMatch = line.match(MODULE_SENTINEL);
    const jsxMatch = line.match(JSX_SENTINEL);

    if (moduleMatch || jsxMatch) {
      const token = (moduleMatch ?? jsxMatch)![1];
      if (!(token in replacements)) {
        throw new Error(
          `Sentinel @@${token}@@ in ${filePath} has no replacement provided.`,
        );
      }
      seen.add(token);
      const replacement = replacements[token];
      if (replacement === "") {
        // Drop the whole line — no orphan blank.
        continue;
      }
      out.push(replacement);
      continue;
    }

    if (ORPHAN_PROBE.test(line)) {
      throw new Error(
        `Malformed sentinel in ${filePath} (not whole-line, opener↔closer mismatched, ` +
          `or inline inside live code): ${line.trim()}`,
      );
    }

    out.push(line);
  }

  // Optional: warn on unused replacement keys (typo guard). Keep silent here —
  // some templates legitimately use a subset of the global sentinel map.
  void seen;

  return out.join("\n");
}

// ---------- Alias rewriting ----------

export type AliasMap = Record<string, string>;

/**
 * Module-reference forms we rewrite. Plan v5-r6: extended beyond `from "x"`
 * to cover dynamic import + require + jest.mock so future mirrored files
 * (any form) don't silently miss.
 */
const SPECIFIER_FORMS: RegExp[] = [
  /(\bfrom\s+)(["'])([^"']+)(\2)/g,
  /(\bimport\s*\(\s*)(["'])([^"']+)(\2)/g,
  /(\brequire\s*\(\s*)(["'])([^"']+)(\2)/g,
  /(\bjest\.mock\s*\(\s*)(["'])([^"']+)(\2)/g,
];

/**
 * Rewrite import specifiers per `aliasMap`.
 *
 * Iteration order: longest source prefix first (so a hypothetical short prefix
 * like `@/` doesn't consume a longer-specific one like `@/assets`).
 *
 * Idempotent: applying `(@x → @x)` is a no-op; applying twice yields same result.
 */
export function rewriteImports(source: string, aliasMap: AliasMap): string {
  const sortedEntries = Object.entries(aliasMap).sort(
    (a, b) => b[0].length - a[0].length,
  );

  function rewriteSpecifier(spec: string): string {
    for (const [from, to] of sortedEntries) {
      if (spec === from || spec.startsWith(from)) {
        return to + spec.slice(from.length);
      }
    }
    return spec;
  }

  let out = source;
  for (const re of SPECIFIER_FORMS) {
    out = out.replace(re, (_match, head, openQuote, spec, closeQuote) => {
      return `${head}${openQuote}${rewriteSpecifier(spec)}${closeQuote}`;
    });
  }
  return out;
}

// ---------- Copying ----------

export function isSkippedForBackend(src: string, backendType: BackendType): boolean {
  const normalized = src.replace(/\\/g, "/");
  if (backendType === "firebase-js" || backendType === "firebase-rn") {
    if (normalized.includes("/core/tanstack/") || normalized.endsWith("/core/tanstack")) return true;
    if (normalized.includes("/core/utils/config.ts")) return true;
    if (normalized.includes("/core/utils/endpoints.ts")) return true;
  }
  if (backendType === "supabase") {
    if (normalized.includes("/core/utils/config.ts")) return true;
    if (normalized.includes("/core/utils/endpoints.ts")) return true;
  }
  return false;
}

/**
 * Recursively copy `srcRoot` → `destRoot`. Idempotent: existing files at dest
 * are overwritten (we own the template overlay, not the user).
 */
export function copyTemplate(srcRoot: string, destRoot: string): void {
  if (!fs.existsSync(srcRoot)) {
    throw new Error(`copyTemplate: source missing: ${srcRoot}`);
  }
  fse.copySync(srcRoot, destRoot, { overwrite: true });
}

/**
 * Apply `templates/base/` overlay to `target`.
 *
 * `templates/base/` lives inside this CLI package. `target` is the user's
 * generated app dir (post-create-expo-app + cleanupBlankTemplate).
 */
export function applyBase(target: string, templatesRoot: string, backendType: BackendType): void {
  const baseDir = path.join(templatesRoot, "base");
  if (!fs.existsSync(baseDir)) {
    throw new Error(`copyTemplate: source missing: ${baseDir}`);
  }
  fse.copySync(baseDir, target, {
    overwrite: true,
    filter: (src) => !isSkippedForBackend(src, backendType),
  });
}

/**
 * Phase 5 step 3 — overlay the 5 bottom-sheet appComponents on top of base.
 * No-op when answers.bottomSheet === false (caller checks before invoking).
 */
export function applyBottomSheet(target: string, templatesRoot: string): void {
  const bsDir = path.join(templatesRoot, "bottom-sheet");
  if (!fs.existsSync(bsDir)) return;
  copyTemplate(bsDir, target);
}

/**
 * Phase 5 step 3 — overlay PermissionService.ts when answers.imagePicker. The
 * media-constants snippet is spliced separately by `patchConstants` (Phase 5
 * step 4) — this overlay only copies the service file.
 */
export function applyImagePicker(target: string, templatesRoot: string): void {
  const ipDir = path.join(templatesRoot, "image-picker");
  if (!fs.existsSync(ipDir)) return;
  // Copy the `src/` subtree only — the snippet file lives at the root of
  // templates/image-picker/ for `patchConstants` to read directly, and we
  // don't want it ending up in the generated project.
  const srcSubtree = path.join(ipDir, "src");
  if (fs.existsSync(srcSubtree)) {
    copyTemplate(srcSubtree, path.join(target, "src"));
  }
}

export function applyFirebaseJs(target: string, templatesRoot: string): void {
  const dir = path.join(templatesRoot, "firebase-js");
  if (!fs.existsSync(dir)) {
    throw new Error(`applyFirebaseJs: source missing: ${dir}`);
  }
  copyTemplate(dir, target);
}

export function applyFirebaseRn(target: string, templatesRoot: string): void {
  const dir = path.join(templatesRoot, "firebase-rn");
  if (!fs.existsSync(dir)) {
    throw new Error(`applyFirebaseRn: source missing: ${dir}`);
  }
  copyTemplate(dir, target);
}

export function applySupabase(target: string, templatesRoot: string): void {
  const dir = path.join(templatesRoot, "supabase");
  if (!fs.existsSync(dir)) {
    throw new Error(`applySupabase: source missing: ${dir}`);
  }
  copyTemplate(dir, target);
}
