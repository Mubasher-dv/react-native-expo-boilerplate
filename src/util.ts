import fs from "node:fs";
import path from "node:path";
import kleur from "kleur";

export function isDirEmpty(dir: string): boolean {
  try {
    const entries = fs.readdirSync(dir);
    // Treat directories with only dot-files (e.g. .git) as non-empty too — be strict.
    return entries.length === 0;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw err;
  }
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function dirExists(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function fileExists(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

type LogLevel = "info" | "warn" | "error" | "success" | "step";

export const log = {
  info: (msg: string) => console.log(kleur.cyan("ℹ"), msg),
  warn: (msg: string) => console.warn(kleur.yellow("⚠"), msg),
  error: (msg: string) => console.error(kleur.red("✖"), msg),
  success: (msg: string) => console.log(kleur.green("✔"), msg),
  step: (msg: string) => console.log(kleur.magenta("›"), msg),
  raw: (msg: string) => console.log(msg),
};

export function basename(p: string): string {
  return path.basename(p);
}

export function joinCwd(arg: string): string {
  return path.join(process.cwd(), arg);
}
