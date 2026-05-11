// Phase 6 generators. All return strings to be spliced into sentinel positions.
// Decision-locked: fonts type is object literal `as const` + `FontKey`
// (NOT TS `enum` — Babel-unsafe under Hermes).

import type { Answers } from "./prompts.js";

/**
 * Build the `Fonts` object literal + `FontKey` type. Family naming convention:
 *   - `<FontName>-Regular` (always)
 *   - `<FontName>-Medium`, `-SemiBold`, `-Bold` (always)
 *   - if `secondary` non-empty: also `<SecondaryName>-Regular`, etc. as
 *     `SECONDARY_REGULAR`, `SECONDARY_MEDIUM`, `SECONDARY_SEMIBOLD`, `SECONDARY_BOLD`
 *
 * Empty `primary` → `Fonts = {}` + `FontKey = never` (apps using `Fonts.X` will
 * fail to typecheck; intended — user opted out).
 */
export function generateFontsObject(primary: string, secondary: string): string {
  const out: string[] = [];
  out.push("export const Fonts = {");
  if (primary) {
    out.push(`  REGULAR: "${primary}-Regular",`);
    out.push(`  MEDIUM: "${primary}-Medium",`);
    out.push(`  SEMIBOLD: "${primary}-SemiBold",`);
    out.push(`  BOLD: "${primary}-Bold",`);
  }
  if (secondary) {
    out.push(`  SECONDARY_REGULAR: "${secondary}-Regular",`);
    out.push(`  SECONDARY_MEDIUM: "${secondary}-Medium",`);
    out.push(`  SECONDARY_SEMIBOLD: "${secondary}-SemiBold",`);
    out.push(`  SECONDARY_BOLD: "${secondary}-Bold",`);
  }
  out.push("} as const;");
  out.push("");
  out.push("export type FontKey = keyof typeof Fonts;");
  return out.join("\n");
}

/**
 * Build the three pieces inserted into `_layout.tsx`:
 *   - import line(s) for `useFonts` + the asset .ttf require()s
 *   - the `useFonts(...)` hook call (must be inside the component body)
 *   - the `if (!loaded) return null;` guard (also inside component body, after
 *     the hook so React's rules-of-hooks stay satisfied)
 *
 * Empty `primary` → all three return empty strings → sentinel lines drop.
 */
export function generateUseFontsBlocks(
  primary: string,
  secondary: string,
): { importBlock: string; hookBlock: string; guardBlock: string } {
  if (!primary) {
    return { importBlock: "", hookBlock: "", guardBlock: "" };
  }
  const fontPairs: Array<[string, string]> = [
    [`${primary}-Regular`, `${primary}-Regular.ttf`],
    [`${primary}-Medium`, `${primary}-Medium.ttf`],
    [`${primary}-SemiBold`, `${primary}-SemiBold.ttf`],
    [`${primary}-Bold`, `${primary}-Bold.ttf`],
  ];
  if (secondary) {
    fontPairs.push(
      [`${secondary}-Regular`, `${secondary}-Regular.ttf`],
      [`${secondary}-Medium`, `${secondary}-Medium.ttf`],
      [`${secondary}-SemiBold`, `${secondary}-SemiBold.ttf`],
      [`${secondary}-Bold`, `${secondary}-Bold.ttf`],
    );
  }
  const importBlock = `import { useFonts } from "expo-font";`;
  const mapEntries = fontPairs
    .map(([key, file]) => `    "${key}": require("../../assets/fonts/${file}"),`)
    .join("\n");
  const hookBlock = `  const [loaded] = useFonts({\n${mapEntries}\n  });`;
  const guardBlock = `  if (!loaded) return null;`;
  return { importBlock, hookBlock, guardBlock };
}

/**
 * Build the three pieces wrapping the routing tree with `BottomSheetModalProvider`:
 *   - import line for `BottomSheetModalProvider`
 *   - opening JSX
 *   - closing JSX
 *
 * `bottomSheet === false` → all three empty → sentinel lines drop.
 */
export function generateBottomSheetProviderBlocks(
  bottomSheet: boolean,
): { importBlock: string; openBlock: string; closeBlock: string } {
  if (!bottomSheet) {
    return { importBlock: "", openBlock: "", closeBlock: "" };
  }
  return {
    importBlock: `import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";`,
    openBlock: `                <BottomSheetModalProvider>`,
    closeBlock: `                </BottomSheetModalProvider>`,
  };
}

/**
 * Convenience: build the full sentinel-replacement map for `patchLayout`.
 * Note: `fonts.ts` ships as a static enum file (Deviation #10) — no
 * `FONTS_OBJECT` sentinel is patched. The 6 `_layout.tsx` sentinels still get
 * filled (or empty-dropped per `gatherAnswers`).
 */
export function buildLayoutReplacements(answers: Answers): Record<string, string> {
  const fonts = generateUseFontsBlocks(answers.primaryFont, answers.secondaryFont);
  const bs = generateBottomSheetProviderBlocks(answers.bottomSheet);
  return {
    USE_FONTS_IMPORT: fonts.importBlock,
    USE_FONTS_HOOK: fonts.hookBlock,
    USE_FONTS_GUARD: fonts.guardBlock,
    BOTTOM_SHEET_PROVIDER_IMPORT: bs.importBlock,
    BOTTOM_SHEET_PROVIDER_OPEN: bs.openBlock,
    BOTTOM_SHEET_PROVIDER_CLOSE: bs.closeBlock,
  };
}
