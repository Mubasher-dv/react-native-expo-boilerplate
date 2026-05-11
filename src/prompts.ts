import prompts from "prompts";
import { execa } from "execa";
import { log } from "./util.js";

export type PackageManager = "yarn" | "npm";

export type Answers = {
  primaryFont: string;
  secondaryFont: string;
  bottomSheet: boolean;
  imagePicker: boolean;
  packageManager: PackageManager;
};

const STRICT_BOOL_VARS = [
  "EXPO_INCLUDE_BOTTOM_SHEET",
  "EXPO_INCLUDE_IMAGE_PICKER",
] as const;

/**
 * SHAPE-only validation of EXPO_* env vars. MUST be called from `src/index.ts`
 * BEFORE `resolveTargetDir` (Phase 1) so invalid input throws BEFORE any fs
 * mutation creates an orphan empty target dir.
 *
 * Per PLAN_V5.md Phase 2 step 2 (v5-r6).
 */
export function validateEnvVars(): void {
  const pm = process.env.EXPO_PACKAGE_MANAGER;
  if (pm !== undefined && pm !== "" && pm !== "yarn" && pm !== "npm") {
    throw new Error(
      `EXPO_PACKAGE_MANAGER: expected "yarn" or "npm", got "${pm}"`,
    );
  }
  for (const key of STRICT_BOOL_VARS) {
    const v = process.env[key];
    if (v !== undefined && v !== "" && v !== "0" && v !== "1") {
      throw new Error(`${key}: expected "0" or "1", got "${v}"`);
    }
  }
  // EXPO_PRIMARY_FONT / EXPO_SECONDARY_FONT accept any string — no shape check.
}

function readBoolEnv(key: string): boolean | undefined {
  const v = process.env[key];
  if (v === undefined || v === "") return undefined;
  return v === "1";
}

async function probeBin(bin: string, timeout = 3000): Promise<boolean> {
  try {
    const result = await execa(bin, ["--version"], { timeout, reject: false });
    return result.exitCode === 0;
  } catch {
    // ENOENT, TimeoutError, etc.
    return false;
  }
}

/**
 * Resolve the package manager once and propagate the choice through every
 * later install step so we never end up with both yarn.lock + package-lock.json.
 *
 * Order:
 *   1. EXPO_PACKAGE_MANAGER override (already shape-validated by validateEnvVars).
 *   2. yarn --version probe (3s timeout) → "yarn".
 *   3. npm --version probe (3s timeout) → "npm".
 *   4. Both missing → throw EARLY (before Phase 3 mutates fs).
 */
export async function detectPackageManager(): Promise<PackageManager> {
  const override = process.env.EXPO_PACKAGE_MANAGER;
  if (override === "yarn" || override === "npm") return override;
  if (await probeBin("yarn")) return "yarn";
  if (await probeBin("npm")) return "npm";
  throw new Error(
    "Neither yarn nor npm available — install one before proceeding",
  );
}

/**
 * Gather all answers — env vars take precedence; missing values prompted from TTY.
 * Non-TTY + missing answer → throw.
 *
 * NOTE: Fonts are intentionally hard-coded empty (Deviation #9). The generator
 * empty-path produces `Fonts = {} as const` + drops `useFonts` sentinels →
 * generated app has no font wiring. EXPO_PRIMARY_FONT / EXPO_SECONDARY_FONT
 * env vars are silently ignored (still shape-validated by validateEnvVars).
 */
export async function gatherAnswers(): Promise<Answers> {
  // Fonts disabled — see Deviation #9.
  const primaryFont = "";
  const secondaryFont = "";

  // Only bottom-sheet + image-picker remain prompt-driven.
  const envBottomSheet = readBoolEnv("EXPO_INCLUDE_BOTTOM_SHEET");
  const envImagePicker = readBoolEnv("EXPO_INCLUDE_IMAGE_PICKER");

  const tty = Boolean(process.stdin.isTTY);

  const need = envBottomSheet === undefined || envImagePicker === undefined;

  if (need && !tty) {
    throw new Error(
      "Missing required answers and stdin is not a TTY. Set " +
        'EXPO_INCLUDE_BOTTOM_SHEET + EXPO_INCLUDE_IMAGE_PICKER ("0" or "1").',
    );
  }

  let bottomSheet: boolean;
  if (envBottomSheet !== undefined) {
    bottomSheet = envBottomSheet;
  } else {
    const ans = await prompts({
      type: "confirm",
      name: "bottomSheet",
      message: "Include bottom-sheet support?",
      initial: false,
    });
    bottomSheet = Boolean(ans.bottomSheet);
  }

  let imagePicker: boolean;
  if (envImagePicker !== undefined) {
    imagePicker = envImagePicker;
  } else {
    const ans = await prompts({
      type: "confirm",
      name: "imagePicker",
      message: "Include image-picker support?",
      initial: false,
    });
    imagePicker = Boolean(ans.imagePicker);
  }

  const packageManager = await detectPackageManager();
  log.info(`Package manager: ${packageManager}`);

  return { primaryFont, secondaryFont, bottomSheet, imagePicker, packageManager };
}
