// Tarball-direct Google Fonts installer. Pure read-side on the npm registry —
// never mutates user package.json / lockfile. Sidecar (.codingpixel-fonts.json)
// at src/assets/fonts/ is the single source of truth for installed state.
//
// Module-import policy: this file imports only from ./projectFs.js + node
// stdlib + execa + tar + node:https. NEVER from ./add.js — keeps the
// fonts <-> splash coordination cycle-safe.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import * as tar from "tar";
import { execa } from "execa";
import { log } from "./util.js";
import { buildMarkerBlockBody } from "./fonts.js";
import { hasExpoSplashScreenDep } from "./projectFs.js";

export type Variant = {
  /** Google variant token, e.g. "400", "regular", "700italic". */
  google: string;
  /** Enum key emitted in fonts.ts. */
  enumKey: string;
  /** Filename suffix, e.g. "-Bold". */
  suffix: string;
};

export type InstalledFamily = {
  /** Display name from metadata.json, e.g. "Open Sans". */
  displayName: string;
  /** Filename-safe form, e.g. "OpenSans". */
  fileBase: string;
  /** Variants present after install + map intersection. */
  variants: Variant[];
};

export type FontsSidecar = {
  schemaVersion: 1;
  markerSyntax: "codingpixel:fonts";
  primary: InstalledFamily | null;
  secondary: InstalledFamily | null;
};

export class UnknownFontError extends Error {
  constructor(family: string) {
    super(
      `Unknown font "${family}". @expo-google-fonts/${normalizeFamily(family)} not found on npm. ` +
        `Check spelling at https://fonts.google.com (names are case-sensitive: "Open Sans" not "open sans"). ` +
        `@expo-google-fonts covers every OFL/Apache family in the Google Fonts catalog.`,
    );
    this.name = "UnknownFontError";
  }
}

export class NoMappableVariantsError extends Error {
  constructor(family: string, available: string[]) {
    super(
      `Font "${family}" ships only variants [${available.join(", ")}]. None map to the 9-key scheme ` +
        `(THIN/EXTRA_LIGHT/LIGHT/REGULAR/MEDIUM/SEMI_BOLD/BOLD/EXTRA_BOLD/ITALIC). ` +
        `Edit src/ui/theme/fonts.ts manually if you need other variants.`,
    );
    this.name = "NoMappableVariantsError";
  }
}

export class NetworkError extends Error {
  constructor(cause: string) {
    super(`Cannot reach npm registry — check your network connection and try again. (Underlying error: ${cause})`);
    this.name = "NetworkError";
  }
}

type VariantMeta = { enumKey: string; suffix: string; variantDir: string };

/**
 * Single source of truth for Google variant tokens → enum key + filename
 * suffix + tarball internal dir name. 11 entries (9 enum keys + 'regular'/'400'
 * + 'italic'/'400italic' aliases that map to REGULAR/ITALIC respectively).
 */
export const VARIANT_MAP: Map<string, VariantMeta> = new Map([
  ["100", { enumKey: "THIN", suffix: "-Thin", variantDir: "100Thin" }],
  ["200", { enumKey: "EXTRA_LIGHT", suffix: "-ExtraLight", variantDir: "200ExtraLight" }],
  ["300", { enumKey: "LIGHT", suffix: "-Light", variantDir: "300Light" }],
  ["regular", { enumKey: "REGULAR", suffix: "-Regular", variantDir: "400Regular" }],
  ["400", { enumKey: "REGULAR", suffix: "-Regular", variantDir: "400Regular" }],
  ["500", { enumKey: "MEDIUM", suffix: "-Medium", variantDir: "500Medium" }],
  ["600", { enumKey: "SEMI_BOLD", suffix: "-SemiBold", variantDir: "600SemiBold" }],
  ["700", { enumKey: "BOLD", suffix: "-Bold", variantDir: "700Bold" }],
  ["800", { enumKey: "EXTRA_BOLD", suffix: "-ExtraBold", variantDir: "800ExtraBold" }],
  ["italic", { enumKey: "ITALIC", suffix: "-Italic", variantDir: "400Regular_Italic" }],
  ["400italic", { enumKey: "ITALIC", suffix: "-Italic", variantDir: "400Regular_Italic" }],
]);

/**
 * Lowercase + trim + replace whitespace runs with single hyphen. Used for
 * `@expo-google-fonts/<pkg>` lookup on npm.
 */
export function normalizeFamily(family: string): string {
  return family.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Intersect Google variant tokens with VARIANT_MAP, deduping aliases. When both
 * `regular` and `400` (or `italic` and `400italic`) appear, the first
 * encountered wins — `@expo-google-fonts/*` consistently emits non-numeric
 * tokens, so this gives them preference.
 */
export function buildVariantList(googleVariants: string[]): Variant[] {
  const seenKeys = new Map<string, Variant>();
  for (const g of googleVariants) {
    const meta = VARIANT_MAP.get(g);
    if (!meta) continue;
    if (seenKeys.has(meta.enumKey)) continue;
    seenKeys.set(meta.enumKey, { google: g, enumKey: meta.enumKey, suffix: meta.suffix });
  }
  return Array.from(seenKeys.values());
}

/**
 * Build filename-safe family form (spaces stripped). Used in TTF basenames +
 * to match @expo-google-fonts internal tarball naming (e.g. `Open Sans` →
 * `OpenSans_400Regular.ttf`).
 */
export function buildFileBase(displayName: string): string {
  return displayName.replace(/\s+/g, "");
}

const SIDECAR_REL = "src/assets/fonts/.codingpixel-fonts.json";

function sidecarPath(target: string): string {
  return path.join(target, SIDECAR_REL);
}

export function readSidecar(target: string): FontsSidecar | null {
  const p = sidecarPath(target);
  let raw: string;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log.warn(`Sidecar at ${p} is not valid JSON; ignoring. (${err instanceof Error ? err.message : String(err)})`);
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { schemaVersion?: unknown }).schemaVersion !== 1
  ) {
    log.warn(`Sidecar at ${p} has unknown schemaVersion; ignoring.`);
    return null;
  }
  return parsed as FontsSidecar;
}

export function writeSidecar(target: string, sidecar: FontsSidecar): void {
  const p = sidecarPath(target);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmpPath = `${p}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(sidecar, null, 2) + "\n");
  fs.renameSync(tmpPath, p);
}

export function deleteSidecar(target: string): boolean {
  const p = sidecarPath(target);
  try {
    fs.unlinkSync(p);
    return true;
  } catch {
    return false;
  }
}

const NETWORK_ERROR_CODES = ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN"] as const;

function classifyNpmStderr(stderr: string): "404" | "network" | "other" {
  if (/\bE?404\b/.test(stderr)) return "404";
  if (NETWORK_ERROR_CODES.some((code) => stderr.includes(code))) return "network";
  return "other";
}

export async function checkPackageExists(family: string): Promise<boolean> {
  const pkgName = `@expo-google-fonts/${normalizeFamily(family)}`;
  const r = await execa("npm", ["view", pkgName, "name"], { reject: false });
  if (r.exitCode === 0) return true;
  const stderr = r.stderr ?? "";
  const kind = classifyNpmStderr(stderr);
  if (kind === "404") throw new UnknownFontError(family);
  if (kind === "network") {
    const code = NETWORK_ERROR_CODES.find((c) => stderr.includes(c)) ?? "network";
    throw new NetworkError(code);
  }
  throw new Error(`npm view ${pkgName} failed (exit ${r.exitCode}): ${stderr || "(no stderr)"}`);
}

/**
 * Download a URL to a local file via streamed https.get. Resolves on close.
 * Caller is responsible for cleanup of the destination on error.
 */
function downloadToFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const statusCode = (res as { statusCode?: number }).statusCode;
      if (statusCode !== 200) {
        res.resume(); // drain to free the socket
        reject(new Error(`HTTPS ${statusCode ?? "?"} on ${url}`));
        return;
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on("finish", () => out.close((err) => (err ? reject(err) : resolve())));
      out.on("error", reject);
      const onRes = (res as unknown as { on?: (e: string, cb: (e: Error) => void) => void }).on;
      if (typeof onRes === "function") onRes.call(res, "error", reject);
    });
    if (req && typeof (req as { on?: (e: string, cb: (e: Error) => void) => void }).on === "function") {
      (req as unknown as { on: (e: string, cb: (e: Error) => void) => void }).on("error", reject);
    }
  });
}

const FAMILY_REGEX = /^[A-Za-z0-9 ]+$/;

export const RECIPE_OWNED_TTF_REGEX =
  /^[A-Za-z0-9]+-(Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Italic)\.ttf$/;

export function listExistingFontFiles(target: string): string[] {
  const dir = path.join(target, "src/assets/fonts");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir);
}

export function removeStaleFontFiles(target: string, keepFilenames: Set<string>): string[] {
  const dir = path.join(target, "src/assets/fonts");
  if (!fs.existsSync(dir)) return [];
  const removed: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!RECIPE_OWNED_TTF_REGEX.test(f)) continue;
    if (keepFilenames.has(f)) continue;
    fs.unlinkSync(path.join(dir, f));
    removed.push(f);
  }
  return removed;
}

const EMPTY_FONTS_TEMPLATE = `// Empty font registry — drop matching .ttf files into \`assets/fonts/\` and
// fill the enum values with PostScript names (e.g. \`BOLD = "Inter-Bold"\`).
// Wire \`useFonts(...)\` in \`src/app/_layout.tsx\` to actually load them.
export enum Fonts {
  BOLD = "",
  EXTRA_BOLD = "",
  EXTRA_LIGHT = "",
  MEDIUM = "",
  REGULAR = "",
  SEMI_BOLD = "",
  ITALIC = "",
  LIGHT = "",
  THIN = "",
}
`;

const MARKER_START = "// codingpixel:fonts-start";
const MARKER_END = "// codingpixel:fonts-end";

/** Remove [MARKER_START .. MARKER_END] inclusive from a file's lines. Returns true if a block was removed. */
function stripMarkerBlock(content: string): { content: string; removed: boolean } {
  const lines = content.split("\n");
  const startIdx = lines.findIndex((l) => l.includes(MARKER_START));
  const endIdx = lines.findIndex((l) => l.includes(MARKER_END));
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return { content, removed: false };
  lines.splice(startIdx, endIdx - startIdx + 1);
  return { content: lines.join("\n"), removed: true };
}

/** Remove the `import { useFonts } from "expo-font";` line if present. */
function stripUseFontsImport(content: string): string {
  return content
    .split("\n")
    .filter((l) => !/^\s*import\s+\{\s*useFonts\s*\}\s+from\s+["']expo-font["']\s*;?\s*$/.test(l))
    .join("\n");
}

export function removeAllRecipeOwnedFonts(target: string): {
  removedTtfs: string[];
  fontsTsRestored: boolean;
  markerBlockRemoved: boolean;
  sidecarDeleted: boolean;
} {
  const removedTtfs = removeStaleFontFiles(target, new Set());
  const fontsTsPath = path.join(target, "src/ui/theme/fonts.ts");
  let fontsTsRestored = false;
  if (fs.existsSync(fontsTsPath)) {
    fs.writeFileSync(fontsTsPath, EMPTY_FONTS_TEMPLATE);
    fontsTsRestored = true;
  }
  const layoutPath = path.join(target, "src/app/_layout.tsx");
  let markerBlockRemoved = false;
  if (fs.existsSync(layoutPath)) {
    const before = fs.readFileSync(layoutPath, "utf8");
    const stripped = stripMarkerBlock(before);
    const afterImport = stripUseFontsImport(stripped.content);
    if (afterImport !== before) {
      fs.writeFileSync(layoutPath, afterImport);
      markerBlockRemoved = stripped.removed;
    }
  }
  const sidecarDeleted = deleteSidecar(target);
  return { removedTtfs, fontsTsRestored, markerBlockRemoved, sidecarDeleted };
}

/**
 * Decision #15 (rev 3): sidecar names same family + every referenced TTF
 * exists on disk → return cached InstalledFamily; skip tarball fetch.
 */
function tryShortCircuit(
  target: string,
  family: string,
  slot: "primary" | "secondary",
): InstalledFamily | null {
  const sc = readSidecar(target);
  if (!sc) return null;
  const cached = slot === "primary" ? sc.primary : sc.secondary;
  if (!cached) return null;
  const normalizeDisplay = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalizeDisplay(cached.displayName) !== normalizeDisplay(family)) return null;
  const dir = path.join(target, "src/assets/fonts");
  for (const v of cached.variants) {
    const ttf = path.join(dir, `${cached.fileBase}${v.suffix}.ttf`);
    if (!fs.existsSync(ttf)) return null;
  }
  return cached;
}

export async function installAndCopy(
  target: string,
  family: string,
  slot: "primary" | "secondary",
): Promise<InstalledFamily> {
  // Decision #15 — sidecar short-circuit. No network, no copy.
  const cached = tryShortCircuit(target, family, slot);
  if (cached) {
    log.info(`Fonts: ${family} already installed (sidecar match); skipping tarball fetch.`);
    return cached;
  }

  const pkgName = `@expo-google-fonts/${normalizeFamily(family)}`;

  // 1. Fetch tarball URL via npm view dist.tarball.
  const viewResult = await execa("npm", ["view", pkgName, "dist.tarball"], { reject: false });
  if (viewResult.exitCode !== 0) {
    const stderr = viewResult.stderr ?? "";
    const kind = classifyNpmStderr(stderr);
    if (kind === "404") throw new UnknownFontError(family);
    if (kind === "network") {
      const code = NETWORK_ERROR_CODES.find((c) => stderr.includes(c)) ?? "network";
      throw new NetworkError(code);
    }
    throw new Error(`npm view ${pkgName} dist.tarball failed: ${stderr}`);
  }
  const tarballUrl = (viewResult.stdout ?? "").trim();
  if (!tarballUrl) {
    throw new Error(`npm view ${pkgName} dist.tarball returned empty URL.`);
  }

  // 2. Scratch dir for download + extract.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "codingpixel-fonts-"));
  try {
    const tarballPath = path.join(scratch, "pkg.tgz");
    await downloadToFile(tarballUrl, tarballPath);
    await tar.x({ file: tarballPath, cwd: scratch });

    // 3. Read metadata.json.
    const metadataPath = path.join(scratch, "package", "metadata.json");
    if (!fs.existsSync(metadataPath)) {
      throw new Error(
        `Unexpected ${pkgName} package shape — metadata.json missing at ${metadataPath}. File an issue.`,
      );
    }
    let metadata: { family: string; variants: string[] };
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    } catch (err) {
      throw new Error(
        `${pkgName} metadata.json malformed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!Array.isArray(metadata.variants)) {
      throw new Error(`${pkgName} metadata.json: "variants" field is not an array.`);
    }

    // 4. Sanitize family name.
    if (!FAMILY_REGEX.test(metadata.family)) {
      throw new Error(
        `${pkgName} metadata.json family field contains unexpected characters: ${JSON.stringify(
          metadata.family,
        )}. File an issue.`,
      );
    }

    // 5. Variant intersection (deduped).
    const variants = buildVariantList(metadata.variants);
    if (variants.length === 0) {
      throw new NoMappableVariantsError(metadata.family, metadata.variants);
    }

    // 6. Copy TTFs to target.
    const fileBase = buildFileBase(metadata.family);
    const destDir = path.join(target, "src/assets/fonts");
    fs.mkdirSync(destDir, { recursive: true });
    for (const v of variants) {
      const meta = VARIANT_MAP.get(v.google);
      if (!meta) continue; // unreachable — buildVariantList only emits mapped ones
      const src = path.join(scratch, "package", meta.variantDir, `${fileBase}_${meta.variantDir}.ttf`);
      if (!fs.existsSync(src)) {
        throw new Error(`Missing TTF in ${pkgName}: ${src} not found. File an issue.`);
      }
      const dst = path.join(destDir, `${fileBase}${v.suffix}.ttf`);
      fs.copyFileSync(src, dst);
    }

    return { displayName: metadata.family, fileBase, variants };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function ensureUseEffectImport(content: string): string {
  const reactNamedRe = /^\s*import\s+\{([^}]*)\}\s+from\s+["']react["']\s*;?\s*$/m;
  const m = content.match(reactNamedRe);
  if (m && /\buseEffect\b/.test(m[1])) return content;
  if (m) {
    const inner = m[1].trim().replace(/,\s*$/, "");
    const merged = inner.length === 0 ? "useEffect" : `${inner}, useEffect`;
    return content.replace(reactNamedRe, `import { ${merged} } from "react";`);
  }
  const lines = content.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImportIdx = i;
  }
  if (lastImportIdx === -1) return `import { useEffect } from "react";\n${content}`;
  lines.splice(lastImportIdx + 1, 0, `import { useEffect } from "react";`);
  return lines.join("\n");
}

/**
 * Decision #9 — splash×fonts coordination. Reads sidecar for InstalledFamily
 * state, re-detects hasSplashScreen, rewrites the marker block in _layout.tsx.
 * Idempotent: returns `already-current` when content unchanged.
 *
 * CRITICAL dependency of splash recipe behavior — splash recipe calls this
 * when it detects the marker block present.
 */
export function regenerateFontsMarkerBlock(target: string): {
  changed: boolean;
  reason: "no-sidecar" | "no-layout" | "no-marker-block" | "no-splash-needed" | "rewrote" | "already-current";
} {
  const sidecar = readSidecar(target);
  if (!sidecar) return { changed: false, reason: "no-sidecar" };
  const hasSplash = hasExpoSplashScreenDep(target);
  if (!hasSplash) return { changed: false, reason: "no-splash-needed" };

  const layoutPath = path.join(target, "src/app/_layout.tsx");
  if (!fs.existsSync(layoutPath)) return { changed: false, reason: "no-layout" };
  const before = fs.readFileSync(layoutPath, "utf8");

  const lines = before.split("\n");
  const startIdx = lines.findIndex((l) => l.includes(MARKER_START));
  const endIdx = lines.findIndex((l) => l.includes(MARKER_END));
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return { changed: false, reason: "no-marker-block" };
  }

  const newBody = buildMarkerBlockBody(sidecar.primary, sidecar.secondary, hasSplash);
  const newBlock = [`  ${MARKER_START}`, newBody, `  ${MARKER_END}`];
  const rebuilt = [
    ...lines.slice(0, startIdx),
    ...newBlock,
    ...lines.slice(endIdx + 1),
  ];
  let after = rebuilt.join("\n");
  after = ensureUseEffectImport(after);

  if (after === before) return { changed: false, reason: "already-current" };
  fs.writeFileSync(layoutPath, after);
  return { changed: true, reason: "rewrote" };
}
