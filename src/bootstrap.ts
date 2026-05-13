import path from "node:path";
import prompts from "prompts";
import { dirExists, ensureDir, fileExists, isDirEmpty } from "./util.js";

export type ResolvedTarget = {
  /** Absolute path to the directory the scaffolder will write into. */
  dir: string;
  /** App name (slug-friendly) — basename of `dir`, or user-supplied name when `arg === "."`. */
  name: string;
};

/**
 * Resolve the target directory + app name from a positional CLI arg.
 *
 * Modes (per PLAN_V5.md Phase 1):
 *   - `arg === undefined | ""` → prompt for name; recurse with answer.
 *   - `arg === "."`            → use cwd. Throws if `package.json` already present.
 *   - `arg` non-empty          → join with cwd, mkdir -p; throws if non-empty.
 *
 * Hard rejects (security + clarity):
 *   - Absolute paths (Phase 1 step 2).
 *   - `..`-traversal (Phase 1 step 2).
 */
export async function resolveTargetDir(arg?: string): Promise<ResolvedTarget> {
  // Empty-arg branch — prompt then recurse.
  if (arg === undefined || arg === "") {
    if (!process.stdin.isTTY) {
      throw new Error(
        'No app name provided and stdin is not a TTY. Pass a directory: `react-native-expo-boilerplate my-app`.',
      );
    }
    const ans = await prompts({
      type: "text",
      name: "name",
      message: "App name?",
      validate: (v: string) => (v.trim() === "" ? "Required" : true),
    });
    if (!ans.name) throw new Error("Aborted.");
    return resolveTargetDir(String(ans.name).trim());
  }

  // Reject absolute paths + ..-traversal BEFORE any path math.
  if (path.isAbsolute(arg)) {
    throw new Error(
      `Absolute paths not allowed: "${arg}". Use a directory name relative to cwd.`,
    );
  }
  if (arg.split(/[/\\]/).some((seg) => seg === "..")) {
    throw new Error(
      `Path traversal not allowed: "${arg}". Use a name relative to cwd.`,
    );
  }

  // Current-dir branch.
  if (arg === ".") {
    const cwd = process.cwd();
    if (fileExists(path.join(cwd, "package.json"))) {
      throw new Error(
        `Refusing to scaffold into "." — package.json already present in ${cwd}.`,
      );
    }
    return { dir: cwd, name: path.basename(cwd) };
  }

  // Named-dir branch.
  const dir = path.join(process.cwd(), arg);
  if (dirExists(dir) && !isDirEmpty(dir)) {
    throw new Error(`Target directory not empty: ${dir}`);
  }
  ensureDir(dir);
  return { dir, name: path.basename(dir) };
}
