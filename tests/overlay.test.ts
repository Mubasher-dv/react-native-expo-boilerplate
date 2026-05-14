import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { BackendType } from "../src/prompts.js";
import { applySentinels, rewriteImports, isSkippedForBackend, applyBase } from "../src/overlay.js";

describe("applySentinels", () => {
  it("replaces module-position sentinel", () => {
    const src = ["before", "// @@FOO@@", "after"].join("\n");
    const out = applySentinels(src, { FOO: "const x = 1;" }, "f.ts");
    expect(out).toBe(["before", "const x = 1;", "after"].join("\n"));
  });

  it("replaces JSX-position sentinel", () => {
    const src = ["<View>", "{/* @@BAR@@ */}", "</View>"].join("\n");
    const out = applySentinels(src, { BAR: "<Inner />" }, "f.tsx");
    expect(out).toBe(["<View>", "<Inner />", "</View>"].join("\n"));
  });

  it("empty replacement drops the sentinel line entirely", () => {
    const src = ["a", "// @@FOO@@", "b"].join("\n");
    const out = applySentinels(src, { FOO: "" }, "f.ts");
    expect(out).toBe(["a", "b"].join("\n"));
  });

  it("missing replacement throws", () => {
    const src = "// @@MISSING@@";
    expect(() => applySentinels(src, {}, "f.ts")).toThrow(
      /Sentinel @@MISSING@@.*has no replacement/,
    );
  });

  it("inline sentinel inside live code throws", () => {
    const src = "const x = /* @@FOO@@ */ 1;";
    expect(() => applySentinels(src, { FOO: "y" }, "f.ts")).toThrow(
      /Malformed sentinel/,
    );
  });

  it("module-opener with JSX-closer (mismatched form) throws", () => {
    const src = "// @@FOO@@ */}";
    expect(() => applySentinels(src, { FOO: "y" }, "f.ts")).toThrow(
      /Malformed sentinel/,
    );
  });

  it("sentinel sharing a line with other tokens throws", () => {
    const src = "// before @@FOO@@ after";
    expect(() => applySentinels(src, { FOO: "y" }, "f.ts")).toThrow(
      /Malformed sentinel/,
    );
  });

  it("lowercase token (typo) throws via orphan probe", () => {
    // ORPHAN_PROBE only fires for [A-Z_]+, but our regexes also restrict to
    // uppercase — so a lowercase token doesn't match either regex AND doesn't
    // match the probe. That's an intentional pass-through; document via this
    // test so a future change is deliberate.
    const src = "// @@bottom_sheet@@";
    expect(() => applySentinels(src, {}, "f.ts")).not.toThrow();
  });
});

describe("rewriteImports", () => {
  it("rewrites `from \"…\"` per alias map", () => {
    const src = `import x from "@/old/path";`;
    const out = rewriteImports(src, { "@/old/": "@new/" });
    expect(out).toBe(`import x from "@new/path";`);
  });

  it("rewrites dynamic import('…')", () => {
    const src = `const m = import("@/old/lazy");`;
    const out = rewriteImports(src, { "@/old/": "@new/" });
    expect(out).toBe(`const m = import("@new/lazy");`);
  });

  it("rewrites require('…')", () => {
    const src = `const m = require("@/old/cjs");`;
    const out = rewriteImports(src, { "@/old/": "@new/" });
    expect(out).toBe(`const m = require("@new/cjs");`);
  });

  it("rewrites jest.mock('…')", () => {
    const src = `jest.mock("@/old/foo");`;
    const out = rewriteImports(src, { "@/old/": "@new/" });
    expect(out).toBe(`jest.mock("@new/foo");`);
  });

  it("longest prefix wins (sort order matters)", () => {
    const src = `import x from "@/foo/bar";`;
    // Both prefixes match; longer wins.
    const out = rewriteImports(src, { "@/": "@root/", "@/foo/": "@foo/" });
    expect(out).toBe(`import x from "@foo/bar";`);
  });

  it("non-matching specifier passes through untouched", () => {
    const src = `import x from "react-native";`;
    const out = rewriteImports(src, { "@/old/": "@new/" });
    expect(out).toBe(src);
  });

  it("identity mapping is a no-op", () => {
    const src = `import x from "@theme/colors";`;
    const out = rewriteImports(src, { "@theme/": "@theme/" });
    expect(out).toBe(src);
  });

  it("idempotent — second pass yields same result", () => {
    const src = `import x from "@/old/path";`;
    const once = rewriteImports(src, { "@/old/": "@new/" });
    const twice = rewriteImports(once, { "@/old/": "@new/" });
    expect(twice).toBe(once);
  });

  it("handles single + double quotes uniformly", () => {
    const src = `import a from "@/x"; import b from '@/y';`;
    const out = rewriteImports(src, { "@/": "@new/" });
    expect(out).toBe(`import a from "@new/x"; import b from '@new/y';`);
  });
});

describe("isSkippedForBackend", () => {
  it("firebase-js skips core/tanstack dir", () => {
    expect(isSkippedForBackend("/app/src/core/tanstack/index.tsx", "firebase-js")).toBe(true);
  });
  it("firebase-rn skips core/tanstack dir", () => {
    expect(isSkippedForBackend("/app/src/core/tanstack/index.tsx", "firebase-rn")).toBe(true);
  });
  it("supabase keeps core/tanstack dir", () => {
    expect(isSkippedForBackend("/app/src/core/tanstack/index.tsx", "supabase")).toBe(false);
  });
  it("custom-backend keeps core/tanstack dir", () => {
    expect(isSkippedForBackend("/app/src/core/tanstack/index.tsx", "custom-backend")).toBe(false);
  });

  it("firebase-js skips core/utils/config.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/config.ts", "firebase-js")).toBe(true);
  });
  it("firebase-rn skips core/utils/config.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/config.ts", "firebase-rn")).toBe(true);
  });
  it("supabase skips core/utils/config.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/config.ts", "supabase")).toBe(true);
  });
  it("custom-backend keeps core/utils/config.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/config.ts", "custom-backend")).toBe(false);
  });

  it("firebase-js skips core/utils/endpoints.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/endpoints.ts", "firebase-js")).toBe(true);
  });
  it("firebase-rn skips core/utils/endpoints.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/endpoints.ts", "firebase-rn")).toBe(true);
  });
  it("supabase skips core/utils/endpoints.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/endpoints.ts", "supabase")).toBe(true);
  });
  it("custom-backend keeps core/utils/endpoints.ts", () => {
    expect(isSkippedForBackend("/app/src/core/utils/endpoints.ts", "custom-backend")).toBe(false);
  });

  it("keeps non-backend files for any backend", () => {
    expect(isSkippedForBackend("/app/src/core/redux/store.ts", "firebase-js")).toBe(false);
    expect(isSkippedForBackend("/app/src/ui/components/Button.tsx", "firebase-rn")).toBe(false);
  });

  it("handles Windows backslash paths", () => {
    expect(isSkippedForBackend("C:\\app\\src\\core\\tanstack\\index.tsx", "firebase-js")).toBe(true);
  });
});

describe("applyBase — file-skip integration", () => {
  let target: string;
  let tplRoot: string;

  beforeEach(() => {
    target = fs.mkdtempSync(path.join(os.tmpdir(), "applyBase-out-"));
    tplRoot = fs.mkdtempSync(path.join(os.tmpdir(), "applyBase-tpl-"));
    fs.mkdirSync(path.join(tplRoot, "base/src/core/tanstack"), { recursive: true });
    fs.writeFileSync(path.join(tplRoot, "base/src/core/tanstack/index.ts"), "export {};");
    fs.mkdirSync(path.join(tplRoot, "base/src/core/redux"), { recursive: true });
    fs.writeFileSync(path.join(tplRoot, "base/src/core/redux/store.ts"), "export {};");
    fs.mkdirSync(path.join(tplRoot, "base/src/core/utils"), { recursive: true });
    fs.writeFileSync(path.join(tplRoot, "base/src/core/utils/config.ts"), "export {};");
    fs.writeFileSync(path.join(tplRoot, "base/src/core/utils/endpoints.ts"), "export {};");
    fs.writeFileSync(path.join(tplRoot, "base/src/core/utils/constants.ts"), "export {};");
  });

  afterEach(() => {
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(tplRoot, { recursive: true, force: true });
  });

  it("firebase-js: skips core/tanstack, copies core/redux", () => {
    applyBase(target, tplRoot, "firebase-js");
    expect(fs.existsSync(path.join(target, "src/core/tanstack"))).toBe(false);
    expect(fs.existsSync(path.join(target, "src/core/redux/store.ts"))).toBe(true);
  });

  it("custom-backend: copies core/tanstack", () => {
    applyBase(target, tplRoot, "custom-backend");
    expect(fs.existsSync(path.join(target, "src/core/tanstack/index.ts"))).toBe(true);
  });

  it("supabase: skips config.ts and endpoints.ts, keeps constants.ts", () => {
    applyBase(target, tplRoot, "supabase");
    expect(fs.existsSync(path.join(target, "src/core/utils/config.ts"))).toBe(false);
    expect(fs.existsSync(path.join(target, "src/core/utils/endpoints.ts"))).toBe(false);
    expect(fs.existsSync(path.join(target, "src/core/utils/constants.ts"))).toBe(true);
  });

  it("firebase-js: skips config.ts and endpoints.ts", () => {
    applyBase(target, tplRoot, "firebase-js");
    expect(fs.existsSync(path.join(target, "src/core/utils/config.ts"))).toBe(false);
    expect(fs.existsSync(path.join(target, "src/core/utils/endpoints.ts"))).toBe(false);
  });

  it("custom-backend: keeps config.ts and endpoints.ts", () => {
    applyBase(target, tplRoot, "custom-backend");
    expect(fs.existsSync(path.join(target, "src/core/utils/config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(target, "src/core/utils/endpoints.ts"))).toBe(true);
  });
});
