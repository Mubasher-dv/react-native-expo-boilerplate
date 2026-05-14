import prompts from "prompts";
import { execa } from "execa";
import { log } from "./util.js";

export type PackageManager = "yarn" | "npm";

export type BackendType = "firebase-js" | "firebase-rn" | "supabase" | "custom-backend";

export type Answers = {
  primaryFont: string;
  secondaryFont: string;
  bottomSheet: boolean;
  imagePicker: boolean;
  packageManager: PackageManager;
  backendType: BackendType;
};

const BACKEND_TYPE_VALUES = ["firebase-js", "firebase-rn", "supabase", "custom-backend"] as const;

const STRICT_BOOL_VARS = [
  "EXPO_INCLUDE_BOTTOM_SHEET",
  "EXPO_INCLUDE_IMAGE_PICKER",
] as const;

/**
 * Shape + presence validation of EXPO_* env vars. MUST be called from
 * `src/index.ts` BEFORE `resolveTargetDir` (Phase 1) so invalid or missing
 * input throws BEFORE any fs mutation creates an orphan empty target dir.
 *
 * In non-TTY mode all interactive-prompt vars are required up-front so that
 * the failure is clean (no orphan dir, no partial scaffold).
 *
 * Per PLAN_V5.md Phase 2 step 2 (v5-r6).
 */
export function validateEnvVars(): void {
  const tty = Boolean(process.stdin.isTTY);

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
    if (!tty && (v === undefined || v === "")) {
      throw new Error(
        `${key} is required in non-TTY mode. Set to "0" or "1".`,
      );
    }
  }
  // EXPO_PRIMARY_FONT / EXPO_SECONDARY_FONT accept any string — no shape check,
  // and empty is valid (skips fonts), so no presence check in non-TTY either.
  const bt = process.env.EXPO_BACKEND_TYPE;
  if (bt !== undefined && bt !== "" && !BACKEND_TYPE_VALUES.includes(bt as BackendType)) {
    throw new Error(
      `EXPO_BACKEND_TYPE: expected one of "firebase-js", "firebase-rn", "supabase", "custom-backend", got "${bt}"`,
    );
  }
  if (!tty && (!bt || bt === "")) {
    throw new Error(
      'EXPO_BACKEND_TYPE is required in non-TTY mode. Set to one of "firebase-js", "firebase-rn", "supabase", "custom-backend".',
    );
  }
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
 * Non-TTY + missing backend/bottom-sheet/image-picker → throw. Fonts: env-var first,
 * TTY fallback, else empty (no error — empty primary skips fonts gracefully).
 *
 * Prompt order: backend → fonts → bottom-sheet → image-picker.
 */
export async function gatherAnswers(): Promise<Answers> {
  const tty = Boolean(process.stdin.isTTY);

  // Backend type — asked first; drives template overlay and dep selection.
  let backendType: BackendType;
  const envBackendType = process.env.EXPO_BACKEND_TYPE;
  if (envBackendType && BACKEND_TYPE_VALUES.includes(envBackendType as BackendType)) {
    backendType = envBackendType as BackendType;
  } else if (tty) {
    const btAns = await prompts({
      type: "select",
      name: "backend",
      message: "Backend type?",
      choices: [
        { title: "Firebase", value: "firebase" },
        { title: "Supabase", value: "supabase" },
        { title: "Custom", value: "custom-backend" },
      ],
    });
    if (!btAns.backend || btAns.backend === "custom-backend") {
      backendType = (btAns.backend as BackendType) ?? "custom-backend";
    } else if (btAns.backend === "supabase") {
      backendType = "supabase";
    } else {
      // Firebase — ask which SDK
      const fbAns = await prompts({
        type: "select",
        name: "firebaseSdk",
        message: "Firebase SDK?",
        choices: [
          { title: "Firebase JS SDK (Expo Go compatible)", value: "firebase-js" },
          { title: "React Native Firebase (requires dev client)", value: "firebase-rn" },
        ],
      });
      backendType = (fbAns.firebaseSdk as BackendType) ?? "firebase-js";
    }
  } else {
    throw new Error(
      "Missing required answer and stdin is not a TTY. Set " +
        'EXPO_BACKEND_TYPE to one of "firebase-js", "firebase-rn", "supabase", "custom-backend".',
    );
  }

  // Fonts — env-var first, TTY prompt fallback, else empty (skip).
  let primaryFont: string;
  const envPrimary = process.env.EXPO_PRIMARY_FONT;
  if (envPrimary !== undefined) {
    primaryFont = envPrimary.trim();
  } else if (tty) {
    const ans = await prompts({
      type: "text",
      name: "primaryFont",
      message: "Primary font family (e.g. Inter; empty = skip fonts)",
      initial: "",
    });
    primaryFont = String(ans.primaryFont ?? "").trim();
  } else {
    primaryFont = "";
  }

  let secondaryFont = "";
  if (primaryFont) {
    const envSecondary = process.env.EXPO_SECONDARY_FONT;
    if (envSecondary !== undefined) {
      secondaryFont = envSecondary.trim();
    } else if (tty) {
      const ans = await prompts({
        type: "text",
        name: "secondaryFont",
        message: "Secondary font family (e.g. Sansita; empty = primary only)",
        initial: "",
      });
      secondaryFont = String(ans.secondaryFont ?? "").trim();
    }
  }

  // Bottom-sheet + image-picker — env-var first, TTY fallback.
  const envBottomSheet = readBoolEnv("EXPO_INCLUDE_BOTTOM_SHEET");
  const envImagePicker = readBoolEnv("EXPO_INCLUDE_IMAGE_PICKER");

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

  return { primaryFont, secondaryFont, bottomSheet, imagePicker, packageManager, backendType };
}
