import { describe, it, expect } from "vitest";
import {
  generateFontsEnumFile,
  generateUseFontsBlocks,
  buildLayoutReplacements,
} from "../src/fonts.js";

describe("generateFontsEnumFile", () => {
  it("emits header + enum with primary variants", () => {
    const out = generateFontsEnumFile(
      {
        displayName: "Inter",
        fileBase: "Inter",
        variants: [
          { google: "regular", enumKey: "REGULAR", suffix: "-Regular" },
          { google: "700", enumKey: "BOLD", suffix: "-Bold" },
        ],
      },
      null,
    );
    expect(out).toContain("export enum Fonts {");
    expect(out).toContain('REGULAR = "Inter-Regular",');
    expect(out).toContain('BOLD = "Inter-Bold",');
    expect(out).toContain("Primary: Inter (2 variants)");
  });

  it("prefixes secondary keys with uppercased family name", () => {
    const out = generateFontsEnumFile(
      {
        displayName: "Inter",
        fileBase: "Inter",
        variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }],
      },
      {
        displayName: "Sansita",
        fileBase: "Sansita",
        variants: [
          { google: "regular", enumKey: "REGULAR", suffix: "-Regular" },
          { google: "700", enumKey: "BOLD", suffix: "-Bold" },
        ],
      },
    );
    expect(out).toContain('SANSITA_REGULAR = "Sansita-Regular",');
    expect(out).toContain('SANSITA_BOLD = "Sansita-Bold",');
  });

  it("strips spaces in family for secondary prefix (Open Sans -> OPEN_SANS)", () => {
    const out = generateFontsEnumFile(
      {
        displayName: "Inter",
        fileBase: "Inter",
        variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }],
      },
      {
        displayName: "Open Sans",
        fileBase: "OpenSans",
        variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }],
      },
    );
    expect(out).toContain('OPEN_SANS_REGULAR = "OpenSans-Regular",');
  });

  it("throws when secondary set but primary null (P3 defensive)", () => {
    expect(() =>
      generateFontsEnumFile(null, {
        displayName: "X",
        fileBase: "X",
        variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }],
      }),
    ).toThrow(/primary/i);
  });

  it("emits empty enum when both primary and secondary null", () => {
    const out = generateFontsEnumFile(null, null);
    expect(out).toContain("export enum Fonts {}");
    expect(out).not.toContain("REGULAR");
  });
});

describe("generateUseFontsBlocks", () => {
  it("returns marker-block content when primary set without splash", () => {
    const out = generateUseFontsBlocks(
      {
        displayName: "Inter",
        fileBase: "Inter",
        variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }],
      },
      null,
      false,
    );
    expect(out.importBlock).toContain('import { useFonts } from "expo-font";');
    expect(out.hookBlock).toContain("// codingpixel:fonts-start");
    expect(out.hookBlock).toContain("const [fontsLoaded, fontError] = useFonts({");
    expect(out.hookBlock).toContain("// codingpixel:fonts-end");
    expect(out.hookBlock).not.toContain("useEffect");
    expect(out.guardBlock).toBe("");
  });

  it("includes useEffect block when hasSplashScreen=true", () => {
    const out = generateUseFontsBlocks(
      {
        displayName: "Inter",
        fileBase: "Inter",
        variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }],
      },
      null,
      true,
    );
    expect(out.importBlock).toContain('import { useFonts } from "expo-font";');
    expect(out.importBlock).toContain('import { useEffect } from "react";');
    expect(out.hookBlock).toContain("SplashScreen.hideAsync()");
    expect(out.hookBlock).toContain("[fontsLoaded, fontError]");
  });

  it("returns empty strings when primary null", () => {
    const out = generateUseFontsBlocks(null, null, false);
    expect(out).toEqual({ importBlock: "", hookBlock: "", guardBlock: "" });
  });

  it("includes secondary font require() entries in hook", () => {
    const out = generateUseFontsBlocks(
      {
        displayName: "Inter",
        fileBase: "Inter",
        variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }],
      },
      {
        displayName: "Sansita",
        fileBase: "Sansita",
        variants: [
          { google: "regular", enumKey: "REGULAR", suffix: "-Regular" },
          { google: "700", enumKey: "BOLD", suffix: "-Bold" },
        ],
      },
      false,
    );
    expect(out.hookBlock).toContain("Inter-Regular");
    expect(out.hookBlock).toContain("Sansita-Regular");
    expect(out.hookBlock).toContain("Sansita-Bold");
  });
});

describe("buildLayoutReplacements", () => {
  it("plumbs primary/secondary/hasSplashScreen into sentinel map", () => {
    const answers = { primaryFont: "Inter", secondaryFont: "", bottomSheet: false, imagePicker: false, packageManager: "npm" as const };
    const out = buildLayoutReplacements(
      answers,
      { displayName: "Inter", fileBase: "Inter", variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }] },
      null,
      false,
    );
    expect(out.USE_FONTS_IMPORT).toContain("useFonts");
    expect(out.USE_FONTS_HOOK).toContain("codingpixel:fonts-start");
    expect(out.USE_FONTS_GUARD).toBe("");
  });

  it("hasSplashScreen=true emits SplashScreen.hideAsync in marker block", () => {
    const answers = { primaryFont: "Inter", secondaryFont: "", bottomSheet: false, imagePicker: false, packageManager: "npm" as const };
    const out = buildLayoutReplacements(
      answers,
      { displayName: "Inter", fileBase: "Inter", variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }] },
      null,
      true,
    );
    expect(out.USE_FONTS_HOOK).toContain("SplashScreen.hideAsync");
    expect(out.USE_FONTS_HOOK).toContain("codingpixel:fonts-start");
    expect(out.USE_FONTS_IMPORT).toContain("useEffect");
  });

  it("no primary → all font sentinel values empty, bottom-sheet keys still populated", () => {
    const answers = { primaryFont: "", secondaryFont: "", bottomSheet: true, imagePicker: false, packageManager: "npm" as const };
    const out = buildLayoutReplacements(answers, null, null, false);
    expect(out.USE_FONTS_IMPORT).toBe("");
    expect(out.USE_FONTS_HOOK).toBe("");
    expect(out.BOTTOM_SHEET_PROVIDER_IMPORT).toContain("BottomSheetModalProvider");
  });
});
