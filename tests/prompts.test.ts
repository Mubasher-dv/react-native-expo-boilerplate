import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// `execa` is mocked at the module level so PM-detection tests can script
// outcomes (success, ENOENT, timeout) deterministically without touching PATH.
vi.mock("execa", () => ({
  execa: vi.fn(),
}));

vi.mock("prompts", () => ({
  default: vi.fn(),
}));

import { execa } from "execa";
import promptsDefault from "prompts";
import {
  detectPackageManager,
  gatherAnswers,
  validateEnvVars,
} from "../src/prompts.js";

const execaMock = execa as unknown as ReturnType<typeof vi.fn>;
const promptsMock = promptsDefault as unknown as ReturnType<typeof vi.fn>;

const ENV_KEYS = [
  "EXPO_PRIMARY_FONT",
  "EXPO_SECONDARY_FONT",
  "EXPO_INCLUDE_BOTTOM_SHEET",
  "EXPO_INCLUDE_IMAGE_PICKER",
  "EXPO_PACKAGE_MANAGER",
];

let savedEnv: Record<string, string | undefined>;
let savedIsTTY: boolean | undefined;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  savedIsTTY = process.stdin.isTTY;
  // Force non-TTY by default; individual tests can opt back in.
  Object.defineProperty(process.stdin, "isTTY", {
    configurable: true,
    value: false,
  });
  execaMock.mockReset();
  promptsMock.mockReset();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  Object.defineProperty(process.stdin, "isTTY", {
    configurable: true,
    value: savedIsTTY,
  });
});

// ---------- validateEnvVars (v5-r6 pre-flight) ----------

describe("validateEnvVars", () => {
  it("EXPO_PACKAGE_MANAGER=pnpm → throws", () => {
    process.env.EXPO_PACKAGE_MANAGER = "pnpm";
    expect(() => validateEnvVars()).toThrow(/expected "yarn" or "npm"/);
  });

  it('EXPO_INCLUDE_BOTTOM_SHEET="yes" → throws', () => {
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "yes";
    expect(() => validateEnvVars()).toThrow(
      /EXPO_INCLUDE_BOTTOM_SHEET.*expected "0" or "1"/,
    );
  });

  it('EXPO_INCLUDE_IMAGE_PICKER="true" → throws (strict 0/1)', () => {
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "true";
    expect(() => validateEnvVars()).toThrow(
      /EXPO_INCLUDE_IMAGE_PICKER.*expected "0" or "1"/,
    );
  });

  it("all-empty env → no throw", () => {
    expect(() => validateEnvVars()).not.toThrow();
  });

  it("valid yarn / 0 / 1 / strings → no throw", () => {
    process.env.EXPO_PACKAGE_MANAGER = "yarn";
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "0";
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "1";
    process.env.EXPO_PRIMARY_FONT = "Inter";
    process.env.EXPO_SECONDARY_FONT = "";
    expect(() => validateEnvVars()).not.toThrow();
  });
});

// ---------- detectPackageManager ----------

describe("detectPackageManager", () => {
  it('EXPO_PACKAGE_MANAGER="yarn" override → "yarn" without probing', async () => {
    process.env.EXPO_PACKAGE_MANAGER = "yarn";
    const pm = await detectPackageManager();
    expect(pm).toBe("yarn");
    expect(execaMock).not.toHaveBeenCalled();
  });

  it('EXPO_PACKAGE_MANAGER="npm" override → "npm"', async () => {
    process.env.EXPO_PACKAGE_MANAGER = "npm";
    const pm = await detectPackageManager();
    expect(pm).toBe("npm");
  });

  it("yarn probe succeeds → yarn", async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "1.22.22" });
    const pm = await detectPackageManager();
    expect(pm).toBe("yarn");
    expect(execaMock).toHaveBeenCalledTimes(1);
  });

  it("yarn ENOENT → npm probe succeeds → npm", async () => {
    execaMock
      .mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))
      .mockResolvedValueOnce({ exitCode: 0, stdout: "10.0.0" });
    const pm = await detectPackageManager();
    expect(pm).toBe("npm");
    expect(execaMock).toHaveBeenCalledTimes(2);
  });

  it("yarn TimeoutError → fallback to npm", async () => {
    execaMock
      .mockRejectedValueOnce(
        Object.assign(new Error("Command timed out"), { name: "TimeoutError" }),
      )
      .mockResolvedValueOnce({ exitCode: 0, stdout: "10.0.0" });
    const pm = await detectPackageManager();
    expect(pm).toBe("npm");
  });

  it("yarn AND npm both ENOENT → throws early", async () => {
    execaMock
      .mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))
      .mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    await expect(detectPackageManager()).rejects.toThrow(
      /Neither yarn nor npm available/,
    );
  });
});

// ---------- gatherAnswers ----------

describe("gatherAnswers", () => {
  it("env-all-set → no prompts called; fonts forced empty (Deviation #9)", async () => {
    // EXPO_PRIMARY_FONT / EXPO_SECONDARY_FONT silently ignored — fonts disabled.
    process.env.EXPO_PRIMARY_FONT = "Inter";
    process.env.EXPO_SECONDARY_FONT = "Roboto";
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "1";
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
    process.env.EXPO_PACKAGE_MANAGER = "yarn";
    const ans = await gatherAnswers();
    expect(ans).toEqual({
      primaryFont: "",
      secondaryFont: "",
      bottomSheet: true,
      imagePicker: false,
      packageManager: "yarn",
    });
    expect(promptsMock).not.toHaveBeenCalled();
  });

  it("font env vars are no-ops (always empty)", async () => {
    process.env.EXPO_PRIMARY_FONT = "Inter";
    process.env.EXPO_SECONDARY_FONT = "Roboto";
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "0";
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
    process.env.EXPO_PACKAGE_MANAGER = "npm";
    const ans = await gatherAnswers();
    expect(ans.primaryFont).toBe("");
    expect(ans.secondaryFont).toBe("");
  });

  it("missing bottom-sheet/image-picker + non-TTY → throws", async () => {
    process.env.EXPO_PACKAGE_MANAGER = "npm"; // Skip PM probe path.
    await expect(gatherAnswers()).rejects.toThrow(/not a TTY/);
  });
});
