import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { addRole } from "../../src/commands/role.js";
import { addFeature } from "../../src/commands/feature.js";

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cmd-feature-"));
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

async function seedRole(t: string): Promise<void> {
  seedExpoApp(t);
  await addRole("auth", {
    target: t,
    promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
  });
}

describe("addFeature", () => {
  it("adds a new feature + screen + re-export", async () => {
    const t = mkTmp();
    await seedRole(t);

    await addFeature("auth", "profile", {
      target: t,
      promptInputs: async () => ({ screen: "edit", makeInitial: false }),
    });

    expect(fs.existsSync(path.join(t, "src/features/auth/profile/types.ts"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(t, "src/features/auth/profile/edit/index.tsx")),
    ).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/edit.tsx"))).toBe(true);

    // Redirect untouched (makeInitial=false).
    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/onBoarding" />');
  });

  it("rewrites redirect when makeInitial=true", async () => {
    const t = mkTmp();
    await seedRole(t);

    await addFeature("auth", "profile", {
      target: t,
      promptInputs: async () => ({ screen: "edit", makeInitial: true }),
    });

    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/edit" />');
  });

  it("refuses when role does not exist", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    await expect(
      addFeature("auth", "profile", {
        target: t,
        promptInputs: async () => ({ screen: "edit", makeInitial: false }),
      }),
    ).rejects.toThrow(/role.*does not exist/i);
  });

  it("refuses when feature already exists", async () => {
    const t = mkTmp();
    await seedRole(t);
    await expect(
      addFeature("auth", "dashboard", {
        target: t,
        promptInputs: async () => ({ screen: "extra", makeInitial: false }),
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it("refuses on route-file collision (screen name conflicts with existing route)", async () => {
    const t = mkTmp();
    await seedRole(t);
    await expect(
      addFeature("auth", "profile", {
        target: t,
        promptInputs: async () => ({ screen: "onBoarding", makeInitial: false }),
      }),
    ).rejects.toThrow(/already exists/i);
    // Profile feature was NOT created (pre-flight refusal).
    expect(fs.existsSync(path.join(t, "src/features/auth/profile"))).toBe(false);
  });

  it("rollback: late failure removes the just-created feature", async () => {
    const t = mkTmp();
    await seedRole(t);
    await expect(
      addFeature("auth", "profile", {
        target: t,
        promptInputs: async () => ({ screen: "edit", makeInitial: true }),
        _failAfterWrites: true,
      }),
    ).rejects.toThrow(/_failAfterWrites/);
    expect(fs.existsSync(path.join(t, "src/features/auth/profile"))).toBe(false);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/edit.tsx"))).toBe(false);
    // Redirect remains at original onBoarding target (rollback restored).
    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/onBoarding" />');
  });
});
