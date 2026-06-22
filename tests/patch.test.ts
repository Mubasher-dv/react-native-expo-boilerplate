import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  bundleIdFor,
  bundleIdSegment,
  patchAppJson,
  patchAppJsonAssetPaths,
  patchAppJsonBuildProperties,
  patchAppJsonPlugins,
  patchExpoRouterEntry,
  patchPackageJsonScripts,
  patchReadme,
  patchTsconfig,
  patchUserSliceForFirebase,
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
  backendType: "custom-backend",
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

describe("bundleIdSegment", () => {
  it("strips dashes from slug", () => {
    expect(bundleIdSegment("My Cool App")).toBe("mycoolapp");
  });
  it("prefixes with 'app' when starting with a digit", () => {
    expect(bundleIdSegment("1pp")).toBe("app1pp");
  });
  it("empty / non-alnum → 'app'", () => {
    expect(bundleIdSegment("!!!")).toBe("app");
  });
});

describe("bundleIdFor", () => {
  it("composes com.<safeName> (no org namespace)", () => {
    expect(bundleIdFor("My Cool App")).toBe("com.mycoolapp");
    expect(bundleIdFor("cpx-e2e")).toBe("com.cpxe2e");
    expect(bundleIdFor("1pp")).toBe("com.app1pp");
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
  it("sets name + slug + scheme + bundleId + adds expo-router plugin", () => {
    seedAppJson([]);
    patchAppJson(tmp, "Test App", baseAnswers);
    const j = readAppJson();
    expect(j.expo.name).toBe("Test App");
    expect(j.expo.slug).toBe("test-app");
    expect(j.expo.scheme).toBe("test-app");
    expect(j.expo.ios.bundleIdentifier).toBe("com.testapp");
    expect(j.expo.android.package).toBe("com.testapp");
    expect(j.expo.plugins).toContain("expo-router");
  });

  it("preserves user-set ios.bundleIdentifier + android.package", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify(
        {
          expo: {
            name: "demo",
            slug: "demo",
            ios: { bundleIdentifier: "com.example.custom" },
            android: { package: "com.example.custom" },
          },
        },
        null,
        2,
      ),
    );
    patchAppJson(tmp, "demo", baseAnswers);
    const j = readAppJson();
    expect(j.expo.ios.bundleIdentifier).toBe("com.example.custom");
    expect(j.expo.android.package).toBe("com.example.custom");
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

describe("patchAppJsonAssetPaths", () => {
  it("rewrites ./assets/* paths to ./src/assets/*", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify({
        expo: {
          icon: "./assets/icon.png",
          splash: { image: "./assets/splash-icon.png" },
          android: {
            adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png" },
          },
          web: { favicon: "./assets/favicon.png" },
        },
      }, null, 2),
    );
    
    patchAppJsonAssetPaths(tmp);
    const j = readAppJson();
    expect(j.expo.icon).toBe("./src/assets/icon.png");
    expect(j.expo.splash.image).toBe("./src/assets/splash-icon.png");
    expect(j.expo.android.adaptiveIcon.foregroundImage).toBe(
      "./src/assets/adaptive-icon.png",
    );
    expect(j.expo.web.favicon).toBe("./src/assets/favicon.png");
  });

  it("rewrites the full SDK 56 adaptive-icon set (foreground/background/monochrome) + nested plugin paths", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify({
        expo: {
          icon: "./assets/icon.png",
          android: {
            adaptiveIcon: {
              foregroundImage: "./assets/android-icon-foreground.png",
              backgroundImage: "./assets/android-icon-background.png",
              monochromeImage: "./assets/android-icon-monochrome.png",
            },
          },
          plugins: [
            ["expo-splash-screen", { image: "./assets/splash-icon.png" }],
          ],
        },
      }, null, 2),
    );

    patchAppJsonAssetPaths(tmp);
    const j = readAppJson();
    const ai = j.expo.android.adaptiveIcon;
    expect(ai.foregroundImage).toBe("./src/assets/android-icon-foreground.png");
    expect(ai.backgroundImage).toBe("./src/assets/android-icon-background.png");
    expect(ai.monochromeImage).toBe("./src/assets/android-icon-monochrome.png");
    expect(j.expo.icon).toBe("./src/assets/icon.png");
    // Recurses into plugin option arrays too.
    expect(j.expo.plugins[0][1].image).toBe("./src/assets/splash-icon.png");
  });

  it("idempotent — already-patched paths stay unchanged", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify({
        expo: { icon: "./src/assets/icon.png" },
      }),
    );
    
    patchAppJsonAssetPaths(tmp);
    expect(readAppJson().expo.icon).toBe("./src/assets/icon.png");
  });

  it("preserves user-customized paths that don't start with ./assets/", () => {
    fs.writeFileSync(
      path.join(tmp, "app.json"),
      JSON.stringify({
        expo: { icon: "https://cdn.example.com/icon.png" },
      }),
    );
    
    patchAppJsonAssetPaths(tmp);
    expect(readAppJson().expo.icon).toBe("https://cdn.example.com/icon.png");
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

describe("patchAppJsonPlugins — firebase-rn", () => {
  it("firebase-rn → adds @react-native-firebase/app plugin", () => {
    seedAppJson([]);
    patchAppJsonPlugins(tmp, { ...baseAnswers, backendType: "firebase-rn" });
    const j = readAppJson();
    expect(j.expo.plugins).toContain("@react-native-firebase/app");
  });

  it("supabase (not firebase-rn, not imagePicker) → no-op", () => {
    seedAppJson([]);
    patchAppJsonPlugins(tmp, { ...baseAnswers, backendType: "supabase" });
    expect(readAppJson().expo.plugins).toEqual([]);
  });

  it("firebase-rn idempotent — second pass adds no duplicate", () => {
    seedAppJson([]);
    patchAppJsonPlugins(tmp, { ...baseAnswers, backendType: "firebase-rn" });
    patchAppJsonPlugins(tmp, { ...baseAnswers, backendType: "firebase-rn" });
    const j = readAppJson();
    expect(
      j.expo.plugins.filter((e: unknown) => e === "@react-native-firebase/app").length,
    ).toBe(1);
  });
});

describe("patchUserSliceForFirebase", () => {
  function seedUserSlice(): void {
    const sliceDir = path.join(tmp, "src/core/redux/slices");
    fs.mkdirSync(sliceDir, { recursive: true });
    fs.writeFileSync(
      path.join(sliceDir, "userSlice.ts"),
      [
        `// Minimal user shape per SPEC §6 ("dummy user shape").`,
        `// \`accessToken\` is required by the axios interceptor in \`core/utils/config.ts\``,
        `// — every request reads \`store.getState().user?.accessToken\` and attaches as`,
        `// \`Bearer <token>\` if present. Apps replace shape but must keep the field.`,
        `import { createSlice, PayloadAction } from "@reduxjs/toolkit";`,
        ``,
        `export type User = {`,
        `  id: string | null;`,
        `  name: string | null;`,
        `  accessToken: string | null;`,
        `};`,
        ``,
        `const initialState: User = { id: null, name: null, accessToken: null };`,
        ``,
        `const userSlice = createSlice({`,
        `  name: "user",`,
        `  initialState,`,
        `  reducers: {`,
        `    setUser: (state, action: PayloadAction<User>) => {`,
        `      state.id = action.payload.id;`,
        `      state.name = action.payload.name;`,
        `      state.accessToken = action.payload.accessToken;`,
        `    },`,
        `    updateUser: (state, action: PayloadAction<Partial<User>>) => {`,
        `      Object.assign(state, action.payload);`,
        `    },`,
        `    setAccessToken: (state, action: PayloadAction<string | null>) => {`,
        `      state.accessToken = action.payload;`,
        `    },`,
        `    clearUser: (state) => {`,
        `      state.id = null;`,
        `      state.name = null;`,
        `      state.accessToken = null;`,
        `    },`,
        `  },`,
        `});`,
        ``,
        `export const { setUser, updateUser, setAccessToken, clearUser } = userSlice.actions;`,
        `export default userSlice.reducer;`,
        ``,
      ].join("\n"),
    );
  }

  it("removes accessToken from User type", () => {
    seedUserSlice();
    patchUserSliceForFirebase(tmp);
    const src = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    expect(src).not.toContain("accessToken: string | null");
  });

  it("removes accessToken from initialState", () => {
    seedUserSlice();
    patchUserSliceForFirebase(tmp);
    const src = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    expect(src).not.toContain("accessToken: null");
  });

  it("removes setAccessToken reducer", () => {
    seedUserSlice();
    patchUserSliceForFirebase(tmp);
    const src = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    expect(src).not.toContain("setAccessToken");
  });

  it("removes accessToken from setUser + clearUser reducers", () => {
    seedUserSlice();
    patchUserSliceForFirebase(tmp);
    const src = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    expect(src).not.toContain("state.accessToken");
  });

  it("preserves setUser, updateUser, clearUser", () => {
    seedUserSlice();
    patchUserSliceForFirebase(tmp);
    const src = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    expect(src).toContain("setUser");
    expect(src).toContain("updateUser");
    expect(src).toContain("clearUser");
  });

  it("idempotent — running twice yields same result", () => {
    seedUserSlice();
    patchUserSliceForFirebase(tmp);
    const after1 = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    patchUserSliceForFirebase(tmp);
    const after2 = fs.readFileSync(path.join(tmp, "src/core/redux/slices/userSlice.ts"), "utf8");
    expect(after1).toBe(after2);
  });

  it("no-op when file is missing", () => {
    expect(() => patchUserSliceForFirebase(tmp)).not.toThrow();
  });
});

describe("patchAppJsonBuildProperties", () => {
  it("does NOT pin SDK floors — no build-properties entry for custom-backend", () => {
    seedAppJson([]);
    patchAppJsonBuildProperties(tmp, { ...baseAnswers, backendType: "custom-backend" });
    expect(readAppJson().expo.plugins).toEqual([]);
  });

  it("does NOT add build-properties for supabase or firebase-js", () => {
    seedAppJson([]);
    patchAppJsonBuildProperties(tmp, { ...baseAnswers, backendType: "supabase" });
    patchAppJsonBuildProperties(tmp, { ...baseAnswers, backendType: "firebase-js" });
    expect(readAppJson().expo.plugins).toEqual([]);
  });

  it("firebase-rn → adds build-properties with ONLY ios.useFrameworks static (no pinned floors)", () => {
    seedAppJson([]);
    patchAppJsonBuildProperties(tmp, { ...baseAnswers, backendType: "firebase-rn" });
    expect(readAppJson().expo.plugins).toEqual([
      ["expo-build-properties", { ios: { useFrameworks: "static" } }],
    ]);
  });

  it("firebase-rn idempotent — injects useFrameworks into an existing entry, preserves user keys, second run no-op", () => {
    seedAppJson([
      ["expo-build-properties", { ios: { deploymentTarget: "16.0" }, android: { minSdkVersion: 26 } }],
    ]);
    patchAppJsonBuildProperties(tmp, { ...baseAnswers, backendType: "firebase-rn" });
    const after1 = JSON.stringify(readAppJson());
    patchAppJsonBuildProperties(tmp, { ...baseAnswers, backendType: "firebase-rn" });
    const after2 = JSON.stringify(readAppJson());
    expect(after1).toBe(after2);
    expect(readAppJson().expo.plugins).toEqual([
      [
        "expo-build-properties",
        { ios: { deploymentTarget: "16.0", useFrameworks: "static" }, android: { minSdkVersion: 26 } },
      ],
    ]);
  });

  it("custom-backend leaves an existing user build-properties entry untouched", () => {
    seedAppJson([
      ["expo-build-properties", { ios: { deploymentTarget: "16.0" }, android: { minSdkVersion: 26 } }],
    ]);
    patchAppJsonBuildProperties(tmp, { ...baseAnswers, backendType: "custom-backend" });
    expect(readAppJson().expo.plugins).toEqual([
      ["expo-build-properties", { ios: { deploymentTarget: "16.0" }, android: { minSdkVersion: 26 } }],
    ]);
  });

  it("coexists with other plugin entries (firebase-rn appends, doesn't replace)", () => {
    seedAppJson(["expo-router", ["expo-image-picker", { photosPermission: "x" }]]);
    patchAppJsonBuildProperties(tmp, { ...baseAnswers, backendType: "firebase-rn" });
    const plugins = readAppJson().expo.plugins;
    expect(plugins).toHaveLength(3);
    expect(plugins[0]).toBe("expo-router");
    expect(plugins[1][0]).toBe("expo-image-picker");
    expect(plugins[2][0]).toBe("expo-build-properties");
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
  it("adds expected scripts; preserves user's truly-custom values", () => {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ scripts: { start: "custom-start" } }, null, 2),
    );
    patchPackageJsonScripts(tmp);
    const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf8"));
    expect(pkg.scripts.start).toBe("custom-start"); // preserved (not a stale default)
    expect(pkg.scripts.android).toBe("expo run:android");
    expect(pkg.scripts.ios).toBe("expo run:ios");
    expect(pkg.scripts.web).toBe("expo start --web");
    expect(pkg.scripts.lint).toBe("expo lint");
    expect(pkg.scripts.prebuild).toBe("expo prebuild");
  });

  it("UPGRADES stale create-expo-app defaults to dev-client variants", () => {
    // Simulates re-running CLI on a target whose package.json was generated by
    // an older react-native-expo-boilerplate version (or by upstream create-expo-app).
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify(
        {
          scripts: {
            start: "expo start",
            android: "expo start --android",
            ios: "expo start --ios",
          },
        },
        null,
        2,
      ),
    );
    patchPackageJsonScripts(tmp);
    const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf8"));
    expect(pkg.scripts.start).toBe("expo start --dev-client");
    expect(pkg.scripts.android).toBe("expo run:android");
    expect(pkg.scripts.ios).toBe("expo run:ios");
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

describe("patchReadme", () => {
  it("replaces `**APP_NAME**` placeholder (current template form)", () => {
    fs.writeFileSync(
      path.join(tmp, "README.md"),
      "# **APP_NAME**\n\nRun `yarn ios` in **APP_NAME**/.",
    );
    patchReadme(tmp, "my-cool-app");
    const out = fs.readFileSync(path.join(tmp, "README.md"), "utf8");
    expect(out).toContain("# my-cool-app");
    expect(out).toContain("yarn ios` in my-cool-app/.");
    expect(out).not.toContain("**APP_NAME**");
  });

  it("replaces legacy `__APP_NAME__` placeholder (back-compat)", () => {
    fs.writeFileSync(
      path.join(tmp, "README.md"),
      "# __APP_NAME__\n\nbody mentioning __APP_NAME__ again.",
    );
    patchReadme(tmp, "legacy-name");
    const out = fs.readFileSync(path.join(tmp, "README.md"), "utf8");
    expect(out).toContain("# legacy-name");
    expect(out).toContain("body mentioning legacy-name again.");
    expect(out).not.toContain("__APP_NAME__");
  });

  it("replaces both variants in a single pass if both are present", () => {
    fs.writeFileSync(
      path.join(tmp, "README.md"),
      "# **APP_NAME**\nsubtitle __APP_NAME__\n",
    );
    patchReadme(tmp, "mixed");
    const out = fs.readFileSync(path.join(tmp, "README.md"), "utf8");
    expect(out).toBe("# mixed\nsubtitle mixed\n");
  });

  it("is idempotent — already-patched README (no placeholder) is a no-op", () => {
    fs.writeFileSync(path.join(tmp, "README.md"), "# already-named\nbody.");
    patchReadme(tmp, "other-name");
    const out = fs.readFileSync(path.join(tmp, "README.md"), "utf8");
    expect(out).toBe("# already-named\nbody.");
  });

  it("silently no-ops when README.md is missing", () => {
    expect(() => patchReadme(tmp, "x")).not.toThrow();
  });

  it("handles multiple placeholder occurrences (replaceAll)", () => {
    fs.writeFileSync(
      path.join(tmp, "README.md"),
      "**APP_NAME** **APP_NAME** **APP_NAME**",
    );
    patchReadme(tmp, "x");
    expect(fs.readFileSync(path.join(tmp, "README.md"), "utf8")).toBe("x x x");
  });
});
