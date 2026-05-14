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
  "EXPO_BACKEND_TYPE",
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

describe("validateEnvVars — shape checks (TTY mode)", () => {
  beforeEach(() => {
    // Shape tests run as TTY so presence checks don't interfere.
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
  });
  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: undefined });
  });

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

  it("all-empty env + TTY → no throw", () => {
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

  it('EXPO_BACKEND_TYPE="invalid" → throws', () => {
    process.env.EXPO_BACKEND_TYPE = "invalid";
    expect(() => validateEnvVars()).toThrow(
      /EXPO_BACKEND_TYPE.*expected one of/,
    );
  });

  it('EXPO_BACKEND_TYPE="firebase-js" → no throw', () => {
    process.env.EXPO_BACKEND_TYPE = "firebase-js";
    expect(() => validateEnvVars()).not.toThrow();
  });
});

describe("validateEnvVars — non-TTY presence checks", () => {
  beforeEach(() => {
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: false });
  });
  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: undefined });
  });

  it("non-TTY + missing EXPO_INCLUDE_BOTTOM_SHEET → throws before fs", () => {
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
    process.env.EXPO_BACKEND_TYPE = "custom-backend";
    expect(() => validateEnvVars()).toThrow(/EXPO_INCLUDE_BOTTOM_SHEET.*required/);
  });

  it("non-TTY + missing EXPO_INCLUDE_IMAGE_PICKER → throws before fs", () => {
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "0";
    process.env.EXPO_BACKEND_TYPE = "custom-backend";
    expect(() => validateEnvVars()).toThrow(/EXPO_INCLUDE_IMAGE_PICKER.*required/);
  });

  it("non-TTY + missing EXPO_BACKEND_TYPE → throws before fs", () => {
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "0";
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
    expect(() => validateEnvVars()).toThrow(/EXPO_BACKEND_TYPE.*required/);
  });

  it("non-TTY + all required vars set → no throw", () => {
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "0";
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
    process.env.EXPO_BACKEND_TYPE = "supabase";
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
  it("env-all-set → no prompts called; fonts read from env vars", async () => {
    process.env.EXPO_PRIMARY_FONT = "Inter";
    process.env.EXPO_SECONDARY_FONT = "Roboto";
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "1";
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
    process.env.EXPO_PACKAGE_MANAGER = "yarn";
    process.env.EXPO_BACKEND_TYPE = "supabase";
    const ans = await gatherAnswers();
    expect(ans).toEqual({
      primaryFont: "Inter",
      secondaryFont: "Roboto",
      bottomSheet: true,
      imagePicker: false,
      packageManager: "yarn",
      backendType: "supabase",
    });
    expect(promptsMock).not.toHaveBeenCalled();
  });

  it("EXPO_BACKEND_TYPE=firebase-rn → backendType resolved from env, no prompt", async () => {
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "0";
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
    process.env.EXPO_PACKAGE_MANAGER = "yarn";
    process.env.EXPO_BACKEND_TYPE = "firebase-rn";
    const ans = await gatherAnswers();
    expect(ans.backendType).toBe("firebase-rn");
    expect(promptsMock).not.toHaveBeenCalled();
  });

  it("no EXPO_BACKEND_TYPE + non-TTY → throws", async () => {
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "0";
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
    process.env.EXPO_PACKAGE_MANAGER = "yarn";
    // EXPO_BACKEND_TYPE not set
    await expect(gatherAnswers()).rejects.toThrow(/EXPO_BACKEND_TYPE/);
  });

  it("missing bottom-sheet/image-picker + non-TTY → throws", async () => {
    process.env.EXPO_PACKAGE_MANAGER = "npm"; // Skip PM probe path.
    await expect(gatherAnswers()).rejects.toThrow(/not a TTY/);
  });
});

describe("gatherAnswers — TTY backend prompt", () => {
  beforeEach(() => {
    // Override to TTY for this suite.
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "0";
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
    process.env.EXPO_PACKAGE_MANAGER = "yarn";
    // Default fallback for any un-consumed prompt call.
    promptsMock.mockResolvedValue({ primaryFont: "" });
  });

  // Backend prompt is the FIRST question; font prompt follows.
  // Firebase triggers a second SDK sub-prompt; Supabase/Custom do not.

  it("TTY select supabase → backendType=supabase, no sub-prompt", async () => {
    promptsMock
      .mockResolvedValueOnce({ backend: "supabase" }) // step 1
      .mockResolvedValueOnce({ primaryFont: "" });     // font
    const ans = await gatherAnswers();
    expect(ans.backendType).toBe("supabase");
  });

  it("TTY select custom-backend → backendType=custom-backend, no sub-prompt", async () => {
    promptsMock
      .mockResolvedValueOnce({ backend: "custom-backend" })
      .mockResolvedValueOnce({ primaryFont: "" });
    const ans = await gatherAnswers();
    expect(ans.backendType).toBe("custom-backend");
  });

  it("TTY select firebase → sub-prompt → firebase-js", async () => {
    promptsMock
      .mockResolvedValueOnce({ backend: "firebase" })       // step 1
      .mockResolvedValueOnce({ firebaseSdk: "firebase-js" }) // step 2
      .mockResolvedValueOnce({ primaryFont: "" });            // font
    const ans = await gatherAnswers();
    expect(ans.backendType).toBe("firebase-js");
  });

  it("TTY select firebase → sub-prompt → firebase-rn", async () => {
    promptsMock
      .mockResolvedValueOnce({ backend: "firebase" })
      .mockResolvedValueOnce({ firebaseSdk: "firebase-rn" })
      .mockResolvedValueOnce({ primaryFont: "" });
    const ans = await gatherAnswers();
    expect(ans.backendType).toBe("firebase-rn");
  });

  it("TTY cancel on backend prompt (returns {}) → defaults to custom-backend", async () => {
    promptsMock
      .mockResolvedValueOnce({})                   // Ctrl-C on step 1
      .mockResolvedValueOnce({ primaryFont: "" });
    const ans = await gatherAnswers();
    expect(ans.backendType).toBe("custom-backend");
  });

  it("TTY cancel on firebase sub-prompt → defaults to firebase-js", async () => {
    promptsMock
      .mockResolvedValueOnce({ backend: "firebase" })
      .mockResolvedValueOnce({})                   // Ctrl-C on step 2
      .mockResolvedValueOnce({ primaryFont: "" });
    const ans = await gatherAnswers();
    expect(ans.backendType).toBe("firebase-js");
  });
});

describe("gatherAnswers font prompts", () => {
  const origEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...origEnv };
    vi.resetModules();
  });

  it("reads EXPO_PRIMARY_FONT + EXPO_SECONDARY_FONT in non-TTY mode", async () => {
    process.env.EXPO_PRIMARY_FONT = "Inter";
    process.env.EXPO_SECONDARY_FONT = "Sansita";
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "0";
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
    process.env.EXPO_PACKAGE_MANAGER = "npm";
    process.env.EXPO_BACKEND_TYPE = "custom-backend";
    vi.resetModules();
    const { gatherAnswers } = await import("../src/prompts.js");
    const answers = await gatherAnswers();
    expect(answers.primaryFont).toBe("Inter");
    expect(answers.secondaryFont).toBe("Sansita");
  });

  it("empty EXPO_PRIMARY_FONT + non-TTY → empty primary, skip secondary prompt", async () => {
    process.env.EXPO_PRIMARY_FONT = "";
    delete process.env.EXPO_SECONDARY_FONT;
    process.env.EXPO_INCLUDE_BOTTOM_SHEET = "0";
    process.env.EXPO_INCLUDE_IMAGE_PICKER = "0";
    process.env.EXPO_PACKAGE_MANAGER = "npm";
    process.env.EXPO_BACKEND_TYPE = "custom-backend";
    vi.resetModules();
    const { gatherAnswers } = await import("../src/prompts.js");
    const answers = await gatherAnswers();
    expect(answers.primaryFont).toBe("");
    expect(answers.secondaryFont).toBe("");
  });
});
