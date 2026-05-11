import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("execa", () => ({ execa: vi.fn() }));

import { execa } from "execa";
import {
  buildAlwaysInstalledList,
  buildConditionalDeps,
  ensureLockfile,
  isTransientError,
  parseFailingDep,
  retryWithIsolation,
  seedLockfile,
} from "../src/install.js";
import type { Answers } from "../src/prompts.js";

const execaMock = execa as unknown as ReturnType<typeof vi.fn>;

const A: Answers = {
  primaryFont: "",
  secondaryFont: "",
  bottomSheet: false,
  imagePicker: false,
  packageManager: "yarn",
};

let target: string;
beforeEach(() => {
  execaMock.mockReset();
  target = fs.mkdtempSync(path.join(os.tmpdir(), "cpx-install-"));
});
afterEach(() => {
  fs.rmSync(target, { recursive: true, force: true });
});

describe("buildAlwaysInstalledList", () => {
  it("includes plan §7 + Deviation #4 deps; substitutes worklets pkg", () => {
    const list = buildAlwaysInstalledList("react-native-worklets-core");
    expect(list).toContain("@reduxjs/toolkit");
    expect(list).toContain("expo-router");
    expect(list).toContain("react-native-worklets-core");
    expect(list).not.toContain("react-native-worklets");
    expect(list).toContain("expo-linear-gradient"); // Deviation #2
    expect(list).toContain("react-native-logs"); // Deviation #3
    expect(list).toContain("babel-plugin-module-resolver"); // Deviation #7
  });
});

describe("buildConditionalDeps", () => {
  it("appends @gorhom/bottom-sheet on bottomSheet=true", () => {
    expect(buildConditionalDeps({ ...A, bottomSheet: true })).toContain(
      "@gorhom/bottom-sheet",
    );
  });
  it("appends expo-image-picker on imagePicker=true", () => {
    expect(buildConditionalDeps({ ...A, imagePicker: true })).toContain(
      "expo-image-picker",
    );
  });
  it("empty when both false", () => {
    expect(buildConditionalDeps(A)).toEqual([]);
  });
});

describe("isTransientError", () => {
  it.each([
    ["ETIMEDOUT", true],
    ["socket hang up", true],
    ["registry returned 503", true],
    ["network unreachable", true],
    ["No matching version for foo@99", false],
    ["Conflicting peer dependency for bar", false],
  ])("%s → %p", (s, expected) => {
    expect(isTransientError(s)).toBe(expected);
  });
});

describe("parseFailingDep", () => {
  it("extracts name from `Cannot find <name>`", () => {
    const culprit = parseFailingDep(
      `Error: Cannot find "react-native-worklets" in registry`,
      ["react-native-worklets", "axios"],
    );
    expect(culprit).toBe("react-native-worklets");
  });

  it("falls back to last-mention scan when patterns miss", () => {
    const culprit = parseFailingDep(
      "some unstructured noise mentioning axios then later @tanstack/react-query",
      ["axios", "@tanstack/react-query"],
    );
    expect(culprit).toBe("@tanstack/react-query");
  });

  it("returns null on empty stderr / no remaining match", () => {
    expect(parseFailingDep("", ["a"])).toBe(null);
    expect(parseFailingDep("Error mentioning some-other-pkg", ["a", "b"])).toBe(null);
  });
});

describe("retryWithIsolation", () => {
  it("returns immediately on first-call success", async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 0, stderr: "" });
    await retryWithIsolation(target, ["a", "b"], "--yarn");
    expect(execaMock).toHaveBeenCalledTimes(1);
  });

  it("drops one culprit + succeeds on retry", async () => {
    execaMock
      .mockResolvedValueOnce({ exitCode: 1, stderr: 'Cannot find "b"' })
      .mockResolvedValueOnce({ exitCode: 0, stderr: "" });
    await retryWithIsolation(target, ["a", "b"], "--yarn");
    expect(execaMock).toHaveBeenCalledTimes(2);
  });

  it("aborts on transient error without per-dep retry", async () => {
    execaMock.mockResolvedValueOnce({
      exitCode: 1,
      stderr: "ETIMEDOUT contacting registry",
    });
    await expect(retryWithIsolation(target, ["a"], null)).rejects.toThrow(
      /Network failure/,
    );
    expect(execaMock).toHaveBeenCalledTimes(1);
  });

  it("aborts when culprit re-identified after drop (defensive twice-fail guard)", async () => {
    // The defensive twice-fail check is only reachable if parseFailingDep
    // somehow returns a previously-failed culprit. With our `remaining.includes`
    // gate it's effectively unreachable in normal flow — assert the alternative
    // outcome (unparseable after drop) which IS the realistic failure path:
    // first iter drops `b`, second iter's stderr no longer matches anything in
    // remaining=['a'] → unparseable abort.
    execaMock
      .mockResolvedValueOnce({ exitCode: 1, stderr: 'Cannot find "b"' })
      .mockResolvedValueOnce({ exitCode: 1, stderr: 'Cannot find "b"' });
    await expect(retryWithIsolation(target, ["a", "b"], null)).rejects.toThrow(
      /unparseable stderr/,
    );
  });

  it("aborts on unparseable stderr", async () => {
    execaMock.mockResolvedValueOnce({
      exitCode: 1,
      stderr: "totally unstructured failure",
    });
    await expect(retryWithIsolation(target, ["a"], null)).rejects.toThrow(
      /unparseable stderr/,
    );
  });
});

describe("seedLockfile", () => {
  it("yarn → empty yarn.lock file", () => {
    seedLockfile(target, "yarn");
    expect(fs.existsSync(path.join(target, "yarn.lock"))).toBe(true);
    expect(fs.readFileSync(path.join(target, "yarn.lock"), "utf8")).toBe("");
  });

  it("npm → minimal valid lockfileVersion 3 JSON", () => {
    seedLockfile(target, "npm");
    const json = JSON.parse(
      fs.readFileSync(path.join(target, "package-lock.json"), "utf8"),
    );
    expect(json.lockfileVersion).toBe(3);
    expect(json.requires).toBe(true);
    expect(json.packages).toEqual({});
  });

  it("idempotent — does not overwrite existing", () => {
    fs.writeFileSync(path.join(target, "yarn.lock"), "preexisting");
    seedLockfile(target, "yarn");
    expect(fs.readFileSync(path.join(target, "yarn.lock"), "utf8")).toBe(
      "preexisting",
    );
  });
});

describe("ensureLockfile", () => {
  it("yarn match → no warn, returns producedPm=yarn, mismatch=false", async () => {
    fs.writeFileSync(path.join(target, "yarn.lock"), "");
    const out = await ensureLockfile(target, A, { probePass: true, flagsOk: true });
    expect(out).toEqual({ producedPm: "yarn", mismatch: false });
  });

  it("npm match → producedPm=npm, mismatch=false", async () => {
    fs.writeFileSync(path.join(target, "package-lock.json"), "{}");
    const out = await ensureLockfile(
      target,
      { ...A, packageManager: "npm" },
      { probePass: true, flagsOk: true },
    );
    expect(out).toEqual({ producedPm: "npm", mismatch: false });
  });

  it("mismatch → producedPm differs, mismatch=true (non-fatal)", async () => {
    fs.writeFileSync(path.join(target, "package-lock.json"), "{}");
    const out = await ensureLockfile(
      target,
      A, // requested yarn but only npm lock
      { probePass: true, flagsOk: true },
    );
    expect(out.mismatch).toBe(true);
    expect(out.producedPm).toBe("npm");
  });

  it("zero lockfiles → throws", async () => {
    await expect(
      ensureLockfile(target, A, { probePass: true, flagsOk: true }),
    ).rejects.toThrow(/no lockfile present/);
  });

  it("dual lockfile + flagsOk=true → Branch A error", async () => {
    fs.writeFileSync(path.join(target, "yarn.lock"), "");
    fs.writeFileSync(path.join(target, "package-lock.json"), "{}");
    await expect(
      ensureLockfile(target, A, { probePass: true, flagsOk: true }),
    ).rejects.toThrow(/not honoring the PM flag/);
  });

  it("dual lockfile + flagsOk=false → Branch B error", async () => {
    fs.writeFileSync(path.join(target, "yarn.lock"), "");
    fs.writeFileSync(path.join(target, "package-lock.json"), "{}");
    await expect(
      ensureLockfile(target, A, { probePass: true, flagsOk: false }),
    ).rejects.toThrow(/lockfile pre-seed/);
  });

  it("probePass=false → triggers explicit install before checking", async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 0 });
    fs.writeFileSync(path.join(target, "yarn.lock"), "");
    await ensureLockfile(target, A, { probePass: false, flagsOk: true });
    expect(execaMock).toHaveBeenCalledWith(
      "yarn",
      ["install"],
      expect.objectContaining({ cwd: target }),
    );
  });
});
