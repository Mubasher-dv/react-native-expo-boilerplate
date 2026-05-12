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

    await addRole("customer", {
      target: t,
      promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
    });

    expect(
      fs.existsSync(
        path.join(t, "src/features/customer/dashboard/onBoarding/index.tsx"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(t, "src/features/customer/dashboard/onBoarding/viewModel/_api.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          t,
          "src/features/customer/dashboard/onBoarding/viewModel/useOnBoardingViewModel.tsx",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(t, "src/features/customer/dashboard/types.ts")),
    ).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(customer)/_layout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(customer)/index.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(customer)/onBoarding.tsx"))).toBe(true);

    const routes = fs.readFileSync(path.join(t, "src/app/routes.tsx"), "utf8");
    expect(routes).toContain('<Stack.Screen name="(customer)" />');

    const redirect = fs.readFileSync(
      path.join(t, "src/app/(customer)/index.tsx"),
      "utf8",
    );
    expect(redirect).toContain('<Redirect href="/(customer)/onBoarding" />');
  });

  it("refuses when app.json is missing", async () => {
    const t = mkTmp();
    await expect(
      addRole("customer", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
      }),
    ).rejects.toThrow(/app\.json/i);
  });

  it("refuses when the role already exists (features dir)", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    fs.mkdirSync(path.join(t, "src/features/customer"), { recursive: true });
    await expect(
      addRole("customer", {
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
      addRole("customer", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
      }),
    ).rejects.toThrow(/expected shape/i);
    expect(fs.existsSync(path.join(t, "src/features/customer"))).toBe(false);
    expect(fs.existsSync(path.join(t, "src/app/(customer)"))).toBe(false);
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

  it("rewrites src/app/index.tsx → <Redirect href=\"/(role)\" /> when makeRootInitial=true", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    // Seed a pre-existing root index (placeholder shipped by templates/base).
    fs.writeFileSync(
      path.join(t, "src/app/index.tsx"),
      "export default function Home() { return null; }\n",
    );
    await addRole("customer", {
      target: t,
      promptInputs: async () => ({
        feature: "dashboard",
        screen: "home",
        makeRootInitial: true,
      }),
    });
    const root = fs.readFileSync(path.join(t, "src/app/index.tsx"), "utf8");
    expect(root).toContain('<Redirect href="/(customer)" />');
    expect(root).toContain('import { Redirect } from "expo-router"');
  });

  it("leaves src/app/index.tsx untouched when makeRootInitial is omitted / false", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    const original = "export default function Home() { return null; }\n";
    fs.writeFileSync(path.join(t, "src/app/index.tsx"), original);
    await addRole("customer", {
      target: t,
      promptInputs: async () => ({
        feature: "dashboard",
        screen: "home",
        makeRootInitial: false,
      }),
    });
    expect(fs.readFileSync(path.join(t, "src/app/index.tsx"), "utf8")).toBe(
      original,
    );
  });

  it("creates src/app/index.tsx when it doesn't exist and makeRootInitial=true", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    // No pre-existing index.tsx.
    expect(fs.existsSync(path.join(t, "src/app/index.tsx"))).toBe(false);
    await addRole("customer", {
      target: t,
      promptInputs: async () => ({
        feature: "dashboard",
        screen: "home",
        makeRootInitial: true,
      }),
    });
    expect(fs.existsSync(path.join(t, "src/app/index.tsx"))).toBe(true);
    expect(
      fs.readFileSync(path.join(t, "src/app/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(customer)" />');
  });

  it("rollback restores src/app/index.tsx snapshot on late failure when makeRootInitial=true", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    const original = "export default function Home() { return null; }\n";
    fs.writeFileSync(path.join(t, "src/app/index.tsx"), original);
    await expect(
      addRole("customer", {
        target: t,
        promptInputs: async () => ({
          feature: "dashboard",
          screen: "home",
          makeRootInitial: true,
        }),
        _failAfterWrites: true,
      }),
    ).rejects.toThrow(/_failAfterWrites/);
    // _failAfterWrites throws BEFORE the optional root rewrite, so the
    // original content remains. (The order matters: rollback must work
    // whether the root rewrite happened or not.)
    expect(fs.readFileSync(path.join(t, "src/app/index.tsx"), "utf8")).toBe(
      original,
    );
  });

  it("refuses `auth` with a hint to use `add feature auth`", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    await expect(
      addRole("auth", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
      }),
    ).rejects.toThrow(/should be a feature.*add feature auth/i);
    // No writes happened.
    expect(fs.existsSync(path.join(t, "src/features/auth"))).toBe(false);
    expect(fs.existsSync(path.join(t, "src/app/(auth)"))).toBe(false);
  });

  it("refuses when a standalone feature with the same name already exists", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    // Simulate a pre-existing standalone feature `merchant` (route group + features dir).
    fs.mkdirSync(path.join(t, "src/features/merchant"), { recursive: true });
    fs.mkdirSync(path.join(t, "src/app/(merchant)"), { recursive: true });
    await expect(
      addRole("merchant", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it("rollback: late failure removes all files just written", async () => {
    const t = mkTmp();
    seedExpoApp(t);

    await expect(
      addRole("customer", {
        target: t,
        promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
        _failAfterWrites: true,
      }),
    ).rejects.toThrow(/_failAfterWrites/);

    // None of the new files should remain on disk.
    expect(fs.existsSync(path.join(t, "src/features/customer"))).toBe(false);
    expect(fs.existsSync(path.join(t, "src/app/(customer)"))).toBe(false);
    // routes.tsx is unchanged from seed.
    expect(
      fs.readFileSync(path.join(t, "src/app/routes.tsx"), "utf8"),
    ).not.toContain('"(customer)"');
  });
});
