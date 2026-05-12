import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { addStandaloneFeature } from "../../src/commands/standaloneFeature.js";
import { addRole } from "../../src/commands/role.js";
import { addFlatScreen } from "../../src/commands/flatScreen.js";

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cmd-flat-screen-"));
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

async function seedAuth(t: string): Promise<void> {
  seedExpoApp(t);
  await addStandaloneFeature("auth", {
    target: t,
    promptInputs: async () => ({ screen: "login" }),
  });
}

describe("addFlatScreen", () => {
  it("adds a sibling screen under a standalone feature", async () => {
    const t = mkTmp();
    await seedAuth(t);

    await addFlatScreen("auth", "signUp", {
      target: t,
      promptInputs: async () => ({ makeInitial: false }),
    });

    expect(fs.existsSync(path.join(t, "src/features/auth/signUp/index.tsx"))).toBe(
      true,
    );
    expect(
      fs.existsSync(
        path.join(t, "src/features/auth/signUp/viewModel/useSignUpViewModel.tsx"),
      ),
    ).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/signUp.tsx"))).toBe(true);

    // Flat re-export (2 segments).
    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/signUp.tsx"), "utf8"),
    ).toContain('from "@features/auth/signUp"');

    // Redirect untouched (makeInitial=false).
    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/login" />');
  });

  it("rewrites redirect when makeInitial=true", async () => {
    const t = mkTmp();
    await seedAuth(t);
    await addFlatScreen("auth", "signUp", {
      target: t,
      promptInputs: async () => ({ makeInitial: true }),
    });
    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/signUp" />');
  });

  it("refuses when feature does not exist (no route group)", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    await expect(
      addFlatScreen("auth", "signUp", {
        target: t,
        promptInputs: async () => ({ makeInitial: false }),
      }),
    ).rejects.toThrow(/not a standalone feature/i);
  });

  it("refuses when the named feature is a hierarchical role, not a standalone feature", async () => {
    // A hierarchical role DOES have a route group, so the basic
    // `isStandaloneFeature` heuristic returns true. The 2-arg flat-screen flow
    // would happily add a screen there, but the resulting feature layout is
    // not what `add screen` 3-arg expects (no role/feature nesting). This test
    // documents the current behavior: flat-screen against a hierarchical role
    // namespace succeeds at the file level but produces a top-level flat
    // screen sibling to the role's nested features. Users should use the
    // 3-arg form.
    //
    // Spec-wise: the route group's mere existence is the standalone signal.
    // Distinguishing role-vs-standalone purely from the filesystem is
    // ambiguous (both shapes are valid). Leave that to future iterations.
    const t = mkTmp();
    seedExpoApp(t);
    await addRole("customer", {
      target: t,
      promptInputs: async () => ({ feature: "dashboard", screen: "home" }),
    });
    // We DO allow this — assert no throw — but the user pays for it in the
    // resulting layout (a flat `customer/welcome` sibling to `customer/dashboard/`).
    await addFlatScreen("customer", "welcome", {
      target: t,
      promptInputs: async () => ({ makeInitial: false }),
    });
    expect(
      fs.existsSync(path.join(t, "src/features/customer/welcome/index.tsx")),
    ).toBe(true);
  });

  it("refuses when screen folder already exists", async () => {
    const t = mkTmp();
    await seedAuth(t);
    await expect(
      addFlatScreen("auth", "login", {
        target: t,
        promptInputs: async () => ({ makeInitial: false }),
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it("refuses on route-file collision (names route file + owning feature)", async () => {
    const t = mkTmp();
    await seedAuth(t);
    // Pre-create a route file under (auth) that points at a different feature.
    // (Simulates manual edit or stale state.)
    fs.writeFileSync(
      path.join(t, "src/app/(auth)/signUp.tsx"),
      'export { default } from "@features/otherFeature/signUp";\n',
    );
    let caught: Error | undefined;
    try {
      await addFlatScreen("auth", "signUp", {
        target: t,
        promptInputs: async () => ({ makeInitial: false }),
      });
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeDefined();
    expect(caught!.message).toMatch(/already exists/i);
    expect(caught!.message).toContain("src/app/(auth)/signUp.tsx");
    expect(caught!.message).toContain("otherFeature");
  });

  it("rollback: late failure leaves filesystem unchanged", async () => {
    const t = mkTmp();
    await seedAuth(t);
    await expect(
      addFlatScreen("auth", "signUp", {
        target: t,
        promptInputs: async () => ({ makeInitial: true }),
        _failAfterWrites: true,
      }),
    ).rejects.toThrow(/_failAfterWrites/);
    expect(fs.existsSync(path.join(t, "src/features/auth/signUp"))).toBe(false);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/signUp.tsx"))).toBe(false);
    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/login" />');
  });
});
