import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { addRole } from "../../src/commands/role.js";

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cmd-role-"));
}

function seedExpoApp(t: string): void {
  fs.writeFileSync(path.join(t, "app.json"), "{}");
  fs.mkdirSync(path.join(t, "src/app"), { recursive: true });
  fs.writeFileSync(
    path.join(t, "src/app/routes.tsx"),
    'import { Stack } from "expo-router";\n' +
      "\n" +
      "export default function Routes() {\n" +
      "  return (\n" +
      "    <Stack screenOptions={{ headerShown: false }}>\n" +
      '      <Stack.Screen name="index" />\n' +
      "    </Stack>\n" +
      "  );\n" +
      "}\n",
  );
}

describe("addRole", () => {
  it("creates features tree + route group + registers in routes.tsx", async () => {
    const t = mkTmp();
    seedExpoApp(t);

    await addRole("auth", {
      target: t,
      promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
    });

    expect(
      fs.existsSync(
        path.join(t, "src/features/auth/dashboard/onBoarding/index.tsx"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(t, "src/features/auth/dashboard/onBoarding/viewModel/_api.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          t,
          "src/features/auth/dashboard/onBoarding/viewModel/useOnBoardingViewModel.tsx",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(t, "src/features/auth/dashboard/types.ts")),
    ).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/_layout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/index.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/onBoarding.tsx"))).toBe(true);

    const routes = fs.readFileSync(path.join(t, "src/app/routes.tsx"), "utf8");
    expect(routes).toContain('<Stack.Screen name="(auth)" />');

    const redirect = fs.readFileSync(
      path.join(t, "src/app/(auth)/index.tsx"),
      "utf8",
    );
    expect(redirect).toContain('<Redirect href="/(auth)/onBoarding" />');
  });

  it("refuses when app.json is missing", async () => {
    const t = mkTmp();
    await expect(
      addRole("auth", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
      }),
    ).rejects.toThrow(/app\.json/i);
  });

  it("refuses when the role already exists (features dir)", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    fs.mkdirSync(path.join(t, "src/features/auth"), { recursive: true });
    await expect(
      addRole("auth", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it("refuses with malformed routes.tsx (no writes happen)", async () => {
    const t = mkTmp();
    fs.writeFileSync(path.join(t, "app.json"), "{}");
    fs.mkdirSync(path.join(t, "src/app"), { recursive: true });
    fs.writeFileSync(path.join(t, "src/app/routes.tsx"), "// no stack\n");
    await expect(
      addRole("auth", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
      }),
    ).rejects.toThrow(/expected shape/i);
    expect(fs.existsSync(path.join(t, "src/features/auth"))).toBe(false);
    expect(fs.existsSync(path.join(t, "src/app/(auth)"))).toBe(false);
  });

  it("rejects reserved role name", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    await expect(
      addRole("add", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
      }),
    ).rejects.toThrow(/reserved/i);
  });

  it("rollback: late failure removes all files just written", async () => {
    const t = mkTmp();
    seedExpoApp(t);

    await expect(
      addRole("auth", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
        _failAfterWrites: true,
      }),
    ).rejects.toThrow(/_failAfterWrites/);

    // None of the new files should remain on disk.
    expect(fs.existsSync(path.join(t, "src/features/auth"))).toBe(false);
    expect(fs.existsSync(path.join(t, "src/app/(auth)"))).toBe(false);
    // routes.tsx is unchanged from seed.
    expect(
      fs.readFileSync(path.join(t, "src/app/routes.tsx"), "utf8"),
    ).not.toContain('"(auth)"');
  });
});
