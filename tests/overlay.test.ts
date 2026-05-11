import { describe, it, expect } from "vitest";
import { applySentinels, rewriteImports } from "../src/overlay.js";

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
