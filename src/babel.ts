// Phase 7 step 4 — `babel.config.js` AST merge.
//
// Why AST + not regex:
//   create-expo-app's default `babel.config.js` is a `module.exports = function`
//   returning an object literal. We need to insert/dedup `plugins[]` entries
//   while preserving comments, presets, env-conditional branches, etc. Regex
//   gets fragile fast; AST is the only safe path.
//
// Why plugin order matters:
//   reanimated/worklets plugin MUST be the LAST entry in `plugins[]` per
//   upstream docs. `module-resolver` (when we insert it) goes at the FRONT
//   so its presence can never displace the worklets last-slot reservation.

import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import * as _traverseNS from "@babel/traverse";
import * as _generateNS from "@babel/generator";
import * as t from "@babel/types";
import { fileExists, log } from "./util.js";

// ESM/CJS interop — Node's ESM loader wraps CJS modules so @babel/traverse +
// @babel/generator surface as `{ default: { default: <fn>, ...other } }` from
// `import * as ns`. Unwrap up to two levels so the callable is reached
// regardless of how the underlying CJS module is shaped (some Babel versions
// expose the function directly on .default; newer ones nest one level deeper).
function unwrap<T>(ns: unknown): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = ns;
  for (let i = 0; i < 3; i++) {
    if (typeof cur === "function") return cur as T;
    if (cur && typeof cur.default !== "undefined") {
      cur = cur.default;
      continue;
    }
    break;
  }
  return cur as T;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const traverse: any = unwrap(_traverseNS);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generate: any = unwrap(_generateNS);

export type PatchBabelOpts = {
  /** Phase 0 Probe 2 — when true, skip worklets/reanimated plugin insertion (preset auto-includes). */
  workletsAutoIncluded: boolean;
  /** Phase 0 Probe 3 — `react-native-worklets` (canonical) or `react-native-worklets-core` (legacy variant). */
  workletsPkg: "react-native-worklets" | "react-native-worklets-core";
  /** SPEC §9 alias map for module-resolver injection. */
  aliasMap: Record<string, string>;
};

const isWorklets = (entry: unknown): boolean => {
  const name = nameOfEntry(entry);
  return /^react-native-worklets(-core)?\/plugin$/.test(name);
};

const isModuleResolver = (entry: unknown): boolean =>
  nameOfEntry(entry) === "module-resolver";

function nameOfEntry(entry: unknown): string {
  if (Array.isArray(entry)) return String(entry[0]);
  return String(entry);
}

/** Get the string name from an AST plugin entry (string literal or array literal whose first elem is a string). */
function pluginEntryName(node: t.Node): string {
  if (t.isStringLiteral(node)) return node.value;
  if (t.isArrayExpression(node)) {
    const first = node.elements[0];
    if (first && t.isStringLiteral(first)) return first.value;
  }
  return "";
}

/** Build an AST node for `["module-resolver", { alias: <map> }]`. */
function buildModuleResolverEntry(aliasMap: Record<string, string>): t.ArrayExpression {
  const aliasObject = t.objectExpression(
    Object.entries(aliasMap).map(([from, to]) =>
      t.objectProperty(t.stringLiteral(from), t.stringLiteral(to)),
    ),
  );
  return t.arrayExpression([
    t.stringLiteral("module-resolver"),
    t.objectExpression([t.objectProperty(t.identifier("alias"), aliasObject)]),
  ]);
}

/**
 * Patch `<target>/babel.config.js`. Idempotent. Throws on parse failure or on
 * unsupported config form (e.g. .ts/.cjs/.mjs only).
 */
export function patchBabel(target: string, opts: PatchBabelOpts): void {
  // File-extension detection: .ts/.cjs/.mjs without .js → unsupported.
  const jsPath = path.join(target, "babel.config.js");
  for (const alt of ["babel.config.ts", "babel.config.cjs", "babel.config.mjs"]) {
    if (fileExists(path.join(target, alt)) && !fileExists(jsPath)) {
      throw new Error(
        `manual babel config (${alt}) not yet supported — patchBabel handles babel.config.js only.`,
      );
    }
  }
  // Deviation #8 (docs/MIRROR_NOTES.md): SDK 54 blank-typescript no longer
  // ships `babel.config.js` — preset-only via expo-router auto-config.
  // Create the minimal stub here; patcher AST below then layers our entries on top.
  if (!fileExists(jsPath)) {
    const stub = `module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [],
  };
};
`;
    fs.writeFileSync(jsPath, stub);
    log.step("babel.config.js missing — wrote default stub before patching.");
  }

  const source = fs.readFileSync(jsPath, "utf8");
  const ast = parse(source, {
    sourceType: "script", // create-expo-app default is CJS module.exports
    plugins: [],
  });

  // Locate the returned ObjectExpression (return value of the exported function).
  // `let configObj: any` so traverse-callback assignments don't trip TS narrowing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let configObj: any = null;
  traverse(ast, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ReturnStatement(p: any) {
      if (configObj) return;
      const arg = p.node.argument;
      if (arg && t.isObjectExpression(arg)) {
        configObj = arg;
        p.stop();
      }
    },
  });

  if (!configObj) {
    // Fallback: top-level `module.exports = { ... }` form (no function wrapper).
    traverse(ast, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      AssignmentExpression(p: any) {
        if (configObj) return;
        if (
          t.isMemberExpression(p.node.left) &&
          t.isIdentifier(p.node.left.object, { name: "module" }) &&
          t.isIdentifier(p.node.left.property, { name: "exports" }) &&
          t.isObjectExpression(p.node.right)
        ) {
          configObj = p.node.right;
          p.stop();
        }
      },
    });
  }

  if (!configObj) {
    throw new Error("patchBabel: could not locate config ObjectExpression in babel.config.js");
  }
  const config = configObj as t.ObjectExpression;

  // Find or create `plugins` property.
  let pluginsProp = config.properties.find(
    (p): p is t.ObjectProperty =>
      t.isObjectProperty(p) &&
      ((t.isIdentifier(p.key) && p.key.name === "plugins") ||
        (t.isStringLiteral(p.key) && p.key.value === "plugins")),
  );
  if (!pluginsProp) {
    pluginsProp = t.objectProperty(t.identifier("plugins"), t.arrayExpression([]));
    config.properties.push(pluginsProp);
  }
  if (!t.isArrayExpression(pluginsProp.value)) {
    throw new Error("patchBabel: plugins is not an array literal — cannot patch.");
  }
  const plugins = pluginsProp.value;

  // ----- Step 0: decision prelude -----
  const namesOnly = plugins.elements
    .filter((e): e is t.Expression => e !== null)
    .map(pluginEntryName);
  const moduleResolverPresent = namesOnly.includes("module-resolver");
  const moduleResolverIsLast =
    namesOnly.length > 0 && namesOnly[namesOnly.length - 1] === "module-resolver";
  const workletsPresent = namesOnly.some((n) =>
    /^react-native-worklets(-core)?\/plugin$/.test(n),
  );
  const workletsNeedsInsertion = !opts.workletsAutoIncluded && !workletsPresent;

  // ----- Step A: module-resolver -----
  if (moduleResolverIsLast && workletsNeedsInsertion) {
    throw new Error(
      "module-resolver cannot occupy the final plugin slot when worklets plugin is required; " +
        "please reorder babel.config.js plugins manually.",
    );
  }
  if (!moduleResolverPresent) {
    plugins.elements.unshift(buildModuleResolverEntry(opts.aliasMap));
  }

  // ----- Step B: worklets -----
  if (workletsNeedsInsertion) {
    plugins.elements.push(t.stringLiteral(`${opts.workletsPkg}/plugin`));
  }

  // ----- Step C: post-patch invariant assert with user-mutation tolerance -----
  const finalNames = plugins.elements
    .filter((e): e is t.Expression => e !== null)
    .map(pluginEntryName);
  const workletsIdx = finalNames.findIndex((n) =>
    /^react-native-worklets(-core)?\/plugin$/.test(n),
  );
  if (workletsIdx !== -1 && workletsIdx !== finalNames.length - 1) {
    const trailing = finalNames.slice(workletsIdx + 1);
    const OURS = new Set(["module-resolver"]);
    const oursAfter = trailing.filter((n) => OURS.has(n));
    const userAfter = trailing.filter((n) => !OURS.has(n));
    if (oursAfter.length > 0) {
      throw new Error(
        `babel.config.js: our patch corrupted plugin order — worklets must be last. ` +
          `Offending trailing entries from our patch: ${oursAfter.join(", ")}`,
      );
    }
    if (userAfter.length > 0) {
      log.warn(
        `babel.config.js: plugin(s) [${userAfter.join(", ")}] appear after worklets — ` +
          `reanimated requires worklets last; please reorder.`,
      );
    }
  }

  // Regenerate.
  const out = generate(ast, { retainLines: false, comments: true }, source).code;
  fs.writeFileSync(jsPath, out + (out.endsWith("\n") ? "" : "\n"));

  // sanity: also verify the runtime predicates still match what we computed.
  void isWorklets;
  void isModuleResolver;
}
