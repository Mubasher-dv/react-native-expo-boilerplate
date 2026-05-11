import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureImagePickerPlugin, spliceMediaConstants } from "../src/add.js";

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
