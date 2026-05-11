import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveTargetDir } from "../src/bootstrap.js";

// Each test runs inside its own tmp dir so cwd-sensitive logic is reproducible.
let prevCwd: string;
let tmp: string;

beforeEach(() => {
  prevCwd = process.cwd();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpx-test-"));
  process.chdir(tmp);
});

afterEach(() => {
  process.chdir(prevCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("resolveTargetDir", () => {
  it('arg === "." in empty cwd → returns cwd + basename', async () => {
    const realTmp = fs.realpathSync(tmp);
    process.chdir(realTmp);
    const result = await resolveTargetDir(".");
    expect(result.dir).toBe(realTmp);
    expect(result.name).toBe(path.basename(realTmp));
  });

  it('arg === "." with package.json present → throws', async () => {
    fs.writeFileSync(path.join(tmp, "package.json"), "{}");
    await expect(resolveTargetDir(".")).rejects.toThrow(/Refusing to scaffold/);
  });

  it("named dir → creates dir, returns absolute path + basename", async () => {
    const result = await resolveTargetDir("my-app");
    expect(result.name).toBe("my-app");
    expect(fs.existsSync(result.dir)).toBe(true);
    expect(path.basename(result.dir)).toBe("my-app");
  });

  it("named dir with existing non-empty contents → throws", async () => {
    const dest = path.join(tmp, "occupied");
    fs.mkdirSync(dest);
    fs.writeFileSync(path.join(dest, "marker"), "x");
    await expect(resolveTargetDir("occupied")).rejects.toThrow(/not empty/);
  });

  it("absolute path → throws", async () => {
    await expect(resolveTargetDir("/abs/path")).rejects.toThrow(
      /Absolute paths not allowed/,
    );
  });

  it("../sibling → throws", async () => {
    await expect(resolveTargetDir("../sibling")).rejects.toThrow(
      /Path traversal not allowed/,
    );
  });

  it("nested ../ → throws", async () => {
    await expect(resolveTargetDir("foo/../bar")).rejects.toThrow(
      /Path traversal not allowed/,
    );
  });
});
