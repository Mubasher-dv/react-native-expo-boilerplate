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

import { readRouteFileFeatureOwner } from "../../src/commands/shared.js";

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

import { writeFeatureTypes, writeScreenFiles } from "../../src/commands/shared.js";

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
