import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildLayoutReplacements,
  generateBottomSheetProviderBlocks,
  generateFontsObject,
  generateUseFontsBlocks,
} from "../src/fonts.js";
import { patchLayout } from "../src/patch.js";
import type { Answers } from "../src/prompts.js";

describe("generateFontsObject", () => {
  it("primary only — emits 4 weights + FontKey type", () => {
    const out = generateFontsObject("Inter", "");
    expect(out).toContain('REGULAR: "Inter-Regular"');
    expect(out).toContain('BOLD: "Inter-Bold"');
    expect(out).toContain("FontKey = keyof typeof Fonts");
    expect(out).not.toContain("SECONDARY_");
  });

  it("primary + secondary — emits 8 weights", () => {
    const out = generateFontsObject("Inter", "Roboto");
    expect(out).toContain('SECONDARY_REGULAR: "Roboto-Regular"');
    expect(out).toContain('SECONDARY_BOLD: "Roboto-Bold"');
  });

  it("empty primary — emits empty Fonts + FontKey = never", () => {
    const out = generateFontsObject("", "");
    expect(out).toMatch(/Fonts = \{\s*\} as const;/);
    expect(out).toContain("FontKey = keyof typeof Fonts");
  });

  it("uses object literal `as const` (NOT TS enum)", () => {
    const out = generateFontsObject("Inter", "");
    expect(out).not.toMatch(/\benum\b/);
    expect(out).toContain("as const");
  });
});

describe("generateUseFontsBlocks", () => {
  it("empty primary — all 3 blocks empty", () => {
    const r = generateUseFontsBlocks("", "");
    expect(r).toEqual({ importBlock: "", hookBlock: "", guardBlock: "" });
  });

  it("primary only — 4 require()s in hook", () => {
    const r = generateUseFontsBlocks("Inter", "");
    expect(r.importBlock).toContain('useFonts');
    expect(r.hookBlock.match(/require\(/g)?.length).toBe(4);
    expect(r.guardBlock).toContain("if (!loaded) return null;");
  });

  it("primary + secondary — 8 require()s", () => {
    const r = generateUseFontsBlocks("Inter", "Roboto");
    expect(r.hookBlock.match(/require\(/g)?.length).toBe(8);
  });

  it("require paths point at ../../assets/fonts/", () => {
    const r = generateUseFontsBlocks("Inter", "");
    expect(r.hookBlock).toContain('"../../assets/fonts/Inter-Regular.ttf"');
  });
});

describe("generateBottomSheetProviderBlocks", () => {
  it("false — empty triple", () => {
    expect(generateBottomSheetProviderBlocks(false)).toEqual({
      importBlock: "",
      openBlock: "",
      closeBlock: "",
    });
  });

  it("true — open + close balanced", () => {
    const r = generateBottomSheetProviderBlocks(true);
    expect(r.importBlock).toContain("BottomSheetModalProvider");
    expect(r.openBlock).toContain("<BottomSheetModalProvider>");
    expect(r.closeBlock).toContain("</BottomSheetModalProvider>");
  });
});

// ---------- patchLayout end-to-end ----------

let target: string;

beforeEach(() => {
  target = fs.mkdtempSync(path.join(os.tmpdir(), "cpx-fonts-"));
  fs.mkdirSync(path.join(target, "src/app"), { recursive: true });
  fs.mkdirSync(path.join(target, "src/ui/theme"), { recursive: true });

  // Seed sentinel-bearing skeletons (subset of Phase 4 step 1+2 templates).
  fs.writeFileSync(
    path.join(target, "src/app/_layout.tsx"),
    [
      `import React from "react";`,
      `// @@USE_FONTS_IMPORT@@`,
      `// @@BOTTOM_SHEET_PROVIDER_IMPORT@@`,
      ``,
      `export default function RootLayout() {`,
      `  // @@USE_FONTS_HOOK@@`,
      `  // @@USE_FONTS_GUARD@@`,
      `  return (`,
      `    <View>`,
      `      {/* @@BOTTOM_SHEET_PROVIDER_OPEN@@ */}`,
      `        <Routes />`,
      `      {/* @@BOTTOM_SHEET_PROVIDER_CLOSE@@ */}`,
      `    </View>`,
      `  );`,
      `}`,
      ``,
    ].join("\n"),
  );

  fs.writeFileSync(
    path.join(target, "src/ui/theme/fonts.ts"),
    "// header\n// @@FONTS_OBJECT@@\n",
  );
});

afterEach(() => {
  fs.rmSync(target, { recursive: true, force: true });
});

const A: Answers = {
  primaryFont: "",
  secondaryFont: "",
  bottomSheet: false,
  imagePicker: false,
  packageManager: "yarn",
};

describe("patchLayout end-to-end", () => {
  it("no fonts + no bottom-sheet → all sentinel lines dropped, zero residue", () => {
    patchLayout(target, buildLayoutReplacements(A));
    const layout = fs.readFileSync(
      path.join(target, "src/app/_layout.tsx"),
      "utf8",
    );
    const fonts = fs.readFileSync(
      path.join(target, "src/ui/theme/fonts.ts"),
      "utf8",
    );
    expect(layout).not.toMatch(/@@[A-Z_]+@@/);
    expect(fonts).not.toMatch(/@@[A-Z_]+@@/);
    // Bottom-sheet provider should be gone, not present as opening tag.
    expect(layout).not.toContain("BottomSheetModalProvider");
    expect(fonts).toMatch(/Fonts = \{\s*\} as const;/);
  });

  it("primary font + bottom-sheet → injected blocks present, zero residue", () => {
    patchLayout(
      target,
      buildLayoutReplacements({
        ...A,
        primaryFont: "Inter",
        secondaryFont: "Roboto",
        bottomSheet: true,
      }),
    );
    const layout = fs.readFileSync(
      path.join(target, "src/app/_layout.tsx"),
      "utf8",
    );
    const fonts = fs.readFileSync(
      path.join(target, "src/ui/theme/fonts.ts"),
      "utf8",
    );
    expect(layout).not.toMatch(/@@[A-Z_]+@@/);
    expect(fonts).not.toMatch(/@@[A-Z_]+@@/);
    expect(layout).toContain("useFonts");
    expect(layout).toContain("if (!loaded) return null;");
    expect(layout).toContain("<BottomSheetModalProvider>");
    expect(layout).toContain("</BottomSheetModalProvider>");
    expect(fonts).toContain('SECONDARY_BOLD: "Roboto-Bold"');
  });
});
