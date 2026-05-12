import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertIconExtension,
  assertSafeAssetFilename,
  deriveIconDests,
  ensureImagePickerPlugin,
  patchLayoutForSplash,
  readPngDimensions,
  removeStaleIconSiblings,
  setIconConfig,
  setSplashConfig,
  spliceMediaConstants,
  validateIconSource,
} from "../src/add.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpx-add-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

// templates/ lives at repo root; tests run from repo root.
const TEMPLATES_ROOT = path.resolve("templates");

function writeAppJson(plugins?: Array<string | [string, Record<string, unknown>]>): void {
  const json = { expo: { name: "x", plugins: plugins ?? [] } };
  fs.writeFileSync(path.join(tmp, "app.json"), JSON.stringify(json, null, 2));
}

function writeConstants(body: string): void {
  const dir = path.join(tmp, "src/core/utils");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "constants.ts"), body);
}

function readConstants(): string {
  return fs.readFileSync(path.join(tmp, "src/core/utils/constants.ts"), "utf8");
}

function readPlugins(): Array<unknown> {
  const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
  return json.expo.plugins;
}

describe("ensureImagePickerPlugin", () => {
  it("appends [\"expo-image-picker\", {permissions...}] entry when missing", () => {
    writeAppJson(["expo-router"]);
    ensureImagePickerPlugin(tmp);
    const plugins = readPlugins();
    expect(plugins).toHaveLength(2);
    const entry = plugins[1] as [string, Record<string, unknown>];
    expect(entry[0]).toBe("expo-image-picker");
    expect(entry[1]).toHaveProperty("photosPermission");
    expect(entry[1]).toHaveProperty("cameraPermission");
  });

  it("is idempotent — no duplicate on second call", () => {
    writeAppJson([]);
    ensureImagePickerPlugin(tmp);
    ensureImagePickerPlugin(tmp);
    const plugins = readPlugins();
    expect(plugins).toHaveLength(1);
  });

  it("preserves user-customized [\"expo-image-picker\", {custom}] entry", () => {
    writeAppJson([["expo-image-picker", { photosPermission: "CUSTOM" }]]);
    ensureImagePickerPlugin(tmp);
    const plugins = readPlugins();
    expect(plugins).toHaveLength(1);
    const entry = plugins[0] as [string, Record<string, unknown>];
    expect(entry[1].photosPermission).toBe("CUSTOM");
  });

  it("also detects bare-string \"expo-image-picker\" form", () => {
    writeAppJson(["expo-image-picker"]);
    ensureImagePickerPlugin(tmp);
    const plugins = readPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toBe("expo-image-picker");
  });

  it("creates expo.plugins array when missing", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify({ expo: { name: "x" } }, null, 2),
    );
    ensureImagePickerPlugin(tmp);
    const plugins = readPlugins();
    expect(plugins).toHaveLength(1);
  });
});

describe("spliceMediaConstants", () => {
  // Mirror templates/base/src/core/utils/constants.ts post-scaffold state —
  // the @@MEDIA_CONSTANTS@@ sentinel was dropped (replaced with "") by
  // applySentinels during initial scaffold with imagePicker=false.
  const POST_SCAFFOLD = `import { Platform } from "react-native";

export const ANDROID = Platform.OS === "android";
export const IOS = Platform.OS === "ios";

export const ImageSource = {
  CAMERA: "camera" as const,
  GALLERY: "gallery" as const,
};
`;

  // Legacy state — older scaffolds left the sentinel on disk.
  const LEGACY_WITH_SENTINEL = `export const ANDROID = true;

// @@MEDIA_CONSTANTS@@
`;

  it("appends snippet at EOF on post-scaffold input (current default)", () => {
    writeConstants(POST_SCAFFOLD);
    spliceMediaConstants(tmp, TEMPLATES_ROOT);
    const out = readConstants();
    expect(out).toContain("export const MEDIA_TYPES");
    expect(out).toContain("IMAGE_PICKER_OPTIONS");
    expect(out).toContain("CAMERA_OPTIONS");
    // existing content preserved
    expect(out).toContain("export const ImageSource");
  });

  it("replaces sentinel in-place on legacy input", () => {
    writeConstants(LEGACY_WITH_SENTINEL);
    spliceMediaConstants(tmp, TEMPLATES_ROOT);
    const out = readConstants();
    expect(out).toContain("export const MEDIA_TYPES");
    expect(out).not.toContain("@@MEDIA_CONSTANTS@@");
  });

  it("is idempotent — second call is a no-op", () => {
    writeConstants(POST_SCAFFOLD);
    spliceMediaConstants(tmp, TEMPLATES_ROOT);
    const first = readConstants();
    spliceMediaConstants(tmp, TEMPLATES_ROOT);
    const second = readConstants();
    expect(second).toBe(first);
  });

  it("throws when constants.ts is missing", () => {
    expect(() => spliceMediaConstants(tmp, TEMPLATES_ROOT)).toThrow(
      /constants\.ts/,
    );
  });
});

// ---------- readPngDimensions ----------

/**
 * Build a minimal valid PNG header (24 bytes: 8 magic + 4 length + 4 "IHDR"
 * + 4 width + 4 height). Sufficient for `readPngDimensions` to parse — the
 * remaining IHDR fields and PNG chunks are not read by the helper.
 */
function makePngHeader(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  buf.writeUInt32BE(13, 8); // IHDR length
  buf.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe("readPngDimensions", () => {
  it("parses width × height from valid PNG header", () => {
    const p = path.join(tmp, "valid.png");
    fs.writeFileSync(p, makePngHeader(1024, 768));
    expect(readPngDimensions(p)).toEqual({ width: 1024, height: 768 });
  });

  it("returns null when magic bytes are wrong (not a PNG)", () => {
    const p = path.join(tmp, "fake.png");
    fs.writeFileSync(p, Buffer.alloc(24, 0)); // all zeroes — wrong magic
    expect(readPngDimensions(p)).toBeNull();
  });

  it("returns null when file is shorter than 24 bytes", () => {
    const p = path.join(tmp, "short.png");
    fs.writeFileSync(p, Buffer.from([0x89, 0x50, 0x4e]));
    expect(readPngDimensions(p)).toBeNull();
  });
});

// ---------- validateIconSource ----------

describe("validateIconSource", () => {
  it("returns no warnings for a square PNG ≥ 1024", () => {
    const p = path.join(tmp, "ok.png");
    fs.writeFileSync(p, makePngHeader(1024, 1024));
    const { dims, warnings } = validateIconSource(p);
    expect(dims).toEqual({ width: 1024, height: 1024 });
    expect(warnings).toEqual([]);
  });

  it("warns when PNG source is non-square", () => {
    const p = path.join(tmp, "wide.png");
    fs.writeFileSync(p, makePngHeader(1024, 512));
    const { warnings } = validateIconSource(p);
    expect(warnings.some((w) => /non-square/i.test(w))).toBe(true);
  });

  it("warns when PNG source is smaller than 1024 (store recommendation)", () => {
    const p = path.join(tmp, "med.png");
    fs.writeFileSync(p, makePngHeader(800, 800));
    const { warnings } = validateIconSource(p);
    expect(warnings.some((w) => /App Store \/ Play Store/i.test(w))).toBe(true);
  });

  it("warns about Android adaptive 432×432 minimum on sources below it", () => {
    const p = path.join(tmp, "tiny.png");
    fs.writeFileSync(p, makePngHeader(177, 177));
    const { warnings } = validateIconSource(p);
    expect(warnings.some((w) => /Android adaptive-icon minimum of 432/i.test(w))).toBe(true);
    // Also still warns about 1024 store recommendation.
    expect(warnings.some((w) => /App Store \/ Play Store/i.test(w))).toBe(true);
  });

  it("warns when file claims .png but has invalid header", () => {
    const p = path.join(tmp, "notpng.png");
    fs.writeFileSync(p, Buffer.alloc(24, 0));
    const { dims, warnings } = validateIconSource(p);
    expect(dims).toBeNull();
    expect(warnings.some((w) => /PNG signature/i.test(w))).toBe(true);
  });
});

// ---------- assertIconExtension ----------

describe("assertIconExtension", () => {
  it("accepts .png (case-insensitive)", () => {
    expect(assertIconExtension("/a/icon.png")).toBe("png");
    expect(assertIconExtension("/a/icon.PNG")).toBe("png");
  });

  it("rejects .jpg + .jpeg with Android-specific guidance", () => {
    for (const ext of [".jpg", ".JPG", ".jpeg", ".JPEG"]) {
      try {
        assertIconExtension(`/a/icon${ext}`);
        throw new Error(`should have thrown for ${ext}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).toMatch(/Android adaptive icon foreground requires PNG/i);
        expect(msg).toMatch(/Convert/i);
      }
    }
  });

  it("rejects all other extensions (.webp, .svg, .gif, .bmp, none)", () => {
    for (const path of [
      "/a/icon.webp",
      "/a/icon.svg",
      "/a/icon.gif",
      "/a/icon.bmp",
      "/a/icon",
    ]) {
      expect(() => assertIconExtension(path)).toThrow(/Unsupported/i);
    }
  });

  it("error message names the offending file + cites PNG requirement", () => {
    try {
      assertIconExtension("/a/logo.webp");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toContain("logo.webp");
      expect(msg).toMatch(/PNG/i);
    }
  });
});

// ---------- patchLayoutForSplash ----------

function writeLayout(content: string): void {
  const dir = path.join(tmp, "src/app");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "_layout.tsx"), content);
}

function readLayout(): string {
  return fs.readFileSync(path.join(tmp, "src/app/_layout.tsx"), "utf8");
}

// Minimal subset of base template, mirroring scaffold output (sentinels
// already filled / dropped by patchLayout at scaffold time).
const BASE_LAYOUT = `import { ErrorBoundary } from "react-error-boundary";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Routes from "./routes";

export default function RootLayout() {
  return (
    <ErrorBoundary FallbackComponent={() => null}>
      <Routes />
    </ErrorBoundary>
  );
}
`;

describe("patchLayoutForSplash", () => {
  it("adds SplashScreen import + react useEffect import + preventAutoHideAsync + useEffect→hideAsync", () => {
    writeLayout(BASE_LAYOUT);
    patchLayoutForSplash(tmp);
    const out = readLayout();
    expect(out).toContain('import * as SplashScreen from "expo-splash-screen";');
    expect(out).toContain('import { useEffect } from "react";');
    expect(out).toContain("SplashScreen.preventAutoHideAsync();");
    // useEffect must appear inside RootLayout, before the JSX return.
    const rootIdx = out.indexOf("export default function RootLayout()");
    const useEffectIdx = out.indexOf("SplashScreen.hideAsync()");
    const returnIdx = out.indexOf("return (", rootIdx);
    expect(useEffectIdx).toBeGreaterThan(rootIdx);
    expect(useEffectIdx).toBeLessThan(returnIdx);
  });

  it("merges useEffect into an existing `from \"react\"` named import (no duplicate line)", () => {
    writeLayout(`import { useState } from "react";\n${BASE_LAYOUT}`);
    patchLayoutForSplash(tmp);
    const out = readLayout();
    // Single react import line — useState + useEffect merged.
    const reactImportMatches = out.match(/from\s+["']react["']/g) ?? [];
    expect(reactImportMatches).toHaveLength(1);
    expect(out).toMatch(/import\s+\{[^}]*useState[^}]*useEffect[^}]*\}\s+from\s+["']react["']/);
  });

  it("does NOT add a duplicate useEffect import when react already imports it", () => {
    writeLayout(`import { useEffect, useState } from "react";\n${BASE_LAYOUT}`);
    patchLayoutForSplash(tmp);
    const out = readLayout();
    const reactImportMatches = out.match(/from\s+["']react["']/g) ?? [];
    expect(reactImportMatches).toHaveLength(1);
    // The original `useEffect, useState` order is preserved unchanged.
    expect(out).toMatch(/import\s+\{\s*useEffect,\s*useState\s*\}\s+from\s+["']react["']/);
  });

  it("is idempotent — second call yields identical output", () => {
    writeLayout(BASE_LAYOUT);
    patchLayoutForSplash(tmp);
    const first = readLayout();
    patchLayoutForSplash(tmp);
    const second = readLayout();
    expect(second).toBe(first);
  });

  it("silently skips when _layout.tsx is missing (logs warn, does not throw)", () => {
    expect(() => patchLayoutForSplash(tmp)).not.toThrow();
  });

  it("skips when layout has no RootLayout function (defensive fallback)", () => {
    writeLayout(`// custom layout — no RootLayout function\nexport const Foo = () => null;\n`);
    patchLayoutForSplash(tmp);
    const out = readLayout();
    expect(out).not.toContain("SplashScreen.hideAsync");
  });

  it("preserves existing imports + body when splicing", () => {
    writeLayout(BASE_LAYOUT);
    patchLayoutForSplash(tmp);
    const out = readLayout();
    expect(out).toContain('import { ErrorBoundary } from "react-error-boundary";');
    expect(out).toContain('import { GestureHandlerRootView } from "react-native-gesture-handler";');
    expect(out).toContain('import Routes from "./routes";');
    expect(out).toContain("<Routes />");
  });
});

// ---------- setIconConfig ----------

// ---------- deriveIconDests ----------

describe("deriveIconDests", () => {
  it("defaults to ./src/assets/icon.png + adaptive-icon.png when app.json has no icon fields", () => {
    fs.writeFileSync(path.join(tmp, "app.json"), JSON.stringify({ expo: {} }, null, 2));
    const dests = deriveIconDests(tmp, "png");
    expect(dests.iconAppJson).toBe("./src/assets/icon.png");
    expect(dests.adaptiveAppJson).toBe("./src/assets/adaptive-icon.png");
    expect(dests.iconRel).toBe("src/assets/icon.png");
    expect(dests.adaptiveRel).toBe("src/assets/adaptive-icon.png");
  });

  it("preserves user's existing `expo.icon` path (stock create-expo-app layout)", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify({ expo: { icon: "./assets/images/appIcon.png" } }, null, 2),
    );
    const dests = deriveIconDests(tmp, "png");
    expect(dests.iconAppJson).toBe("./assets/images/appIcon.png");
    expect(dests.iconRel).toBe("assets/images/appIcon.png");
    // Adaptive derived from icon base: appIcon → adaptive-appIcon.
    expect(dests.adaptiveAppJson).toBe("./assets/images/adaptive-appIcon.png");
    expect(dests.adaptiveRel).toBe("assets/images/adaptive-appIcon.png");
  });

  it("preserves user's existing adaptive foregroundImage path independently of icon path", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify(
        {
          expo: {
            icon: "./assets/images/icon.png",
            android: {
              adaptiveIcon: {
                foregroundImage: "./assets/android/fg.png",
              },
            },
          },
        },
        null,
        2,
      ),
    );
    const dests = deriveIconDests(tmp, "png");
    expect(dests.iconAppJson).toBe("./assets/images/icon.png");
    expect(dests.adaptiveAppJson).toBe("./assets/android/fg.png");
  });

  it("uses adaptive-icon sibling for the conventional `icon` basename", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify({ expo: { icon: "./assets/images/icon.png" } }, null, 2),
    );
    const dests = deriveIconDests(tmp, "png");
    expect(dests.adaptiveAppJson).toBe("./assets/images/adaptive-icon.png");
  });
});

describe("setIconConfig", () => {
  it("writes all four icon fields per Expo SDK 54 docs", () => {
    writeAppJson([]);
    setIconConfig(tmp);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    // iOS + favicon fallback.
    expect(json.expo.icon).toBe("./src/assets/icon.png");
    // Android non-adaptive fallback (< Android 8.0).
    expect(json.expo.android.icon).toBe("./src/assets/icon.png");
    // Android 8.0+ adaptive foreground.
    expect(json.expo.android.adaptiveIcon.foregroundImage).toBe(
      "./src/assets/adaptive-icon.png",
    );
    // Required pair — without this, adaptive icon won't render.
    expect(json.expo.android.adaptiveIcon.backgroundColor).toBe("#ffffff");
  });

  it("preserves user-set adaptiveIcon.backgroundColor (does NOT overwrite)", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify(
        {
          expo: {
            android: {
              adaptiveIcon: { backgroundColor: "#ff0000" },
            },
          },
        },
        null,
        2,
      ),
    );
    setIconConfig(tmp);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    expect(json.expo.android.adaptiveIcon.backgroundColor).toBe("#ff0000");
    // foregroundImage still gets canonicalized.
    expect(json.expo.android.adaptiveIcon.foregroundImage).toBe(
      "./src/assets/adaptive-icon.png",
    );
  });

  it("is idempotent — second call yields identical output", () => {
    writeAppJson([]);
    setIconConfig(tmp);
    const first = fs.readFileSync(path.join(tmp, "app.json"), "utf8");
    setIconConfig(tmp);
    const second = fs.readFileSync(path.join(tmp, "app.json"), "utf8");
    expect(second).toBe(first);
  });

  it("preserves unrelated expo fields and existing android sub-keys", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify(
        {
          expo: {
            name: "MyApp",
            android: { package: "com.myapp", versionCode: 5 },
          },
        },
        null,
        2,
      ),
    );
    setIconConfig(tmp);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    expect(json.expo.name).toBe("MyApp");
    expect(json.expo.android.package).toBe("com.myapp");
    expect(json.expo.android.versionCode).toBe(5);
    expect(json.expo.android.icon).toBe("./src/assets/icon.png");
    expect(json.expo.android.adaptiveIcon.foregroundImage).toBe(
      "./src/assets/adaptive-icon.png",
    );
  });

  it("respects user's existing expo.icon path (stock layout) — writes to that path, doesn't clobber", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify({ expo: { icon: "./assets/images/appIcon.png" } }, null, 2),
    );
    setIconConfig(tmp);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    expect(json.expo.icon).toBe("./assets/images/appIcon.png");
    expect(json.expo.android.icon).toBe("./assets/images/appIcon.png");
    // Adaptive derived from existing icon basename.
    expect(json.expo.android.adaptiveIcon.foregroundImage).toBe(
      "./assets/images/adaptive-appIcon.png",
    );
    expect(json.expo.android.adaptiveIcon.backgroundColor).toBe("#ffffff");
  });

  it("accepts an explicit IconDests override", () => {
    writeAppJson([]);
    setIconConfig(tmp, {
      iconRel: "x/y.png",
      adaptiveRel: "x/z.png",
      iconAppJson: "./x/y.png",
      adaptiveAppJson: "./x/z.png",
    });
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    expect(json.expo.icon).toBe("./x/y.png");
    expect(json.expo.android.icon).toBe("./x/y.png");
    expect(json.expo.android.adaptiveIcon.foregroundImage).toBe("./x/z.png");
  });
});

// ---------- setSplashConfig ----------

describe("setSplashConfig", () => {
  const IMG = "./src/assets/splash-icon.png";

  it("appends expo-splash-screen plugin entry with full options INCLUDING dark block (default imageWidth 150)", () => {
    writeAppJson([]);
    setSplashConfig(tmp, "#ff0000", IMG);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    const entry = json.expo.plugins.find(
      (e: unknown) =>
        Array.isArray(e) && (e as [string])[0] === "expo-splash-screen",
    );
    expect(entry).toBeDefined();
    const opts = (entry as [string, Record<string, unknown>])[1];
    expect(opts).toEqual({
      image: IMG,
      imageWidth: 150,
      resizeMode: "contain",
      backgroundColor: "#ff0000",
      dark: { backgroundColor: "#ff0000" },
    });
  });

  it("honors explicit imageWidth argument", () => {
    writeAppJson([]);
    setSplashConfig(tmp, "#ffffff", IMG, 180);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    const opts = json.expo.plugins[0][1];
    expect(opts.imageWidth).toBe(180);
  });

  it("imageWidth default (150) fits Android 12+ 192dp splash canvas", () => {
    writeAppJson([]);
    setSplashConfig(tmp, "#ffffff", IMG);
    const opts = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"))
      .expo.plugins[0][1];
    expect(opts.imageWidth).toBeLessThanOrEqual(192);
  });

  it("dark.backgroundColor mirrors the light backgroundColor by default", () => {
    writeAppJson([]);
    setSplashConfig(tmp, "#ABBDCF", IMG);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    const opts = json.expo.plugins[0][1];
    expect(opts.dark.backgroundColor).toBe("#ABBDCF");
  });

  it("merges into existing plugin entry preserving dark.image + unknown options", () => {
    writeAppJson([
      [
        "expo-splash-screen",
        {
          dark: { backgroundColor: "#000000", image: "./dark-splash.png" },
          customField: 42,
        },
      ],
    ]);
    setSplashConfig(tmp, "#ffffff", IMG);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    const entry = json.expo.plugins[0];
    const opts = entry[1];
    // backgroundColor in dark gets MIRRORED to the new light color (user's
    // light/dark contrast intent — we sync them). dark.image is preserved.
    expect(opts.dark.backgroundColor).toBe("#ffffff");
    expect(opts.dark.image).toBe("./dark-splash.png");
    expect(opts.customField).toBe(42);
    expect(opts.image).toBe(IMG);
    expect(opts.backgroundColor).toBe("#ffffff");
  });

  it("also updates legacy expo.splash when present", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify(
        {
          expo: {
            plugins: [],
            splash: {
              image: "./old.png",
              backgroundColor: "#aaaaaa",
              resizeMode: "contain",
            },
          },
        },
        null,
        2,
      ),
    );
    setSplashConfig(tmp, "#123456", IMG);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    expect(json.expo.splash.image).toBe(IMG);
    expect(json.expo.splash.backgroundColor).toBe("#123456");
    // Unrelated legacy field preserved.
    expect(json.expo.splash.resizeMode).toBe("contain");
  });

  it("is idempotent — re-running with same args yields identical output", () => {
    writeAppJson([]);
    setSplashConfig(tmp, "#ffffff", IMG);
    const first = fs.readFileSync(path.join(tmp, "app.json"), "utf8");
    setSplashConfig(tmp, "#ffffff", IMG);
    const second = fs.readFileSync(path.join(tmp, "app.json"), "utf8");
    expect(second).toBe(first);
  });

  it("updates color in place on second call with different value (no duplicate entry)", () => {
    writeAppJson([]);
    setSplashConfig(tmp, "#ffffff", IMG);
    setSplashConfig(tmp, "#000000", IMG);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    const splashEntries = json.expo.plugins.filter(
      (e: unknown) =>
        Array.isArray(e) && (e as [string])[0] === "expo-splash-screen",
    );
    expect(splashEntries).toHaveLength(1);
    expect(splashEntries[0][1].backgroundColor).toBe("#000000");
  });
});

// ---------- removeStaleIconSiblings ----------

describe("removeStaleIconSiblings", () => {
  it("removes icon.jpg + icon.jpeg when keeping .png", () => {
    fs.writeFileSync(path.join(tmp, "icon.png"), "P");
    fs.writeFileSync(path.join(tmp, "icon.jpg"), "J");
    fs.writeFileSync(path.join(tmp, "icon.jpeg"), "JJ");
    const removed = removeStaleIconSiblings(tmp, "icon", "png");
    expect(removed.sort()).toEqual(["icon.jpeg", "icon.jpg"]);
    expect(fs.existsSync(path.join(tmp, "icon.png"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "icon.jpg"))).toBe(false);
    expect(fs.existsSync(path.join(tmp, "icon.jpeg"))).toBe(false);
  });

  it("no-op when no siblings exist", () => {
    fs.writeFileSync(path.join(tmp, "icon.png"), "P");
    const removed = removeStaleIconSiblings(tmp, "icon", "png");
    expect(removed).toEqual([]);
  });

  it("works on adaptive-icon as well", () => {
    fs.writeFileSync(path.join(tmp, "adaptive-icon.png"), "P");
    fs.writeFileSync(path.join(tmp, "adaptive-icon.jpg"), "J");
    fs.writeFileSync(path.join(tmp, "adaptive-icon.jpeg"), "JJ");
    const removed = removeStaleIconSiblings(tmp, "adaptive-icon", "png");
    expect(removed.sort()).toEqual(["adaptive-icon.jpeg", "adaptive-icon.jpg"]);
    expect(fs.existsSync(path.join(tmp, "adaptive-icon.png"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "adaptive-icon.jpg"))).toBe(false);
    expect(fs.existsSync(path.join(tmp, "adaptive-icon.jpeg"))).toBe(false);
  });

  it("cleans up legacy .jpg / .jpeg from v0.2.0/v0.2.1 scaffolds on first re-run", () => {
    // Simulates a user who ran `add app-icon` under v0.2.0 with a JPG source.
    // Now upgrading to v0.2.2+ (PNG-only), the new run should clean these up.
    fs.writeFileSync(path.join(tmp, "icon.jpg"), "legacy jpg");
    fs.writeFileSync(path.join(tmp, "icon.jpeg"), "legacy jpeg");
    fs.writeFileSync(path.join(tmp, "icon.png"), "new png");
    const removed = removeStaleIconSiblings(tmp, "icon", "png");
    expect(removed.sort()).toEqual(["icon.jpeg", "icon.jpg"]);
  });
});

// ---------- assertSafeAssetFilename ----------

describe("assertSafeAssetFilename", () => {
  it("accepts plain hyphenated filename", () => {
    expect(() => assertSafeAssetFilename("/abs/path/app-icon.png")).not.toThrow();
  });

  it("accepts underscored / camelCase / digits", () => {
    expect(() => assertSafeAssetFilename("/abs/app_icon.png")).not.toThrow();
    expect(() => assertSafeAssetFilename("/abs/AppIcon.png")).not.toThrow();
    expect(() => assertSafeAssetFilename("/abs/icon1024.png")).not.toThrow();
  });

  it("throws when filename contains a space", () => {
    expect(() => assertSafeAssetFilename("/abs/path/app icon.png")).toThrow(
      /whitespace/i,
    );
  });

  it("throws when filename contains a tab", () => {
    expect(() => assertSafeAssetFilename("/abs/path/app\ticon.png")).toThrow(
      /whitespace/i,
    );
  });

  it("ignores spaces in parent directories — only basename is checked", () => {
    // macOS home dirs and user-named folders commonly have spaces; we don't
    // copy directories, only the file, and Expo never references the source
    // path in the final build (we rename to canonical destinations).
    expect(() =>
      assertSafeAssetFilename("/Users/Mac User/My Icons/app-icon.png"),
    ).not.toThrow();
  });

  it("error message names the offending file + suggests a remediation", () => {
    try {
      assertSafeAssetFilename("/x/app icon.png");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toContain("app icon.png");
      expect(msg).toMatch(/rename/i);
    }
  });
});
