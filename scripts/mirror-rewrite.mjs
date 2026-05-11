#!/usr/bin/env node
// Phase 4 step 3 — apply rewriteImports across all mirrored files in
// templates/base/ + templates/bottom-sheet/ + templates/image-picker/.
//
// Mapping (from docs/MIRROR_NOTES.md): identity for current MyRoster source set.
// Engine still runs so future divergent mirrors are covered.
//
// One-shot script run during template authoring; NOT part of CLI runtime.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteImports } from "../dist/overlay.js";

const __filename = fileURLToPath(import.meta.url);
const root = path.dirname(path.dirname(__filename));

const ALIAS_MAP = {
  "@theme/": "@theme/",
  "@utils/": "@utils/",
  "@redux/": "@redux/",
  "@core/": "@core/",
  "@services/": "@services/",
  "@hooks/": "@hooks/",
  "@appComponents/": "@appComponents/",
  "@components/": "@components/",
  "@icons/": "@icons/",
  "@features/": "@features/",
  "@assets": "@assets",
};

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) yield p;
  }
}

let touched = 0;
let scanned = 0;
const targets = [
  path.join(root, "templates/base"),
  path.join(root, "templates/bottom-sheet"),
  path.join(root, "templates/image-picker"),
];
for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  for (const f of walk(target)) {
    scanned++;
    const before = fs.readFileSync(f, "utf8");
    const after = rewriteImports(before, ALIAS_MAP);
    if (before !== after) {
      fs.writeFileSync(f, after);
      touched++;
    }
  }
}
console.log(`scanned=${scanned} rewritten=${touched}`);
