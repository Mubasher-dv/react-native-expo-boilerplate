import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  VARIANT_MAP,
  buildVariantList,
  normalizeFamily,
  buildFileBase,
} from "../src/fontsInstaller.js";
import { readSidecar, writeSidecar, deleteSidecar } from "../src/fontsInstaller.js";

describe("VARIANT_MAP", () => {
  it("contains entries for all 9 enum keys + aliases (11 total)", () => {
    expect(VARIANT_MAP.size).toBe(11);
  });

  it("maps 'regular' and '400' to the same REGULAR slot", () => {
    expect(VARIANT_MAP.get("regular")).toEqual({ enumKey: "REGULAR", suffix: "-Regular", variantDir: "400Regular" });
    expect(VARIANT_MAP.get("400")).toEqual({ enumKey: "REGULAR", suffix: "-Regular", variantDir: "400Regular" });
  });

  it("maps italic aliases", () => {
    expect(VARIANT_MAP.get("italic")?.enumKey).toBe("ITALIC");
    expect(VARIANT_MAP.get("400italic")?.enumKey).toBe("ITALIC");
  });

  it("maps all weight tokens", () => {
    const expected: Array<[string, string]> = [
      ["100", "THIN"],
      ["200", "EXTRA_LIGHT"],
      ["300", "LIGHT"],
      ["500", "MEDIUM"],
      ["600", "SEMI_BOLD"],
      ["700", "BOLD"],
      ["800", "EXTRA_BOLD"],
    ];
    for (const [token, key] of expected) {
      expect(VARIANT_MAP.get(token)?.enumKey).toBe(key);
    }
  });
});

describe("buildVariantList", () => {
  it("intersects metadata variants with the 9-key map", () => {
    const result = buildVariantList(["100", "regular", "700", "900"]);
    expect(result.map((v) => v.enumKey)).toEqual(["THIN", "REGULAR", "BOLD"]);
  });

  it("dedupes regular+400 into single REGULAR (Issue 3)", () => {
    const result = buildVariantList(["regular", "400"]);
    expect(result).toHaveLength(1);
    expect(result[0].enumKey).toBe("REGULAR");
  });

  it("dedupes italic+400italic into single ITALIC", () => {
    const result = buildVariantList(["italic", "400italic"]);
    expect(result).toHaveLength(1);
    expect(result[0].enumKey).toBe("ITALIC");
  });

  it("returns empty when no input matches", () => {
    expect(buildVariantList(["900", "900italic"])).toEqual([]);
  });
});

describe("normalizeFamily", () => {
  it("trims + lowercases + hyphenates", () => {
    expect(normalizeFamily(" Open Sans ")).toBe("open-sans");
    expect(normalizeFamily("INTER")).toBe("inter");
    expect(normalizeFamily("PT Sans")).toBe("pt-sans");
    expect(normalizeFamily("Roboto Condensed")).toBe("roboto-condensed");
  });
});

describe("buildFileBase", () => {
  it("strips spaces", () => {
    expect(buildFileBase("Open Sans")).toBe("OpenSans");
    expect(buildFileBase("Inter")).toBe("Inter");
    expect(buildFileBase("Roboto Condensed")).toBe("RobotoCondensed");
  });
});

describe("sidecar IO", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rneb-sidecar-"));
    fs.mkdirSync(path.join(tmp, "src/assets/fonts"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("readSidecar returns null when file missing", () => {
    expect(readSidecar(tmp)).toBeNull();
  });

  it("writeSidecar + readSidecar round-trips", () => {
    const sc = {
      schemaVersion: 1 as const,
      markerSyntax: "codingpixel:fonts" as const,
      primary: { displayName: "Inter", fileBase: "Inter", variants: [] },
      secondary: null,
    };
    writeSidecar(tmp, sc);
    expect(readSidecar(tmp)).toEqual(sc);
  });

  it("readSidecar returns null on bad schemaVersion", () => {
    const p = path.join(tmp, "src/assets/fonts/.codingpixel-fonts.json");
    fs.writeFileSync(p, JSON.stringify({ schemaVersion: 99 }));
    expect(readSidecar(tmp)).toBeNull();
  });

  it("readSidecar returns null on malformed JSON", () => {
    const p = path.join(tmp, "src/assets/fonts/.codingpixel-fonts.json");
    fs.writeFileSync(p, "{not json");
    expect(readSidecar(tmp)).toBeNull();
  });

  it("writeSidecar leaves no .tmp leftover on disk", () => {
    const sc = {
      schemaVersion: 1 as const,
      markerSyntax: "codingpixel:fonts" as const,
      primary: null,
      secondary: null,
    };
    writeSidecar(tmp, sc);
    const files = fs.readdirSync(path.join(tmp, "src/assets/fonts"));
    expect(files).toContain(".codingpixel-fonts.json");
    expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("deleteSidecar removes file (returns true) and is idempotent (returns false on second call)", () => {
    writeSidecar(tmp, {
      schemaVersion: 1,
      markerSyntax: "codingpixel:fonts",
      primary: null,
      secondary: null,
    });
    expect(deleteSidecar(tmp)).toBe(true);
    expect(deleteSidecar(tmp)).toBe(false);
  });
});

import { vi } from "vitest";
import { checkPackageExists, UnknownFontError, NetworkError } from "../src/fontsInstaller.js";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
const execaMock = execa as unknown as ReturnType<typeof vi.fn>;

describe("checkPackageExists", () => {
  beforeEach(() => {
    execaMock.mockReset();
  });

  it("returns true on npm view exit 0", async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "@expo-google-fonts/inter", stderr: "" });
    await expect(checkPackageExists("Inter")).resolves.toBe(true);
  });

  it("throws UnknownFontError on E404 stderr", async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "npm ERR! 404 E404 Not Found" });
    await expect(checkPackageExists("Bogus")).rejects.toBeInstanceOf(UnknownFontError);
  });

  it("throws NetworkError on ENOTFOUND", async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "npm ERR! getaddrinfo ENOTFOUND registry.npmjs.org" });
    await expect(checkPackageExists("Inter")).rejects.toBeInstanceOf(NetworkError);
  });

  it("throws NetworkError on ECONNREFUSED", async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "ECONNREFUSED" });
    await expect(checkPackageExists("Inter")).rejects.toBeInstanceOf(NetworkError);
  });

  it("throws NetworkError on ETIMEDOUT", async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "ETIMEDOUT" });
    await expect(checkPackageExists("Inter")).rejects.toBeInstanceOf(NetworkError);
  });

  it("throws NetworkError on EAI_AGAIN", async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "EAI_AGAIN" });
    await expect(checkPackageExists("Inter")).rejects.toBeInstanceOf(NetworkError);
  });

  it("throws raw stderr on unknown non-zero exit", async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "totally weird error" });
    await expect(checkPackageExists("Inter")).rejects.toThrow(/totally weird/);
  });
});

import {
  removeStaleFontFiles,
  removeAllRecipeOwnedFonts,
  RECIPE_OWNED_TTF_REGEX,
} from "../src/fontsInstaller.js";
import { regenerateFontsMarkerBlock } from "../src/fontsInstaller.js";

describe("RECIPE_OWNED_TTF_REGEX", () => {
  it("matches PascalCase family + valid suffix", () => {
    expect(RECIPE_OWNED_TTF_REGEX.test("Inter-Bold.ttf")).toBe(true);
    expect(RECIPE_OWNED_TTF_REGEX.test("OpenSans-Italic.ttf")).toBe(true);
    expect(RECIPE_OWNED_TTF_REGEX.test("PTSans-Regular.ttf")).toBe(true);
  });

  it("rejects non-suffix names", () => {
    expect(RECIPE_OWNED_TTF_REGEX.test("MyCustomBrand.ttf")).toBe(false);
    expect(RECIPE_OWNED_TTF_REGEX.test("Inter-Heavy.ttf")).toBe(false);
    expect(RECIPE_OWNED_TTF_REGEX.test("Inter.ttf")).toBe(false);
  });
});

describe("removeStaleFontFiles", () => {
  let tmpC: string;
  beforeEach(() => {
    tmpC = fs.mkdtempSync(path.join(os.tmpdir(), "rneb-cleanup-"));
    fs.mkdirSync(path.join(tmpC, "src/assets/fonts"), { recursive: true });
  });
  afterEach(() => fs.rmSync(tmpC, { recursive: true, force: true }));

  it("removes recipe-owned TTFs not in keep set; preserves user TTFs", () => {
    const dir = path.join(tmpC, "src/assets/fonts");
    fs.writeFileSync(path.join(dir, "Inter-Bold.ttf"), "");
    fs.writeFileSync(path.join(dir, "Inter-Regular.ttf"), "");
    fs.writeFileSync(path.join(dir, "OldFont-Regular.ttf"), ""); // stale
    fs.writeFileSync(path.join(dir, "MyCustomBrand.ttf"), ""); // user — preserved
    const removed = removeStaleFontFiles(tmpC, new Set(["Inter-Bold.ttf", "Inter-Regular.ttf"]));
    expect(removed.sort()).toEqual(["OldFont-Regular.ttf"]);
    expect(fs.existsSync(path.join(dir, "MyCustomBrand.ttf"))).toBe(true);
  });
});

describe("removeAllRecipeOwnedFonts (Decision #14)", () => {
  let tmpW: string;
  beforeEach(() => {
    tmpW = fs.mkdtempSync(path.join(os.tmpdir(), "rneb-wipe-"));
    fs.mkdirSync(path.join(tmpW, "src/assets/fonts"), { recursive: true });
    fs.mkdirSync(path.join(tmpW, "src/ui/theme"), { recursive: true });
    fs.mkdirSync(path.join(tmpW, "src/app"), { recursive: true });
  });
  afterEach(() => fs.rmSync(tmpW, { recursive: true, force: true }));

  it("wipes recipe-owned TTFs + restores empty fonts.ts + strips marker block + deletes sidecar; preserves user TTFs", () => {
    const fontsDir = path.join(tmpW, "src/assets/fonts");
    fs.writeFileSync(path.join(fontsDir, "Inter-Bold.ttf"), "");
    fs.writeFileSync(path.join(fontsDir, "Inter-Regular.ttf"), "");
    fs.writeFileSync(path.join(fontsDir, "MyCustomBrand.ttf"), "");
    writeSidecar(tmpW, {
      schemaVersion: 1,
      markerSyntax: "codingpixel:fonts",
      primary: { displayName: "Inter", fileBase: "Inter", variants: [] },
      secondary: null,
    });
    fs.writeFileSync(
      path.join(tmpW, "src/ui/theme/fonts.ts"),
      'export enum Fonts {\n  BOLD = "Inter-Bold",\n}\n',
    );
    fs.writeFileSync(
      path.join(tmpW, "src/app/_layout.tsx"),
      [
        'import { useFonts } from "expo-font";',
        "export default function RootLayout() {",
        "  // codingpixel:fonts-start",
        "  const [loaded] = useFonts({});",
        "  // codingpixel:fonts-end",
        "  return null;",
        "}",
      ].join("\n"),
    );

    const out = removeAllRecipeOwnedFonts(tmpW);

    expect(out.removedTtfs.sort()).toEqual(["Inter-Bold.ttf", "Inter-Regular.ttf"]);
    expect(out.fontsTsRestored).toBe(true);
    expect(out.markerBlockRemoved).toBe(true);
    expect(out.sidecarDeleted).toBe(true);
    expect(fs.existsSync(path.join(fontsDir, "MyCustomBrand.ttf"))).toBe(true);
    const layout = fs.readFileSync(path.join(tmpW, "src/app/_layout.tsx"), "utf8");
    expect(layout).not.toContain("codingpixel:fonts-start");
    expect(layout).not.toContain("useFonts");
  });
});

describe("regenerateFontsMarkerBlock", () => {
  let tmpR: string;
  beforeEach(() => {
    tmpR = fs.mkdtempSync(path.join(os.tmpdir(), "rneb-regen-"));
    fs.mkdirSync(path.join(tmpR, "src/app"), { recursive: true });
    fs.mkdirSync(path.join(tmpR, "src/assets/fonts"), { recursive: true });
    fs.writeFileSync(path.join(tmpR, "package.json"), JSON.stringify({ dependencies: { expo: "^54.0.0" } }));
  });
  afterEach(() => fs.rmSync(tmpR, { recursive: true, force: true }));

  it("returns no-sidecar when sidecar absent", () => {
    expect(regenerateFontsMarkerBlock(tmpR).reason).toBe("no-sidecar");
  });

  it("returns no-splash-needed when sidecar present + no expo-splash-screen dep", () => {
    writeSidecar(tmpR, {
      schemaVersion: 1,
      markerSyntax: "codingpixel:fonts",
      primary: { displayName: "Inter", fileBase: "Inter", variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }] },
      secondary: null,
    });
    fs.writeFileSync(
      path.join(tmpR, "src/app/_layout.tsx"),
      [
        'import { useFonts } from "expo-font";',
        "export default function RootLayout() {",
        "  // codingpixel:fonts-start",
        '  const [fontsLoaded, fontError] = useFonts({});',
        "  // codingpixel:fonts-end",
        "  return null;",
        "}",
      ].join("\n"),
    );
    expect(regenerateFontsMarkerBlock(tmpR).reason).toBe("no-splash-needed");
  });

  it("rewrites marker block when sidecar present + splash dep + no useEffect", () => {
    fs.writeFileSync(
      path.join(tmpR, "package.json"),
      JSON.stringify({ dependencies: { expo: "^54.0.0", "expo-splash-screen": "*" } }),
    );
    writeSidecar(tmpR, {
      schemaVersion: 1,
      markerSyntax: "codingpixel:fonts",
      primary: { displayName: "Inter", fileBase: "Inter", variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }] },
      secondary: null,
    });
    fs.writeFileSync(
      path.join(tmpR, "src/app/_layout.tsx"),
      [
        'import { useFonts } from "expo-font";',
        'import * as SplashScreen from "expo-splash-screen";',
        "export default function RootLayout() {",
        "  // codingpixel:fonts-start",
        '  const [fontsLoaded, fontError] = useFonts({ "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf") });',
        "  // codingpixel:fonts-end",
        "  return null;",
        "}",
      ].join("\n"),
    );
    const out = regenerateFontsMarkerBlock(tmpR);
    expect(out.changed).toBe(true);
    expect(out.reason).toBe("rewrote");
    const layout = fs.readFileSync(path.join(tmpR, "src/app/_layout.tsx"), "utf8");
    expect(layout).toMatch(/SplashScreen\.hideAsync/);
    expect(layout).toMatch(/\[fontsLoaded, fontError\]/);
  });

  it("returns already-current on second invocation (idempotent)", () => {
    fs.writeFileSync(
      path.join(tmpR, "package.json"),
      JSON.stringify({ dependencies: { expo: "^54.0.0", "expo-splash-screen": "*" } }),
    );
    writeSidecar(tmpR, {
      schemaVersion: 1,
      markerSyntax: "codingpixel:fonts",
      primary: { displayName: "Inter", fileBase: "Inter", variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }] },
      secondary: null,
    });
    fs.writeFileSync(
      path.join(tmpR, "src/app/_layout.tsx"),
      [
        'import { useFonts } from "expo-font";',
        'import * as SplashScreen from "expo-splash-screen";',
        "export default function RootLayout() {",
        "  // codingpixel:fonts-start",
        '  const [fontsLoaded, fontError] = useFonts({ "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf") });',
        "  // codingpixel:fonts-end",
        "  return null;",
        "}",
      ].join("\n"),
    );
    regenerateFontsMarkerBlock(tmpR); // first call writes canonical form.
    const afterFirst = fs.readFileSync(path.join(tmpR, "src/app/_layout.tsx"), "utf8");
    const second = regenerateFontsMarkerBlock(tmpR);
    expect(second.changed).toBe(false);
    expect(second.reason).toBe("already-current");
    expect(fs.readFileSync(path.join(tmpR, "src/app/_layout.tsx"), "utf8")).toBe(afterFirst);
  });
});
