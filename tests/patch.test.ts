import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  patchAppJson,
  patchAppJsonPlugins,
  patchExpoRouterEntry,
  patchPackageJsonScripts,
  patchTsconfig,
  slugify,
} from "../src/patch.js";
import type { Answers } from "../src/prompts.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpx-patch-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const baseAnswers: Answers = {
  primaryFont: "",
  secondaryFont: "",
  bottomSheet: false,
  imagePicker: false,
  packageManager: "yarn",
};

describe("slugify", () => {
  it("converts spaces to dashes + lowercases", () => {
    expect(slugify("My Cool App")).toBe("my-cool-app");
  });
  it("strips diacritics", () => {
    expect(slugify("café app")).toBe("cafe-app");
  });
  it("falls back to 'app' on empty input", () => {
    expect(slugify("!!!")).toBe("app");
  });
});

function seedAppJson(plugins: unknown[] = []): void {
  fs.writeFileSync(
    path.join(tmp, "app.json"),
    JSON.stringify({ expo: { name: "demo", slug: "demo", plugins } }, null, 2),
  );
}

function readAppJson() {
  return JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
}

describe("patchAppJson", () => {
  it("sets name + slug + scheme + adds expo-router plugin", () => {
    seedAppJson([]);
    patchAppJson(tmp, "Test App", baseAnswers);
    const j = readAppJson();
    expect(j.expo.name).toBe("Test App");
    expect(j.expo.slug).toBe("test-app");
    expect(j.expo.scheme).toBe("test-app");
    expect(j.expo.plugins).toContain("expo-router");
  });

  it("idempotent — second pass adds no duplicate plugin", () => {
    seedAppJson([]);
    patchAppJson(tmp, "demo", baseAnswers);
    patchAppJson(tmp, "demo", baseAnswers);
    const j = readAppJson();
    expect(j.expo.plugins.filter((e: unknown) => e === "expo-router").length).toBe(1);
  });

  it("preserves user's tuple form of expo-router (nameOf equality)", () => {
    seedAppJson([["expo-router", { origin: "https://example.com" }]]);
    patchAppJson(tmp, "demo", baseAnswers);
    const j = readAppJson();
    // Existing tuple stays; no string form duplicated.
    expect(j.expo.plugins).toEqual([
      ["expo-router", { origin: "https://example.com" }],
    ]);
  });
});

describe("patchAppJsonPlugins", () => {
  it("imagePicker=false → no-op", () => {
    seedAppJson([]);
    patchAppJsonPlugins(tmp, baseAnswers);
    expect(readAppJson().expo.plugins).toEqual([]);
  });

  it("imagePicker=true → adds expo-image-picker entry", () => {
    seedAppJson([]);
    patchAppJsonPlugins(tmp, { ...baseAnswers, imagePicker: true });
    const j = readAppJson();
    expect(j.expo.plugins[0][0]).toBe("expo-image-picker");
  });

  it("idempotent + preserves user options on rerun", () => {
    seedAppJson([["expo-image-picker", { photosPermission: "custom" }]]);
    patchAppJsonPlugins(tmp, { ...baseAnswers, imagePicker: true });
    const j = readAppJson();
    expect(j.expo.plugins).toEqual([
      ["expo-image-picker", { photosPermission: "custom" }],
    ]);
  });
});

describe("patchExpoRouterEntry", () => {
  it("sets package.json#main + tsconfig.extends", () => {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "demo", version: "1.0.0" }, null, 2),
    );
    fs.writeFileSync(
      path.join(tmp, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true } }, null, 2),
    );
    patchExpoRouterEntry(tmp);
    const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf8"));
    const ts = JSON.parse(fs.readFileSync(path.join(tmp, "tsconfig.json"), "utf8"));
    expect(pkg.main).toBe("expo-router/entry");
    expect(ts.extends).toBe("expo/tsconfig.base");
    expect(ts.compilerOptions.strict).toBe(true); // preserved
  });

  it("preserves existing extends when present", () => {
    fs.writeFileSync(path.join(tmp, "package.json"), "{}");
    fs.writeFileSync(
      path.join(tmp, "tsconfig.json"),
      JSON.stringify({ extends: "./other-base.json" }),
    );
    patchExpoRouterEntry(tmp);
    const ts = JSON.parse(fs.readFileSync(path.join(tmp, "tsconfig.json"), "utf8"));
    expect(ts.extends).toBe("./other-base.json");
  });
});

describe("patchPackageJsonScripts", () => {
  it("adds expected scripts; preserves user's existing values", () => {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ scripts: { start: "custom-start" } }, null, 2),
    );
    patchPackageJsonScripts(tmp);
    const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf8"));
    expect(pkg.scripts.start).toBe("custom-start"); // preserved
    expect(pkg.scripts.android).toBe("expo start --android");
    expect(pkg.scripts.ios).toBe("expo start --ios");
    expect(pkg.scripts.web).toBe("expo start --web");
    expect(pkg.scripts.lint).toBe("expo lint");
  });

  it("preserves main + expo keys", () => {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify(
        { main: "expo-router/entry", expo: { install: { exclude: [] } } },
        null,
        2,
      ),
    );
    patchPackageJsonScripts(tmp);
    const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf8"));
    expect(pkg.main).toBe("expo-router/entry");
    expect(pkg.expo).toEqual({ install: { exclude: [] } });
  });
});

describe("patchTsconfig", () => {
  function seedTs(content: object): void {
    fs.writeFileSync(path.join(tmp, "tsconfig.json"), JSON.stringify(content));
  }
  function readTs(): any {
    return JSON.parse(fs.readFileSync(path.join(tmp, "tsconfig.json"), "utf8"));
  }

  it("sets baseUrl=. when both user + expo base lack it", () => {
    seedTs({ extends: "expo/tsconfig.base", compilerOptions: {} });
    patchTsconfig(tmp, { expoBaseUrlInherited: false });
    expect(readTs().compilerOptions.baseUrl).toBe(".");
  });

  it("preserves user-set baseUrl (tier 1)", () => {
    seedTs({
      extends: "expo/tsconfig.base",
      compilerOptions: { baseUrl: "./packages" },
    });
    patchTsconfig(tmp, { expoBaseUrlInherited: false });
    expect(readTs().compilerOptions.baseUrl).toBe("./packages");
  });

  it("inherits from expo base (tier 2) → no baseUrl written", () => {
    seedTs({ extends: "expo/tsconfig.base", compilerOptions: {} });
    patchTsconfig(tmp, { expoBaseUrlInherited: true });
    expect("baseUrl" in readTs().compilerOptions).toBe(false);
  });

  it("merges SPEC paths; preserves existing user paths", () => {
    seedTs({
      extends: "expo/tsconfig.base",
      compilerOptions: { paths: { "@my/*": ["./my/*"] } },
    });
    patchTsconfig(tmp, { expoBaseUrlInherited: false });
    const paths = readTs().compilerOptions.paths;
    expect(paths["@my/*"]).toEqual(["./my/*"]);
    expect(paths["@theme/*"]).toEqual(["src/ui/theme/*"]);
    expect(paths["@/*"]).toEqual(["src/*"]);
  });

  it("warns on @/* collision but preserves user value", () => {
    seedTs({
      extends: "expo/tsconfig.base",
      compilerOptions: { paths: { "@/*": ["./packages/*"] } },
    });
    patchTsconfig(tmp, { expoBaseUrlInherited: false });
    expect(readTs().compilerOptions.paths["@/*"]).toEqual(["./packages/*"]);
  });
});
