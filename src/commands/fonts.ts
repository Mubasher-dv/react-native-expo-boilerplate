import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { assertExpoApp, hasExpoSplashScreenDep } from "../projectFs.js";
import {
  checkPackageExists,
  installAndCopy,
  readSidecar,
  writeSidecar,
  removeStaleFontFiles,
  removeAllRecipeOwnedFonts,
  regenerateFontsMarkerBlock,
  type InstalledFamily,
} from "../fontsInstaller.js";
import {
  generateFontsEnumFile,
  generateUseFontsBlocks,
  buildLayoutReplacements,
} from "../fonts.js";
import { patchLayout } from "../patch.js";
import { log } from "../util.js";

async function promptText(name: string, message: string): Promise<string> {
  const ans = await prompts({ type: "text", name, message, initial: "" });
  return String(ans[name] ?? "").trim();
}

async function promptConfirm(name: string, message: string): Promise<boolean> {
  const ans = await prompts({ type: "confirm", name, message, initial: false });
  return Boolean(ans[name]);
}

/**
 * Splice a fresh marker-block + imports into _layout.tsx when sentinels are
 * already consumed AND no marker block exists yet (first `add fonts` run after
 * an older scaffold or after a wipe).
 */
function spliceFreshMarkerBlock(
  target: string,
  primary: InstalledFamily,
  secondary: InstalledFamily | null,
  hasSplash: boolean,
): void {
  const layoutPath = path.join(target, "src/app/_layout.tsx");
  if (!fs.existsSync(layoutPath)) return;
  const before = fs.readFileSync(layoutPath, "utf8");

  const { importBlock, hookBlock } = generateUseFontsBlocks(primary, secondary, hasSplash);

  // Remove orphan standalone splash useEffect left by a prior `add splash` run.
  // Pattern matches the exact block emitted by insertStandaloneSplashUseEffect in add.ts.
  let source = before;
  if (hasSplash) {
    source = source.replace(
      /[ \t]*\/\/[^\n]*Splash recipe[^\n]*\n[ \t]*useEffect\(\(\) => \{\n[ \t]*SplashScreen\.hideAsync\(\);\n[ \t]*\}, \[\]\);\n\n?/,
      "",
    );
  }
  const lines = source.split("\n");

  // Insert imports after last existing import (dedupe against existing lines).
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImportIdx = i;
  }
  if (lastImportIdx >= 0) {
    const importsToAdd = importBlock
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .filter((l) => !lines.some((existing) => existing.trim() === l.trim()));
    if (importsToAdd.length > 0) {
      lines.splice(lastImportIdx + 1, 0, ...importsToAdd);
    }
  } else if (importBlock) {
    lines.unshift(importBlock);
  }

  // Insert hookBlock as first statement inside RootLayout body.
  let rootIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/export\s+default\s+function\s+RootLayout\s*\(/.test(lines[i])) {
      rootIdx = i;
      break;
    }
  }
  if (rootIdx >= 0) {
    lines.splice(rootIdx + 1, 0, hookBlock);
  }

  fs.writeFileSync(layoutPath, lines.join("\n"));
}

export async function addFonts(target: string = process.cwd()): Promise<void> {
  assertExpoApp(target);
  if (!process.stdin.isTTY && process.env.EXPO_PRIMARY_FONT === undefined) {
    throw new Error(
      "add fonts needs an interactive terminal (TTY) or EXPO_PRIMARY_FONT env var. Run it from a real shell.",
    );
  }

  // Detect existing state via sidecar.
  const sidecarBefore = readSidecar(target);

  // Prompt primary (env var first).
  const envPrimary = process.env.EXPO_PRIMARY_FONT;
  const primary = envPrimary !== undefined
    ? envPrimary.trim()
    : await promptText("primaryFont", "Primary font family (e.g. Inter; empty = skip / wipe)");

  if (!primary) {
    if (!sidecarBefore) {
      log.info("No font family entered — exiting without changes.");
      return;
    }
    const confirm = await promptConfirm("confirmWipe", "Remove all installed fonts? (y/N)");
    if (!confirm) {
      log.info("Aborted; no changes.");
      return;
    }
    const out = removeAllRecipeOwnedFonts(target);
    log.success(
      `Removed ${out.removedTtfs.length} font file(s); sidecar deleted=${out.sidecarDeleted}; marker block removed=${out.markerBlockRemoved}.`,
    );
    return;
  }

  // Prompt secondary (env var first).
  const envSecondary = process.env.EXPO_SECONDARY_FONT;
  const secondary = envSecondary !== undefined
    ? envSecondary.trim()
    : await promptText("secondaryFont", "Secondary font family (e.g. Sansita; empty = primary only)");

  // Parallel pre-check (allSettled — surface both rejections).
  const familiesToCheck = secondary ? [primary, secondary] : [primary];
  const checks = await Promise.allSettled(familiesToCheck.map((f) => checkPackageExists(f)));
  const failures = checks
    .map((r, i) => (r.status === "rejected" ? { family: familiesToCheck[i], err: r.reason as Error } : null))
    .filter((x): x is { family: string; err: Error } => x !== null);
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((f) => f.err),
      `Font pre-check failed for: ${failures.map((f) => f.family).join(", ")}`,
    );
  }

  // Install + sidecar.
  log.step(`Installing primary "${primary}" via tarball fetch …`);
  const primaryInstalled: InstalledFamily = await installAndCopy(target, primary, "primary");
  let secondaryInstalled: InstalledFamily | null = null;
  if (secondary) {
    log.step(`Installing secondary "${secondary}" via tarball fetch …`);
    secondaryInstalled = await installAndCopy(target, secondary, "secondary");
  }
  // Cleanup orphans matching recipe-owned pattern before writing sidecar.
  const keep = new Set<string>();
  for (const v of primaryInstalled.variants) {
    keep.add(`${primaryInstalled.fileBase}${v.suffix}.ttf`);
  }
  if (secondaryInstalled) {
    for (const v of secondaryInstalled.variants) {
      keep.add(`${secondaryInstalled.fileBase}${v.suffix}.ttf`);
    }
  }
  const removedOrphans = removeStaleFontFiles(target, keep);
  if (removedOrphans.length > 0) {
    log.info(`Removed stale TTFs: ${removedOrphans.join(", ")}`);
  }

  writeSidecar(target, {
    schemaVersion: 1,
    markerSyntax: "codingpixel:fonts",
    primary: primaryInstalled,
    secondary: secondaryInstalled,
  });

  // Rewrite fonts.ts.
  const fontsTsPath = path.join(target, "src/ui/theme/fonts.ts");
  fs.writeFileSync(fontsTsPath, generateFontsEnumFile(primaryInstalled, secondaryInstalled));

  // Patch _layout.tsx — sentinel splice if sentinels still present, else marker-block path.
  const layoutPath = path.join(target, "src/app/_layout.tsx");
  const hasSplash = hasExpoSplashScreenDep(target);
  const layoutSource = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, "utf8") : "";
  const fakeAnswers = {
    primaryFont: primary,
    secondaryFont: secondary,
    bottomSheet: false,
    imagePicker: false,
    packageManager: "npm" as const,
  };
  if (layoutSource.includes("@@USE_FONTS_IMPORT@@")) {
    patchLayout(target, buildLayoutReplacements(fakeAnswers, primaryInstalled, secondaryInstalled, hasSplash));
  } else if (layoutSource.includes("// codingpixel:fonts-start")) {
    // Marker block already exists — regenerate in place.
    regenerateFontsMarkerBlock(target);
  } else if (layoutSource) {
    // No sentinels, no marker block — splice a fresh block.
    spliceFreshMarkerBlock(target, primaryInstalled, secondaryInstalled, hasSplash);
  }

  log.success(
    `Fonts installed: primary=${primaryInstalled.displayName}${
      secondaryInstalled ? ", secondary=" + secondaryInstalled.displayName : ""
    }.`,
  );
}
