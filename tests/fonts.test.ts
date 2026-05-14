import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildLayoutReplacements,
  generateBackendInitImport,
  generateBottomSheetProviderBlocks,
  generateTanStackProviderBlocks,
} from "../src/fonts.js";
import { patchLayout } from "../src/patch.js";
import type { Answers } from "../src/prompts.js";

// generateFontsObject was removed in the new font recipe implementation.
// New API: generateFontsEnumFile(InstalledFamily|null, InstalledFamily|null)
// See tests/fonts.generator.test.ts for full coverage of the new API.

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

describe("generateTanStackProviderBlocks", () => {
  it("firebase-js → all empty (TanStack not used)", () => {
    expect(generateTanStackProviderBlocks("firebase-js")).toEqual({
      importBlock: "",
      openBlock: "",
      closeBlock: "",
    });
  });

  it("firebase-rn → all empty (TanStack not used)", () => {
    expect(generateTanStackProviderBlocks("firebase-rn")).toEqual({
      importBlock: "",
      openBlock: "",
      closeBlock: "",
    });
  });

  it("supabase → import + open + close", () => {
    const r = generateTanStackProviderBlocks("supabase");
    expect(r.importBlock).toContain("TanStackQueryProvider");
    expect(r.openBlock).toContain("<TanStackQueryProvider>");
    expect(r.closeBlock).toContain("</TanStackQueryProvider>");
  });

  it("custom-backend → import + open + close", () => {
    const r = generateTanStackProviderBlocks("custom-backend");
    expect(r.importBlock).toContain("TanStackQueryProvider");
    expect(r.openBlock).toContain("<TanStackQueryProvider>");
    expect(r.closeBlock).toContain("</TanStackQueryProvider>");
  });
});

describe("generateBackendInitImport", () => {
  it("firebase-js → side-effect import for @core/firebase", () => {
    expect(generateBackendInitImport("firebase-js")).toContain("@core/firebase");
  });
  it("firebase-rn → empty (auto-inits natively)", () => {
    expect(generateBackendInitImport("firebase-rn")).toBe("");
  });
  it("supabase → side-effect import for @core/supabase", () => {
    expect(generateBackendInitImport("supabase")).toContain("@core/supabase");
  });
  it("custom-backend → empty", () => {
    expect(generateBackendInitImport("custom-backend")).toBe("");
  });
});

describe("buildLayoutReplacements — TanStack sentinel keys present", () => {
  it("custom-backend → map contains TANSTACK_PROVIDER_* keys with content", () => {
    const map = buildLayoutReplacements(
      { ...A, backendType: "custom-backend" },
      null,
      null,
      false,
    );
    expect(map).toHaveProperty("TANSTACK_PROVIDER_IMPORT");
    expect(map).toHaveProperty("TANSTACK_PROVIDER_OPEN");
    expect(map).toHaveProperty("TANSTACK_PROVIDER_CLOSE");
    expect(map.TANSTACK_PROVIDER_IMPORT).toContain("TanStackQueryProvider");
  });

  it("firebase-js → map contains TANSTACK_PROVIDER_* keys as empty strings", () => {
    const map = buildLayoutReplacements(
      { ...A, backendType: "firebase-js" },
      null,
      null,
      false,
    );
    expect(map.TANSTACK_PROVIDER_IMPORT).toBe("");
    expect(map.TANSTACK_PROVIDER_OPEN).toBe("");
    expect(map.TANSTACK_PROVIDER_CLOSE).toBe("");
  });

  it("firebase-js → BACKEND_INIT_IMPORT contains @core/firebase", () => {
    const map = buildLayoutReplacements(
      { ...A, backendType: "firebase-js" },
      null,
      null,
      false,
    );
    expect(map.BACKEND_INIT_IMPORT).toContain("@core/firebase");
  });

  it("supabase → BACKEND_INIT_IMPORT contains @core/supabase", () => {
    const map = buildLayoutReplacements(
      { ...A, backendType: "supabase" },
      null,
      null,
      false,
    );
    expect(map.BACKEND_INIT_IMPORT).toContain("@core/supabase");
  });

  it("custom-backend → BACKEND_INIT_IMPORT is empty", () => {
    const map = buildLayoutReplacements(
      { ...A, backendType: "custom-backend" },
      null,
      null,
      false,
    );
    expect(map.BACKEND_INIT_IMPORT).toBe("");
  });
});

// ---------- patchLayout end-to-end ----------

let target: string;

beforeEach(() => {
  target = fs.mkdtempSync(path.join(os.tmpdir(), "rneb-fonts-"));
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
  backendType: "custom-backend",
};

describe("patchLayout end-to-end", () => {
  it("no fonts + no bottom-sheet → all sentinel lines dropped, zero residue", () => {
    patchLayout(target, buildLayoutReplacements(A, null, null, false));
    const layout = fs.readFileSync(
      path.join(target, "src/app/_layout.tsx"),
      "utf8",
    );
    expect(layout).not.toMatch(/@@[A-Z_]+@@/);
    expect(layout).not.toContain("BottomSheetModalProvider");
    expect(layout).not.toContain("useFonts");
  });

  it("bottom-sheet only (no fonts) → provider injected, no useFonts residue", () => {
    patchLayout(target, buildLayoutReplacements({ ...A, bottomSheet: true }, null, null, false));
    const layout = fs.readFileSync(
      path.join(target, "src/app/_layout.tsx"),
      "utf8",
    );
    expect(layout).not.toMatch(/@@[A-Z_]+@@/);
    expect(layout).toContain("<BottomSheetModalProvider>");
    expect(layout).toContain("</BottomSheetModalProvider>");
    expect(layout).not.toContain("useFonts");
  });

  it("primary font + bottom-sheet → injected blocks present, zero residue", () => {
    const primary = {
      displayName: "Inter",
      fileBase: "Inter",
      variants: [
        { google: "regular", enumKey: "REGULAR", suffix: "-Regular" },
        { google: "700", enumKey: "BOLD", suffix: "-Bold" },
      ],
    };
    patchLayout(
      target,
      buildLayoutReplacements(
        { ...A, primaryFont: "Inter", bottomSheet: true },
        primary,
        null,
        false,
      ),
    );
    const layout = fs.readFileSync(
      path.join(target, "src/app/_layout.tsx"),
      "utf8",
    );
    expect(layout).not.toMatch(/@@[A-Z_]+@@/);
    expect(layout).toContain("useFonts");
    expect(layout).toContain("codingpixel:fonts-start");
    expect(layout).toContain("<BottomSheetModalProvider>");
    expect(layout).toContain("</BottomSheetModalProvider>");
  });

  it("primary + hasSplashScreen → SplashScreen.hideAsync inside marker block", () => {
    const primary = {
      displayName: "Inter",
      fileBase: "Inter",
      variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }],
    };
    patchLayout(target, buildLayoutReplacements({ ...A, primaryFont: "Inter" }, primary, null, true));
    const layout = fs.readFileSync(path.join(target, "src/app/_layout.tsx"), "utf8");
    expect(layout).toContain("SplashScreen.hideAsync");
    expect(layout).toContain("codingpixel:fonts-start");
    expect(layout).not.toMatch(/@@[A-Z_]+@@/);
  });

  it("primary + secondary → both font families' require()s in hook", () => {
    const primary = {
      displayName: "Inter",
      fileBase: "Inter",
      variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }],
    };
    const secondary = {
      displayName: "Roboto",
      fileBase: "Roboto",
      variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }],
    };
    patchLayout(
      target,
      buildLayoutReplacements(
        { ...A, primaryFont: "Inter", secondaryFont: "Roboto" },
        primary,
        secondary,
        false,
      ),
    );
    const layout = fs.readFileSync(path.join(target, "src/app/_layout.tsx"), "utf8");
    expect(layout).toContain("Inter-Regular");
    expect(layout).toContain("Roboto-Regular");
    expect(layout).not.toMatch(/@@[A-Z_]+@@/);
  });
});
