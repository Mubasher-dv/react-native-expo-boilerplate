import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertSafeAssetFilename,
  ensureImagePickerPlugin,
  readPngDimensions,
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
  it("returns no warnings for a square PNG ≥ target size", () => {
    const p = path.join(tmp, "ok.png");
    fs.writeFileSync(p, makePngHeader(1024, 1024));
    const { dims, warnings } = validateIconSource(p, 1024);
    expect(dims).toEqual({ width: 1024, height: 1024 });
    expect(warnings).toEqual([]);
  });

  it("warns when source is non-square", () => {
    const p = path.join(tmp, "wide.png");
    fs.writeFileSync(p, makePngHeader(1024, 512));
    const { warnings } = validateIconSource(p, 1024);
    expect(warnings.some((w) => /non-square/i.test(w))).toBe(true);
  });

  it("warns when source is smaller than target size", () => {
    const p = path.join(tmp, "small.png");
    fs.writeFileSync(p, makePngHeader(512, 512));
    const { warnings } = validateIconSource(p, 1024);
    expect(warnings.some((w) => /smaller than requested size/i.test(w))).toBe(true);
  });

  it("warns when file is not a valid PNG (header unreadable)", () => {
    const p = path.join(tmp, "notpng.png");
    fs.writeFileSync(p, Buffer.alloc(24, 0));
    const { dims, warnings } = validateIconSource(p, 1024);
    expect(dims).toBeNull();
    expect(warnings.some((w) => /PNG header/i.test(w))).toBe(true);
  });
});

// ---------- setIconConfig ----------

describe("setIconConfig", () => {
  it("sets expo.icon + adaptiveIcon.foregroundImage + default adaptiveIcon.backgroundColor", () => {
    writeAppJson([]);
    setIconConfig(tmp);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    expect(json.expo.icon).toBe("./src/assets/icon.png");
    expect(json.expo.android.adaptiveIcon.foregroundImage).toBe(
      "./src/assets/adaptive-icon.png",
    );
    // Required pair for adaptive icon to render at all on Android — default fill.
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
    expect(json.expo.android.adaptiveIcon.foregroundImage).toBe(
      "./src/assets/adaptive-icon.png",
    );
  });
});

// ---------- setSplashConfig ----------

describe("setSplashConfig", () => {
  const IMG = "./src/assets/splash-icon.png";

  it("appends expo-splash-screen plugin entry with full options", () => {
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
      imageWidth: 200,
      resizeMode: "contain",
      backgroundColor: "#ff0000",
    });
  });

  it("merges into existing plugin entry preserving unknown options", () => {
    writeAppJson([
      [
        "expo-splash-screen",
        { dark: { backgroundColor: "#000000" }, customField: 42 },
      ],
    ]);
    setSplashConfig(tmp, "#ffffff", IMG);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    const entry = json.expo.plugins[0];
    const opts = entry[1];
    expect(opts.dark).toEqual({ backgroundColor: "#000000" });
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
