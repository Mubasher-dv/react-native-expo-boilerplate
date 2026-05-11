import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { patchBabel } from "../src/babel.js";

let target: string;

const ALIAS = { "@theme/*": "src/ui/theme/*" };

beforeEach(() => {
  target = fs.mkdtempSync(path.join(os.tmpdir(), "cpx-babel-"));
});

afterEach(() => {
  fs.rmSync(target, { recursive: true, force: true });
});

function seed(content: string): void {
  fs.writeFileSync(path.join(target, "babel.config.js"), content);
}

function read(): string {
  return fs.readFileSync(path.join(target, "babel.config.js"), "utf8");
}

const FRESH = `module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [],
  };
};
`;

describe("patchBabel", () => {
  it("inserts module-resolver at front when missing", () => {
    seed(FRESH);
    patchBabel(target, {
      workletsAutoIncluded: true,
      workletsPkg: "react-native-worklets",
      aliasMap: ALIAS,
    });
    const out = read();
    expect(out).toContain("module-resolver");
    expect(out).toContain('"@theme/*"');
  });

  it("appends worklets plugin to end when not auto-included", () => {
    seed(FRESH);
    patchBabel(target, {
      workletsAutoIncluded: false,
      workletsPkg: "react-native-worklets",
      aliasMap: ALIAS,
    });
    const out = read();
    expect(out).toMatch(/react-native-worklets\/plugin"\s*\]/);
  });

  it("uses worklets-core variant when configured", () => {
    seed(FRESH);
    patchBabel(target, {
      workletsAutoIncluded: false,
      workletsPkg: "react-native-worklets-core",
      aliasMap: ALIAS,
    });
    expect(read()).toContain("react-native-worklets-core/plugin");
  });

  it("skips worklets injection when preset auto-includes it", () => {
    seed(FRESH);
    patchBabel(target, {
      workletsAutoIncluded: true,
      workletsPkg: "react-native-worklets",
      aliasMap: ALIAS,
    });
    expect(read()).not.toContain("react-native-worklets/plugin");
  });

  it("idempotent — second pass adds no duplicates", () => {
    seed(FRESH);
    patchBabel(target, {
      workletsAutoIncluded: false,
      workletsPkg: "react-native-worklets",
      aliasMap: ALIAS,
    });
    const once = read();
    patchBabel(target, {
      workletsAutoIncluded: false,
      workletsPkg: "react-native-worklets",
      aliasMap: ALIAS,
    });
    const twice = read();
    expect(twice).toBe(once);
  });

  it("writes stub + patches when babel.config.js absent (Deviation #8)", () => {
    // Bare target — no babel.config.js — simulates SDK 54 blank-typescript.
    patchBabel(target, {
      workletsAutoIncluded: true,
      workletsPkg: "react-native-worklets",
      aliasMap: ALIAS,
    });
    const out = read();
    expect(out).toContain("babel-preset-expo");
    expect(out).toContain("module-resolver");
  });

  it("aborts when only babel.config.ts present (no .js)", () => {
    fs.writeFileSync(path.join(target, "babel.config.ts"), "export default {};");
    expect(() =>
      patchBabel(target, {
        workletsAutoIncluded: true,
        workletsPkg: "react-native-worklets",
        aliasMap: ALIAS,
      }),
    ).toThrow(/manual babel config.*not yet supported/);
  });

  it("throws Step A edge-case when module-resolver is last AND worklets needs insertion", () => {
    seed(`module.exports = function(api){
      return { presets: [], plugins: ['module-resolver'] };
    };`);
    expect(() =>
      patchBabel(target, {
        workletsAutoIncluded: false,
        workletsPkg: "react-native-worklets",
        aliasMap: ALIAS,
      }),
    ).toThrow(/module-resolver cannot occupy the final plugin slot/);
  });
});
