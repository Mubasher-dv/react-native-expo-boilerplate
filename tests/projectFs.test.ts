import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertExpoApp,
  detectProjectPm,
  fileExists,
} from "../src/projectFs.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rneb-projfs-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("fileExists", () => {
  it("returns true for an existing file", () => {
    const p = path.join(tmp, "a.txt");
    fs.writeFileSync(p, "");
    expect(fileExists(p)).toBe(true);
  });

  it("returns false for a missing path", () => {
    expect(fileExists(path.join(tmp, "missing"))).toBe(false);
  });
});

describe("assertExpoApp", () => {
  it("throws when package.json absent", () => {
    expect(() => assertExpoApp(tmp)).toThrow(/package\.json/);
  });

  it("throws when expo dep absent", () => {
    fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "x" }));
    expect(() => assertExpoApp(tmp)).toThrow(/expo/i);
  });

  it("passes when package.json has expo in dependencies", () => {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ dependencies: { expo: "^54.0.0" } }),
    );
    expect(() => assertExpoApp(tmp)).not.toThrow();
  });

  it("passes when expo is in devDependencies", () => {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ devDependencies: { expo: "^54.0.0" } }),
    );
    expect(() => assertExpoApp(tmp)).not.toThrow();
  });
});

describe("detectProjectPm", () => {
  it("returns 'yarn' when yarn.lock present", async () => {
    fs.writeFileSync(path.join(tmp, "yarn.lock"), "");
    await expect(detectProjectPm(tmp)).resolves.toBe("yarn");
  });

  it("returns 'npm' when package-lock.json present", async () => {
    fs.writeFileSync(path.join(tmp, "package-lock.json"), "{}");
    await expect(detectProjectPm(tmp)).resolves.toBe("npm");
  });
});
