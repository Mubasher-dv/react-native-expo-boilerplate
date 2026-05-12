import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import * as shared from "../../src/commands/shared.js";
import { normalizeCamelCase, pascalCase } from "../../src/commands/shared.js";
import {
  roleExists,
  featureExists,
  screenExists,
  routeFileExists,
  featureDir,
  screenDir,
  routeGroupDir,
  routeFile,
  redirectFile,
  layoutFile,
} from "../../src/commands/shared.js";

describe("commands/shared", () => {
  it("module loads", () => {
    expect(typeof shared).toBe("object");
  });
});

describe("normalizeCamelCase", () => {
  it("passes through camelCase", () => {
    expect(normalizeCamelCase("teamDetails")).toBe("teamDetails");
  });
  it("splits whitespace", () => {
    expect(normalizeCamelCase("team details")).toBe("teamDetails");
    expect(normalizeCamelCase("  team   details  ")).toBe("teamDetails");
  });
  it("splits hyphen", () => {
    expect(normalizeCamelCase("team-details")).toBe("teamDetails");
  });
  it("splits underscore", () => {
    expect(normalizeCamelCase("team_details")).toBe("teamDetails");
  });
  it("lowercases first char of PascalCase", () => {
    expect(normalizeCamelCase("TeamDetails")).toBe("teamDetails");
  });
  it("keeps digits when not leading", () => {
    expect(normalizeCamelCase("team123")).toBe("team123");
  });
  it("rejects leading digit", () => {
    expect(() => normalizeCamelCase("123team")).toThrow(/cannot start with a digit/i);
  });
  it("rejects empty/whitespace", () => {
    expect(() => normalizeCamelCase("")).toThrow(/empty/i);
    expect(() => normalizeCamelCase("   ")).toThrow(/empty/i);
  });
  it("rejects separator-only input", () => {
    expect(() => normalizeCamelCase("---")).toThrow(/empty/i);
    expect(() => normalizeCamelCase("___")).toThrow(/empty/i);
    expect(() => normalizeCamelCase("-_-_-")).toThrow(/empty/i);
  });
  it("rejects disallowed chars", () => {
    expect(() => normalizeCamelCase("team@details")).toThrow(/invalid character/i);
    expect(() => normalizeCamelCase("team.details")).toThrow(/invalid character/i);
  });
});

describe("pascalCase", () => {
  it("uppercases first char of a camelCase string", () => {
    expect(pascalCase("teamDetails")).toBe("TeamDetails");
    expect(pascalCase("a")).toBe("A");
    expect(pascalCase("auth")).toBe("Auth");
  });
  it("rejects empty", () => {
    expect(() => pascalCase("")).toThrow(/empty/i);
  });
});

import {
  assertRoleName,
  assertFeatureName,
  assertScreenName,
  RESERVED_NAMES,
} from "../../src/commands/shared.js";

describe("assertRoleName / assertFeatureName / assertScreenName", () => {
  it("returns normalized form for valid name", () => {
    expect(assertRoleName("auth")).toBe("auth");
    expect(assertRoleName("user-profile")).toBe("userProfile");
    expect(assertFeatureName("dashboard")).toBe("dashboard");
    expect(assertScreenName("team details")).toBe("teamDetails");
  });

  it("rejects reserved names (case-insensitive vs normalized form)", () => {
    expect(() => assertRoleName("add")).toThrow(/reserved/i);
    expect(() => assertRoleName("ROLE")).toThrow(/reserved/i);
    expect(() => assertFeatureName("feature")).toThrow(/reserved/i);
    expect(() => assertScreenName("index")).toThrow(/reserved/i);
    expect(() => assertScreenName("_layout")).toThrow(/reserved/i);
    expect(() => assertRoleName("bottom-sheet")).toThrow(/reserved/i);
  });

  it("rejects names that exceed 40 chars after normalize", () => {
    const long = "a".repeat(41);
    expect(() => assertRoleName(long)).toThrow(/length/i);
  });

  it("rejects names that fail the post-normalize pattern", () => {
    // pre-normalize check catches @, but post-normalize ensures the produced
    // camelCase still matches /^[a-z][a-zA-Z0-9]*$/. Hard to violate post-normalize
    // because normalize already filters — sanity check: empty produces an error.
    expect(() => assertRoleName("   ")).toThrow();
  });

  it("RESERVED_NAMES contains the documented set", () => {
    for (const r of [
      "add",
      "role",
      "feature",
      "screen",
      "index",
      "_layout",
      "app",
      "features",
      "routes",
      "bottom-sheet",
      "image-picker",
      "app-icon",
      "splash",
    ]) {
      expect(RESERVED_NAMES).toContain(r);
    }
  });
});

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cmd-shared-"));
}

describe("path helpers", () => {
  it("featureDir / screenDir / routeGroupDir / routeFile compute expected paths", () => {
    const t = "/tmp/proj";
    expect(featureDir(t, "auth", "dashboard")).toBe(
      path.join(t, "src/features/auth/dashboard"),
    );
    expect(screenDir(t, "auth", "dashboard", "teamDetails")).toBe(
      path.join(t, "src/features/auth/dashboard/teamDetails"),
    );
    expect(routeGroupDir(t, "auth")).toBe(path.join(t, "src/app/(auth)"));
    expect(routeFile(t, "auth", "onBoarding")).toBe(
      path.join(t, "src/app/(auth)/onBoarding.tsx"),
    );
    expect(redirectFile(t, "auth")).toBe(path.join(t, "src/app/(auth)/index.tsx"));
    expect(layoutFile(t, "auth")).toBe(path.join(t, "src/app/(auth)/_layout.tsx"));
  });
});

describe("existence checks", () => {
  it("roleExists is true when src/features/<role>/ exists", () => {
    const t = mkTmp();
    expect(roleExists(t, "auth")).toBe(false);
    fs.mkdirSync(path.join(t, "src/features/auth"), { recursive: true });
    expect(roleExists(t, "auth")).toBe(true);
  });

  it("roleExists is true when src/app/(<role>)/ exists even if features dir absent", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    expect(roleExists(t, "auth")).toBe(true);
  });

  it("featureExists requires src/features/<role>/<feature>/", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/features/auth"), { recursive: true });
    expect(featureExists(t, "auth", "dashboard")).toBe(false);
    fs.mkdirSync(path.join(t, "src/features/auth/dashboard"), { recursive: true });
    expect(featureExists(t, "auth", "dashboard")).toBe(true);
  });

  it("screenExists requires the screen folder", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/features/auth/dashboard"), { recursive: true });
    expect(screenExists(t, "auth", "dashboard", "teamDetails")).toBe(false);
    fs.mkdirSync(path.join(t, "src/features/auth/dashboard/teamDetails"), {
      recursive: true,
    });
    expect(screenExists(t, "auth", "dashboard", "teamDetails")).toBe(true);
  });

  it("routeFileExists checks the re-export file", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    expect(routeFileExists(t, "auth", "onBoarding")).toBe(false);
    fs.writeFileSync(path.join(t, "src/app/(auth)/onBoarding.tsx"), "");
    expect(routeFileExists(t, "auth", "onBoarding")).toBe(true);
  });
});

import {
  assertNotRoleRefusal,
  buildFlatScreenReExport,
  flatScreenDir,
  flatViewModelDir,
  isStandaloneFeature,
  readFlatRouteFileFeatureOwner,
  readRouteFileFeatureOwner,
  ROLE_REFUSAL_HINTS,
  standaloneFeatureExists,
  topLevelNameTaken,
} from "../../src/commands/shared.js";

describe("ROLE_REFUSAL_HINTS / assertNotRoleRefusal", () => {
  it("rejects `auth` with the documented hint", () => {
    expect(() => assertNotRoleRefusal("auth")).toThrow(
      /should be a feature.*add feature auth/i,
    );
  });

  it("is case-insensitive against the normalized form", () => {
    expect(() => assertNotRoleRefusal("Auth")).toThrow(/should be a feature/i);
    expect(() => assertNotRoleRefusal("AUTH")).toThrow(/should be a feature/i);
  });

  it("does not reject other role names", () => {
    expect(() => assertNotRoleRefusal("customer")).not.toThrow();
    expect(() => assertNotRoleRefusal("merchant")).not.toThrow();
  });

  it("ROLE_REFUSAL_HINTS contains the documented initial entry", () => {
    expect(ROLE_REFUSAL_HINTS).toHaveProperty("auth");
    expect(ROLE_REFUSAL_HINTS.auth).toMatch(/add feature auth/i);
  });
});

describe("isStandaloneFeature / standaloneFeatureExists / topLevelNameTaken", () => {
  it("isStandaloneFeature: true only when route group dir is present", () => {
    const t = mkTmp();
    expect(isStandaloneFeature(t, "auth")).toBe(false);
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    expect(isStandaloneFeature(t, "auth")).toBe(true);
  });

  it("standaloneFeatureExists: true only when BOTH features dir AND route group present", () => {
    const t = mkTmp();
    expect(standaloneFeatureExists(t, "auth")).toBe(false);
    fs.mkdirSync(path.join(t, "src/features/auth"), { recursive: true });
    expect(standaloneFeatureExists(t, "auth")).toBe(false);
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    expect(standaloneFeatureExists(t, "auth")).toBe(true);
  });

  it("topLevelNameTaken: returns kinds 'role', 'groupOnly', 'featuresOnly', or null", () => {
    const t = mkTmp();
    expect(topLevelNameTaken(t, "x")).toBeNull();

    fs.mkdirSync(path.join(t, "src/app/(x)"), { recursive: true });
    expect(topLevelNameTaken(t, "x")).toEqual({ kind: "groupOnly" });

    fs.mkdirSync(path.join(t, "src/features/x"), { recursive: true });
    expect(topLevelNameTaken(t, "x")).toEqual({ kind: "role" });

    const t2 = mkTmp();
    fs.mkdirSync(path.join(t2, "src/features/y"), { recursive: true });
    expect(topLevelNameTaken(t2, "y")).toEqual({ kind: "featuresOnly" });
  });
});

describe("flat path helpers", () => {
  it("flatScreenDir / flatViewModelDir compute 2-segment paths", () => {
    const t = "/tmp/proj";
    expect(flatScreenDir(t, "auth", "login")).toBe(
      path.join(t, "src/features/auth/login"),
    );
    expect(flatViewModelDir(t, "auth", "login")).toBe(
      path.join(t, "src/features/auth/login/viewModel"),
    );
  });
});

describe("buildFlatScreenReExport", () => {
  it("emits a 2-segment @features/<feature>/<screen> import", () => {
    expect(buildFlatScreenReExport("auth", "login").trim()).toBe(
      'export { default } from "@features/auth/login";',
    );
  });
});

describe("readFlatRouteFileFeatureOwner", () => {
  it("extracts owner from a 2-segment flat re-export", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    fs.writeFileSync(
      path.join(t, "src/app/(auth)/signUp.tsx"),
      'export { default } from "@features/auth/signUp";\n',
    );
    expect(readFlatRouteFileFeatureOwner(t, "auth", "signUp")).toBe("auth");
  });

  it("returns null when the file is missing or shape is unfamiliar", () => {
    const t = mkTmp();
    expect(readFlatRouteFileFeatureOwner(t, "auth", "signUp")).toBeNull();
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    fs.writeFileSync(
      path.join(t, "src/app/(auth)/signUp.tsx"),
      "// hand-edited\n",
    );
    expect(readFlatRouteFileFeatureOwner(t, "auth", "signUp")).toBeNull();
  });
});

describe("readRouteFileFeatureOwner", () => {
  it("extracts the feature segment from a standard re-export", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    fs.writeFileSync(
      path.join(t, "src/app/(auth)/settings.tsx"),
      'export { default } from "@features/auth/profile/settings";\n',
    );
    expect(readRouteFileFeatureOwner(t, "auth", "settings")).toBe("profile");
  });

  it("returns null when the file is missing or shape is unfamiliar", () => {
    const t = mkTmp();
    expect(readRouteFileFeatureOwner(t, "auth", "settings")).toBeNull();

    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    fs.writeFileSync(
      path.join(t, "src/app/(auth)/settings.tsx"),
      "// hand-edited, no @features import\n",
    );
    expect(readRouteFileFeatureOwner(t, "auth", "settings")).toBeNull();
  });
});

import {
  newJournal,
  recordCreate,
  recordDir,
  recordEdit,
  rollback,
} from "../../src/commands/shared.js";

import { ensureDirJournaled, writeFileJournaled } from "../../src/commands/shared.js";

describe("Journal + rollback", () => {
  it("rolls back created files", async () => {
    const t = mkTmp();
    const j = newJournal();
    const f = path.join(t, "a.txt");
    fs.writeFileSync(f, "hi");
    recordCreate(j, f);
    expect(fs.existsSync(f)).toBe(true);
    await rollback(j);
    expect(fs.existsSync(f)).toBe(false);
  });

  it("restores edited files to their pre-edit snapshot", async () => {
    const t = mkTmp();
    const f = path.join(t, "a.txt");
    fs.writeFileSync(f, "before");
    const j = newJournal();
    recordEdit(j, f, "before");
    fs.writeFileSync(f, "after");
    expect(fs.readFileSync(f, "utf8")).toBe("after");
    await rollback(j);
    expect(fs.readFileSync(f, "utf8")).toBe("before");
  });

  it("removes empty created dirs (deepest-first) but leaves non-empty alone", async () => {
    const t = mkTmp();
    const d1 = path.join(t, "outer");
    const d2 = path.join(d1, "inner");
    fs.mkdirSync(d2, { recursive: true });
    // outer was effectively created when inner was, but we record both:
    const j = newJournal();
    recordDir(j, d1);
    recordDir(j, d2);
    await rollback(j);
    expect(fs.existsSync(d2)).toBe(false);
    expect(fs.existsSync(d1)).toBe(false);

    // Case: dir is non-empty after rollback (foreign file) → leave it.
    const d3 = path.join(t, "keep");
    fs.mkdirSync(d3);
    fs.writeFileSync(path.join(d3, "foreign.txt"), "user");
    const j2 = newJournal();
    recordDir(j2, d3);
    await rollback(j2);
    expect(fs.existsSync(d3)).toBe(true);
  });

  it("rollback is safe to call on an empty journal", async () => {
    const j = newJournal();
    await expect(rollback(j)).resolves.toBeUndefined();
  });
});

describe("ensureDirJournaled / writeFileJournaled", () => {
  it("ensureDirJournaled records every newly-created dir in the path", () => {
    const t = mkTmp();
    const j = newJournal();
    const deep = path.join(t, "a", "b", "c");
    ensureDirJournaled(j, deep);
    expect(fs.existsSync(deep)).toBe(true);
    expect(j.createdDirs).toEqual(
      expect.arrayContaining([path.join(t, "a"), path.join(t, "a", "b"), deep]),
    );
  });

  it("ensureDirJournaled does NOT record pre-existing dirs", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "a"));
    const j = newJournal();
    ensureDirJournaled(j, path.join(t, "a", "b"));
    expect(j.createdDirs).toEqual([path.join(t, "a", "b")]);
  });

  it("writeFileJournaled records create for new files", () => {
    const t = mkTmp();
    const j = newJournal();
    const f = path.join(t, "new.txt");
    writeFileJournaled(j, f, "hi");
    expect(j.created).toEqual([f]);
    expect(j.edited).toEqual([]);
    expect(fs.readFileSync(f, "utf8")).toBe("hi");
  });

  it("writeFileJournaled records edit for existing files", () => {
    const t = mkTmp();
    const f = path.join(t, "old.txt");
    fs.writeFileSync(f, "before");
    const j = newJournal();
    writeFileJournaled(j, f, "after");
    expect(j.created).toEqual([]);
    expect(j.edited).toEqual([{ path: f, before: "before" }]);
    expect(fs.readFileSync(f, "utf8")).toBe("after");
  });
});

import {
  buildFeatureTypes,
  buildScreenIndex,
  buildScreenViewModel,
  buildScreenApi,
  buildRoleLayout,
  buildRoleRedirect,
  buildScreenReExport,
} from "../../src/commands/shared.js";

describe("template builders", () => {
  it("buildFeatureTypes mentions the feature name in the comment", () => {
    const out = buildFeatureTypes("dashboard");
    expect(out).toMatch(/dashboard/);
    expect(out).toContain("export {};");
  });

  it("buildScreenIndex wires the ViewModel by PascalCase name", () => {
    const out = buildScreenIndex("teamDetails");
    expect(out).toContain('import { useTeamDetailsViewModel } from "./viewModel/useTeamDetailsViewModel"');
    expect(out).toContain("export default function TeamDetails()");
    expect(out).toContain("const {} = useTeamDetailsViewModel();");
    expect(out).toContain("TeamDetails screen");
  });

  it("buildScreenViewModel exports the hook with PascalCase", () => {
    const out = buildScreenViewModel("home");
    expect(out).toContain("export function useHomeViewModel()");
  });

  it("buildScreenApi exports an empty module", () => {
    const out = buildScreenApi("home");
    expect(out).toContain("home");
    expect(out).toContain("export {};");
  });

  it("buildRoleLayout names the layout fn after the role (PascalCase)", () => {
    const out = buildRoleLayout("auth");
    expect(out).toContain("export default function AuthLayout()");
    expect(out).toContain('<Stack screenOptions={{ headerShown: false }} />');
  });

  it("buildRoleRedirect points to /(role)/screen", () => {
    const out = buildRoleRedirect("auth", "onBoarding");
    expect(out).toContain('<Redirect href="/(auth)/onBoarding" />');
    expect(out).toContain("export default function AuthIndex()");
  });

  it("buildScreenReExport re-exports default from @features/<role>/<feature>/<screen>", () => {
    const out = buildScreenReExport("auth", "dashboard", "home");
    expect(out.trim()).toBe(
      'export { default } from "@features/auth/dashboard/home";',
    );
  });
});

import {
  writeFeatureTypes,
  writeFlatRouteReExport,
  writeFlatScreenFiles,
  writeScreenFiles,
  writeStandaloneFeatureTypes,
} from "../../src/commands/shared.js";

describe("writeStandaloneFeatureTypes", () => {
  it("writes features/<feature>/types.ts at the feature root", () => {
    const t = mkTmp();
    const j = newJournal();
    const out = writeStandaloneFeatureTypes(t, "auth", j);
    expect(out).toBe(path.join(t, "src/features/auth/types.ts"));
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.readFileSync(out, "utf8")).toContain("auth");
    expect(j.created).toContain(out);
  });
});

describe("writeFlatScreenFiles", () => {
  it("writes the 3 screen files at features/<feature>/<screen>/", () => {
    const t = mkTmp();
    const j = newJournal();
    const paths = writeFlatScreenFiles(t, "auth", "login", j);
    expect(paths).toEqual([
      path.join(t, "src/features/auth/login/index.tsx"),
      path.join(t, "src/features/auth/login/viewModel/_api.ts"),
      path.join(t, "src/features/auth/login/viewModel/useLoginViewModel.tsx"),
    ]);
    for (const p of paths) {
      expect(fs.existsSync(p)).toBe(true);
      expect(j.created).toContain(p);
    }
  });
});

describe("writeFlatRouteReExport", () => {
  it("writes the flat (2-segment) re-export at src/app/(<feature>)/<screen>.tsx", () => {
    const t = mkTmp();
    const j = newJournal();
    const out = writeFlatRouteReExport(t, "auth", "login", j);
    expect(out).toBe(path.join(t, "src/app/(auth)/login.tsx"));
    expect(fs.readFileSync(out, "utf8")).toBe(
      'export { default } from "@features/auth/login";\n',
    );
    expect(j.created).toContain(out);
  });
});


describe("writeFeatureTypes", () => {
  it("creates features/<role>/<feature>/types.ts and records it", () => {
    const t = mkTmp();
    const j = newJournal();
    const out = writeFeatureTypes(t, "auth", "dashboard", j);
    expect(out).toBe(path.join(t, "src/features/auth/dashboard/types.ts"));
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.readFileSync(out, "utf8")).toContain("dashboard");
    expect(j.created).toContain(out);
  });
});

describe("writeScreenFiles", () => {
  it("creates index.tsx + viewModel/_api.ts + viewModel/use<Pascal>ViewModel.tsx", () => {
    const t = mkTmp();
    const j = newJournal();
    const paths = writeScreenFiles(t, "auth", "dashboard", "teamDetails", j);
    expect(paths).toEqual([
      path.join(t, "src/features/auth/dashboard/teamDetails/index.tsx"),
      path.join(t, "src/features/auth/dashboard/teamDetails/viewModel/_api.ts"),
      path.join(
        t,
        "src/features/auth/dashboard/teamDetails/viewModel/useTeamDetailsViewModel.tsx",
      ),
    ]);
    for (const p of paths) {
      expect(fs.existsSync(p)).toBe(true);
      expect(j.created).toContain(p);
    }
    expect(fs.readFileSync(paths[2]!, "utf8")).toContain("useTeamDetailsViewModel");
  });

  it("rollback restores the filesystem to pre-write state", async () => {
    const t = mkTmp();
    const j = newJournal();
    writeScreenFiles(t, "auth", "dashboard", "teamDetails", j);
    expect(fs.existsSync(path.join(t, "src/features/auth"))).toBe(true);
    await rollback(j);
    expect(fs.existsSync(path.join(t, "src/features/auth"))).toBe(false);
  });
});

import { writeRouteReExport, writeRoleGroup } from "../../src/commands/shared.js";

describe("writeRouteReExport", () => {
  it("writes the thin re-export at src/app/(role)/<screen>.tsx", () => {
    const t = mkTmp();
    const j = newJournal();
    const out = writeRouteReExport(t, "auth", "dashboard", "onBoarding", j);
    expect(out).toBe(path.join(t, "src/app/(auth)/onBoarding.tsx"));
    expect(fs.readFileSync(out, "utf8")).toBe(
      'export { default } from "@features/auth/dashboard/onBoarding";\n',
    );
    expect(j.created).toContain(out);
  });
});

describe("writeRoleGroup", () => {
  it("writes _layout.tsx + index.tsx redirect", () => {
    const t = mkTmp();
    const j = newJournal();
    const paths = writeRoleGroup(t, "auth", "onBoarding", j);
    expect(paths).toEqual([
      path.join(t, "src/app/(auth)/_layout.tsx"),
      path.join(t, "src/app/(auth)/index.tsx"),
    ]);
    expect(fs.readFileSync(paths[0]!, "utf8")).toContain("AuthLayout");
    expect(fs.readFileSync(paths[1]!, "utf8")).toContain(
      '<Redirect href="/(auth)/onBoarding" />',
    );
    for (const p of paths) {
      expect(j.created).toContain(p);
    }
  });
});

import { updateRedirectTarget } from "../../src/commands/shared.js";

describe("updateRedirectTarget", () => {
  it("rewrites the href in (role)/index.tsx and records the prior content", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    const file = path.join(t, "src/app/(auth)/index.tsx");
    const before =
      'import { Redirect } from "expo-router";\n' +
      "export default function AuthIndex() {\n" +
      '  return <Redirect href="/(auth)/login" />;\n' +
      "}\n";
    fs.writeFileSync(file, before);

    const j = newJournal();
    const out = updateRedirectTarget(t, "auth", "dashboard", j);
    expect(out).toBe(file);
    expect(fs.readFileSync(file, "utf8")).toContain(
      '<Redirect href="/(auth)/dashboard" />',
    );
    expect(j.edited).toEqual([{ path: file, before }]);
  });

  it("throws if href pattern is missing", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app/(auth)"), { recursive: true });
    fs.writeFileSync(path.join(t, "src/app/(auth)/index.tsx"), "// no redirect\n");
    const j = newJournal();
    expect(() => updateRedirectTarget(t, "auth", "dashboard", j)).toThrow(
      /redirect/i,
    );
  });
});

import {
  assertRoutesParseable,
  registerRoleInRoutes,
} from "../../src/commands/shared.js";

function writeRoutes(t: string, content: string): string {
  const f = path.join(t, "src/app/routes.tsx");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  return f;
}

const ROUTES_OK =
  'import { Stack } from "expo-router";\n' +
  "\n" +
  "export default function Routes() {\n" +
  "  return (\n" +
  "    <Stack screenOptions={{ headerShown: false }}>\n" +
  '      <Stack.Screen name="index" />\n' +
  "    </Stack>\n" +
  "  );\n" +
  "}\n";

describe("assertRoutesParseable", () => {
  it("passes when the Stack open tag is present", () => {
    const t = mkTmp();
    writeRoutes(t, ROUTES_OK);
    expect(() => assertRoutesParseable(t)).not.toThrow();
  });

  it("throws if routes.tsx is missing", () => {
    const t = mkTmp();
    expect(() => assertRoutesParseable(t)).toThrow(/not found/i);
  });

  it("throws if Stack open tag pattern is absent", () => {
    const t = mkTmp();
    writeRoutes(t, "// no stack here\n");
    expect(() => assertRoutesParseable(t)).toThrow(/expected shape/i);
  });
});

describe("registerRoleInRoutes", () => {
  it('inserts <Stack.Screen name="(role)" /> before </Stack> and records edit', () => {
    const t = mkTmp();
    writeRoutes(t, ROUTES_OK);
    const j = newJournal();
    const out = registerRoleInRoutes(t, "auth", j);
    expect(out).toBe(path.join(t, "src/app/routes.tsx"));
    const after = fs.readFileSync(out!, "utf8");
    expect(after).toContain('<Stack.Screen name="(auth)" />');
    expect(after).toContain('<Stack.Screen name="index" />');
    expect(j.edited).toHaveLength(1);
  });

  it("is idempotent: second call returns null and leaves the file unchanged", () => {
    const t = mkTmp();
    writeRoutes(t, ROUTES_OK);
    const j1 = newJournal();
    registerRoleInRoutes(t, "auth", j1);
    const snapshot = fs.readFileSync(path.join(t, "src/app/routes.tsx"), "utf8");
    const j2 = newJournal();
    const out = registerRoleInRoutes(t, "auth", j2);
    expect(out).toBeNull();
    expect(j2.edited).toEqual([]);
    expect(fs.readFileSync(path.join(t, "src/app/routes.tsx"), "utf8")).toBe(
      snapshot,
    );
  });

  it("idempotency matches substring (handles user-edited Stack.Screen variants)", () => {
    // Spec § routes.tsx patch strategy: idempotent skip when file contains
    // `<Stack.Screen name="(<role>)"` substring — should hold even if the user
    // hand-edited the line to add options or change the closing form.
    const t = mkTmp();
    writeRoutes(
      t,
      'import { Stack } from "expo-router";\n' +
        "\n" +
        "export default function Routes() {\n" +
        "  return (\n" +
        "    <Stack screenOptions={{ headerShown: false }}>\n" +
        '      <Stack.Screen name="index" />\n' +
        '      <Stack.Screen name="(auth)" options={{ animation: "fade" }} />\n' +
        "    </Stack>\n" +
        "  );\n" +
        "}\n",
    );
    const j = newJournal();
    const out = registerRoleInRoutes(t, "auth", j);
    expect(out).toBeNull();
    expect(j.edited).toEqual([]);
  });
});

import { assertExpoApp, printRebuildReminder } from "../../src/commands/shared.js";

describe("assertExpoApp", () => {
  it("throws when app.json is missing", () => {
    const t = mkTmp();
    expect(() => assertExpoApp(t)).toThrow(/app\.json/i);
  });

  it("passes when app.json is present", () => {
    const t = mkTmp();
    fs.writeFileSync(path.join(t, "app.json"), "{}");
    expect(() => assertExpoApp(t)).not.toThrow();
  });
});

describe("printRebuildReminder", () => {
  it("does not throw; emits a message to stdout", () => {
    expect(() => printRebuildReminder()).not.toThrow();
  });
});

import {
  buildRootRedirect,
  rootIndexFile,
  setRootIndexRedirect,
} from "../../src/commands/shared.js";

describe("buildRootRedirect", () => {
  it("emits a <Redirect href=\"/(group)\" /> module with the expo-router import", () => {
    const out = buildRootRedirect("customer");
    expect(out).toContain('import { Redirect } from "expo-router"');
    expect(out).toContain("export default function Index()");
    expect(out).toContain('<Redirect href="/(customer)" />');
  });
});

describe("rootIndexFile", () => {
  it("resolves to src/app/index.tsx under target", () => {
    expect(rootIndexFile("/tmp/proj")).toBe(
      path.join("/tmp/proj", "src/app/index.tsx"),
    );
  });
});

describe("setRootIndexRedirect", () => {
  it("creates src/app/index.tsx when missing; records as create", () => {
    const t = mkTmp();
    const j = newJournal();
    const out = setRootIndexRedirect(t, "customer", j);
    expect(out).toBe(path.join(t, "src/app/index.tsx"));
    expect(fs.existsSync(out!)).toBe(true);
    expect(fs.readFileSync(out!, "utf8")).toContain(
      '<Redirect href="/(customer)" />',
    );
    expect(j.created).toContain(out!);
    expect(j.edited).toEqual([]);
  });

  it("overwrites pre-existing root index; records pre-edit snapshot", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app"), { recursive: true });
    const f = path.join(t, "src/app/index.tsx");
    const before = "export default function Home() { return null; }\n";
    fs.writeFileSync(f, before);
    const j = newJournal();
    const out = setRootIndexRedirect(t, "customer", j);
    expect(out).toBe(f);
    expect(fs.readFileSync(f, "utf8")).toContain(
      '<Redirect href="/(customer)" />',
    );
    expect(j.edited).toEqual([{ path: f, before }]);
  });

  it("is a no-op when the file already redirects to the same group", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app"), { recursive: true });
    const f = path.join(t, "src/app/index.tsx");
    fs.writeFileSync(f, buildRootRedirect("customer"));
    const j = newJournal();
    const out = setRootIndexRedirect(t, "customer", j);
    expect(out).toBeNull();
    expect(j.created).toEqual([]);
    expect(j.edited).toEqual([]);
  });

  it("overwrites when the existing redirect points to a different group", () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app"), { recursive: true });
    const f = path.join(t, "src/app/index.tsx");
    fs.writeFileSync(f, buildRootRedirect("merchant"));
    const j = newJournal();
    const out = setRootIndexRedirect(t, "customer", j);
    expect(out).toBe(f);
    expect(fs.readFileSync(f, "utf8")).toContain(
      '<Redirect href="/(customer)" />',
    );
    expect(fs.readFileSync(f, "utf8")).not.toContain(
      '<Redirect href="/(merchant)" />',
    );
    expect(j.edited).toHaveLength(1);
  });

  it("rollback restores the prior content", async () => {
    const t = mkTmp();
    fs.mkdirSync(path.join(t, "src/app"), { recursive: true });
    const f = path.join(t, "src/app/index.tsx");
    const before = "// custom user content\n";
    fs.writeFileSync(f, before);
    const j = newJournal();
    setRootIndexRedirect(t, "customer", j);
    expect(fs.readFileSync(f, "utf8")).toContain('<Redirect href="/(customer)" />');
    await rollback(j);
    expect(fs.readFileSync(f, "utf8")).toBe(before);
  });
});

import {
  assertRoleLayoutParseable,
  buildTabPlaceholder,
  buildTabsIndexRedirect,
  buildTabsLayout,
  registerTabsInRoleLayout,
  tabRouteFile,
  tabsGroupDir,
  tabsGroupExists,
  tabsIndexFile,
  tabsLayoutFile,
  writeTabsGroup,
} from "../../src/commands/shared.js";

describe("tabs path helpers", () => {
  it("compute expected paths under (role)/(tabs)/", () => {
    const t = "/tmp/proj";
    expect(tabsGroupDir(t, "customer")).toBe(
      path.join(t, "src/app/(customer)/(tabs)"),
    );
    expect(tabsLayoutFile(t, "customer")).toBe(
      path.join(t, "src/app/(customer)/(tabs)/_layout.tsx"),
    );
    expect(tabsIndexFile(t, "customer")).toBe(
      path.join(t, "src/app/(customer)/(tabs)/index.tsx"),
    );
    expect(tabRouteFile(t, "customer", "home")).toBe(
      path.join(t, "src/app/(customer)/(tabs)/home.tsx"),
    );
  });

  it("tabsGroupExists detects the directory", () => {
    const t = mkTmp();
    expect(tabsGroupExists(t, "customer")).toBe(false);
    fs.mkdirSync(path.join(t, "src/app/(customer)/(tabs)"), { recursive: true });
    expect(tabsGroupExists(t, "customer")).toBe(true);
  });
});

describe("buildTabsLayout / buildTabsIndexRedirect / buildTabPlaceholder", () => {
  it("buildTabsLayout renders <RolePascal>TabsLayout with one Tabs.Screen per tab", () => {
    const out = buildTabsLayout("customer", ["home", "bookings", "profile"]);
    expect(out).toContain("export default function CustomerTabsLayout()");
    expect(out).toContain('<Tabs screenOptions={{ headerShown: false }}>');
    expect(out).toContain('name="home"');
    expect(out).toContain('title: "Home"');
    expect(out).toContain('name="bookings"');
    expect(out).toContain('title: "Bookings"');
    expect(out).toContain('name="profile"');
    expect(out).toContain('Ionicons name="ellipse-outline"');
    expect(out).toContain('import { Tabs } from "expo-router"');
    expect(out).toContain('import { Ionicons } from "@expo/vector-icons"');
  });

  it("buildTabsLayout hides (tabs)/index.tsx via `href: null` so it doesn't render as a phantom tab", () => {
    // Expo Router's <Tabs> auto-discovers every file in the directory. Without
    // this hidden entry, `(tabs)/index.tsx` (the redirect file) would appear
    // as a 4th tab in a 3-tab setup. Regression guard for advisor finding.
    const out = buildTabsLayout("customer", ["home", "bookings", "profile"]);
    expect(out).toContain('name="index"');
    expect(out).toContain("options={{ href: null }}");
    // Hidden index entry must come BEFORE the first visible tab so ordering
    // in `_layout.tsx` matches the user-entered tab order.
    const idxAt = out.indexOf('name="index"');
    const homeAt = out.indexOf('name="home"');
    expect(idxAt).toBeGreaterThan(-1);
    expect(homeAt).toBeGreaterThan(idxAt);
  });

  it("buildTabsIndexRedirect points at the first tab", () => {
    const out = buildTabsIndexRedirect("customer", "home");
    expect(out).toContain("export default function CustomerTabsIndex()");
    expect(out).toContain('<Redirect href="/(customer)/(tabs)/home" />');
  });

  it("buildTabPlaceholder renders an inline AppWrapper + AppText body", () => {
    const out = buildTabPlaceholder("home");
    expect(out).toContain("export default function Home()");
    expect(out).toContain("AppWrapper");
    expect(out).toContain("AppText");
    expect(out).toContain("Home screen");
  });
});

describe("writeTabsGroup", () => {
  it("writes _layout, index, and one file per tab; records all creates", () => {
    const t = mkTmp();
    const j = newJournal();
    const out = writeTabsGroup(t, "customer", ["home", "profile"], j);
    expect(out).toEqual([
      path.join(t, "src/app/(customer)/(tabs)/_layout.tsx"),
      path.join(t, "src/app/(customer)/(tabs)/index.tsx"),
      path.join(t, "src/app/(customer)/(tabs)/home.tsx"),
      path.join(t, "src/app/(customer)/(tabs)/profile.tsx"),
    ]);
    for (const p of out) {
      expect(fs.existsSync(p)).toBe(true);
      expect(j.created).toContain(p);
    }
  });

  it("throws on empty tab list", () => {
    const t = mkTmp();
    const j = newJournal();
    expect(() => writeTabsGroup(t, "customer", [], j)).toThrow(/empty/i);
  });
});

describe("assertRoleLayoutParseable", () => {
  function seedRoleLayout(t: string, role: string, content: string): void {
    const dir = path.join(t, `src/app/(${role})`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "_layout.tsx"), content);
  }

  it("accepts self-closing Stack", () => {
    const t = mkTmp();
    seedRoleLayout(
      t,
      "customer",
      'import { Stack } from "expo-router";\n' +
        "export default function CustomerLayout() {\n" +
        "  return <Stack screenOptions={{ headerShown: false }} />;\n" +
        "}\n",
    );
    expect(() => assertRoleLayoutParseable(t, "customer")).not.toThrow();
  });

  it("accepts wrapping Stack", () => {
    const t = mkTmp();
    seedRoleLayout(
      t,
      "customer",
      'import { Stack } from "expo-router";\n' +
        "export default function CustomerLayout() {\n" +
        "  return (\n" +
        "    <Stack screenOptions={{ headerShown: false }}>\n" +
        '      <Stack.Screen name="home" />\n' +
        "    </Stack>\n" +
        "  );\n" +
        "}\n",
    );
    expect(() => assertRoleLayoutParseable(t, "customer")).not.toThrow();
  });

  it("throws when layout file is missing", () => {
    const t = mkTmp();
    expect(() => assertRoleLayoutParseable(t, "customer")).toThrow(/not found/i);
  });

  it("throws when Stack tag pattern is absent", () => {
    const t = mkTmp();
    seedRoleLayout(t, "customer", "// no stack\n");
    expect(() => assertRoleLayoutParseable(t, "customer")).toThrow(/expected shape/i);
  });
});

describe("registerTabsInRoleLayout", () => {
  function seedRoleLayout(t: string, role: string, content: string): string {
    const dir = path.join(t, `src/app/(${role})`);
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, "_layout.tsx");
    fs.writeFileSync(f, content);
    return f;
  }

  it("converts self-closing Stack into wrapping form with <Stack.Screen name=\"(tabs)\" /> child", () => {
    const t = mkTmp();
    const f = seedRoleLayout(
      t,
      "customer",
      'import { Stack } from "expo-router";\n' +
        "\n" +
        "export default function CustomerLayout() {\n" +
        "  return <Stack screenOptions={{ headerShown: false }} />;\n" +
        "}\n",
    );
    const j = newJournal();
    const out = registerTabsInRoleLayout(t, "customer", j);
    expect(out).toBe(f);
    const after = fs.readFileSync(f, "utf8");
    expect(after).toContain('<Stack.Screen name="(tabs)" />');
    expect(after).toContain("</Stack>");
    expect(after).not.toContain("<Stack screenOptions={{ headerShown: false }} />");
    expect(j.edited).toHaveLength(1);
    // Locked-in shape: cleanly-indented multi-line block (regression guard
    // for an earlier bug where indent derivation treated `return ` as
    // leading whitespace and produced `return   <Stack.Screen ...`).
    expect(after).toContain(
      "  return (\n" +
        "    <Stack screenOptions={{ headerShown: false }}>\n" +
        '      <Stack.Screen name="(tabs)" />\n' +
        "    </Stack>\n" +
        "  );",
    );
    // No literal "return   <" artifact.
    expect(after).not.toMatch(/return\s{2,}</);
  });

  it("appends child to a wrapping-form Stack and preserves existing children", () => {
    const t = mkTmp();
    const f = seedRoleLayout(
      t,
      "customer",
      'import { Stack } from "expo-router";\n' +
        "\n" +
        "export default function CustomerLayout() {\n" +
        "  return (\n" +
        "    <Stack screenOptions={{ headerShown: false }}>\n" +
        '      <Stack.Screen name="home" />\n' +
        "    </Stack>\n" +
        "  );\n" +
        "}\n",
    );
    const j = newJournal();
    const out = registerTabsInRoleLayout(t, "customer", j);
    expect(out).toBe(f);
    const after = fs.readFileSync(f, "utf8");
    expect(after).toContain('<Stack.Screen name="home" />');
    expect(after).toContain('<Stack.Screen name="(tabs)" />');
  });

  it("is idempotent — second call returns null and leaves the file unchanged", () => {
    const t = mkTmp();
    const f = seedRoleLayout(
      t,
      "customer",
      'import { Stack } from "expo-router";\n' +
        "\n" +
        "export default function CustomerLayout() {\n" +
        "  return (\n" +
        "    <Stack screenOptions={{ headerShown: false }}>\n" +
        '      <Stack.Screen name="(tabs)" />\n' +
        "    </Stack>\n" +
        "  );\n" +
        "}\n",
    );
    const j = newJournal();
    const out = registerTabsInRoleLayout(t, "customer", j);
    expect(out).toBeNull();
    expect(j.edited).toEqual([]);
    const after = fs.readFileSync(f, "utf8");
    expect(after.match(/<Stack\.Screen name="\(tabs\)" \/>/g)?.length).toBe(1);
  });
});

describe("RESERVED_NAMES additions", () => {
  it("contains bottom-tab + tabs", () => {
    expect(RESERVED_NAMES).toContain("bottom-tab");
    expect(RESERVED_NAMES).toContain("tabs");
  });
});
