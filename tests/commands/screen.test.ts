import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { addRole } from "../../src/commands/role.js";
import { addFeature } from "../../src/commands/feature.js";
import { addScreen } from "../../src/commands/screen.js";

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cmd-screen-"));
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

async function seedFeature(t: string): Promise<void> {
  seedExpoApp(t);
  await addRole("auth", {
    target: t,
    promptInputs: async () => ({ feature: "dashboard", screen: "onBoarding" }),
  });
}

describe("addScreen", () => {
  it("adds a sibling screen to an existing feature", async () => {
    const t = mkTmp();
    await seedFeature(t);

    await addScreen("auth", "dashboard", "teamDetails", {
      target: t,
      promptInputs: async () => ({ makeInitial: false }),
    });

    expect(
      fs.existsSync(
        path.join(t, "src/features/auth/dashboard/teamDetails/index.tsx"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          t,
          "src/features/auth/dashboard/teamDetails/viewModel/useTeamDetailsViewModel.tsx",
        ),
      ),
    ).toBe(true);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/teamDetails.tsx"))).toBe(
      true,
    );
  });

  it("rewrites redirect when makeInitial=true", async () => {
    const t = mkTmp();
    await seedFeature(t);
    await addScreen("auth", "dashboard", "teamDetails", {
      target: t,
      promptInputs: async () => ({ makeInitial: true }),
    });
    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/teamDetails" />');
  });

  it("refuses when feature does not exist", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    await expect(
      addScreen("auth", "dashboard", "teamDetails", {
        target: t,
        promptInputs: async () => ({ makeInitial: false }),
      }),
    ).rejects.toThrow(/feature.*does not exist/i);
  });

  it("refuses when screen folder already exists", async () => {
    const t = mkTmp();
    await seedFeature(t);
    await expect(
      addScreen("auth", "dashboard", "onBoarding", {
        target: t,
        promptInputs: async () => ({ makeInitial: false }),
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it("refuses on route-file collision across features (names route file + owning feature)", async () => {
    const t = mkTmp();
    await seedFeature(t);
    await addFeature("auth", "profile", {
      target: t,
      promptInputs: async () => ({ screen: "settings", makeInitial: false }),
    });
    // Now try to add `settings` under `dashboard` — collides with profile/settings's route file.
    let caught: Error | undefined;
    try {
      await addScreen("auth", "dashboard", "settings", {
        target: t,
        promptInputs: async () => ({ makeInitial: false }),
      });
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeDefined();
    // Spec § screen step 4: error names the existing route file AND its feature.
    expect(caught!.message).toMatch(/already exists/i);
    expect(caught!.message).toContain("src/app/(auth)/settings.tsx");
    expect(caught!.message).toContain("auth/profile");
  });

  it("rollback: late failure leaves filesystem unchanged", async () => {
    const t = mkTmp();
    await seedFeature(t);
    await expect(
      addScreen("auth", "dashboard", "teamDetails", {
        target: t,
        promptInputs: async () => ({ makeInitial: true }),
        _failAfterWrites: true,
      }),
    ).rejects.toThrow(/_failAfterWrites/);
    expect(
      fs.existsSync(path.join(t, "src/features/auth/dashboard/teamDetails")),
    ).toBe(false);
    expect(fs.existsSync(path.join(t, "src/app/(auth)/teamDetails.tsx"))).toBe(
      false,
    );
    expect(
      fs.readFileSync(path.join(t, "src/app/(auth)/index.tsx"), "utf8"),
    ).toContain('<Redirect href="/(auth)/onBoarding" />');
  });
});
