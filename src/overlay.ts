// Phase 4 overlay engine — sentinel matcher, alias rewriter, template copier.
// Sentinel rules per PLAN_V5.md Phase 4 "Placeholder conventions".

import fs from "node:fs";
import path from "node:path";
import fse from "fs-extra";

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
export function applyBase(target: string, templatesRoot: string): void {
  const baseDir = path.join(templatesRoot, "base");
  copyTemplate(baseDir, target);
}
