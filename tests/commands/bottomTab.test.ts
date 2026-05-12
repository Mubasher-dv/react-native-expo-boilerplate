import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { addRole } from "../../src/commands/role.js";
import { addStandaloneFeature } from "../../src/commands/standaloneFeature.js";
import { addBottomTab } from "../../src/commands/bottomTab.js";

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cmd-bottomtab-"));
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

async function seedRole(t: string, name = "customer"): Promise<void> {
  seedExpoApp(t);
  await addRole(name, {
    target: t,
    promptInputs: async () => ({ feature: "dashboard", screen: "home" }),
  });
}

describe("addBottomTab", () => {
  it("creates (tabs)/ group with _layout, index redirect, and one file per tab; patches role layout", async () => {
    const t = mkTmp();
    await seedRole(t);

    await addBottomTab("customer", {
      target: t,
      promptInputs: async () => ({
        tabs: ["home", "bookings", "profile"],
      }),
    });

    // Tab files exist.
    expect(
      fs.existsSync(path.join(t, "src/app/(customer)/(tabs)/_layout.tsx")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(t, "src/app/(customer)/(tabs)/index.tsx")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(t, "src/app/(customer)/(tabs)/home.tsx")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(t, "src/app/(customer)/(tabs)/bookings.tsx")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(t, "src/app/(customer)/(tabs)/profile.tsx")),
    ).toBe(true);

    // _layout.tsx contains all three Tabs.Screen entries + placeholder icon
    // + hidden-index entry (so the redirect file doesn't render as a phantom tab).
    const layout = fs.readFileSync(
      path.join(t, "src/app/(customer)/(tabs)/_layout.tsx"),
      "utf8",
    );
    expect(layout).toContain('name="home"');
    expect(layout).toContain('name="bookings"');
    expect(layout).toContain('name="profile"');
    expect(layout).toContain("CustomerTabsLayout");
    expect(layout).toContain('Ionicons name="ellipse-outline"');
    expect(layout).toContain('name="index"');
    expect(layout).toContain("options={{ href: null }}");

    // index.tsx redirects to the FIRST tab (home).
    const tabsIndex = fs.readFileSync(
      path.join(t, "src/app/(customer)/(tabs)/index.tsx"),
      "utf8",
    );
    expect(tabsIndex).toContain('<Redirect href="/(customer)/(tabs)/home" />');

    // Each tab file uses inline AppWrapper + AppText placeholder.
    const homeTab = fs.readFileSync(
      path.join(t, "src/app/(customer)/(tabs)/home.tsx"),
      "utf8",
    );
    expect(homeTab).toContain("AppWrapper");
    expect(homeTab).toContain("AppText");
    expect(homeTab).toContain("Home screen");
    expect(homeTab).toContain("export default function Home()");

    // Outer role _layout.tsx now has <Stack.Screen name="(tabs)" />.
    const roleLayout = fs.readFileSync(
      path.join(t, "src/app/(customer)/_layout.tsx"),
      "utf8",
    );
    expect(roleLayout).toContain('<Stack.Screen name="(tabs)" />');
    // Self-closing form was converted to wrapping form.
    expect(roleLayout).toMatch(/<Stack[^/]*?>[\s\S]*?<\/Stack>/);
  });

  it("appends to a wrapping role layout (preserves existing Stack.Screen children)", async () => {
    const t = mkTmp();
    await seedRole(t);
    // Manually rewrite role's _layout.tsx into wrapping form with a child.
    fs.writeFileSync(
      path.join(t, "src/app/(customer)/_layout.tsx"),
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
    await addBottomTab("customer", {
      target: t,
      promptInputs: async () => ({ tabs: ["alpha", "beta"] }),
    });
    const roleLayout = fs.readFileSync(
      path.join(t, "src/app/(customer)/_layout.tsx"),
      "utf8",
    );
    expect(roleLayout).toContain('<Stack.Screen name="home" />');
    expect(roleLayout).toContain('<Stack.Screen name="(tabs)" />');
  });

  it("refuses when role does not exist", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    await expect(
      addBottomTab("ghostRole", {
        target: t,
        promptInputs: async () => ({ tabs: ["a", "b"] }),
      }),
    ).rejects.toThrow(/does not exist/i);
  });

  it("refuses when the name resolves to a standalone feature", async () => {
    const t = mkTmp();
    seedExpoApp(t);
    await addStandaloneFeature("merchant", {
      target: t,
      promptInputs: async () => ({ screen: "login" }),
    });
    await expect(
      addBottomTab("merchant", {
        target: t,
        promptInputs: async () => ({ tabs: ["a", "b"] }),
      }),
    ).rejects.toThrow(/standalone feature/i);
  });

  it("refuses when (tabs)/ already exists", async () => {
    const t = mkTmp();
    await seedRole(t);
    fs.mkdirSync(path.join(t, "src/app/(customer)/(tabs)"), { recursive: true });
    await expect(
      addBottomTab("customer", {
        target: t,
        promptInputs: async () => ({ tabs: ["a", "b"] }),
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it("refuses when role _layout.tsx is in an unexpected shape (no Stack)", async () => {
    const t = mkTmp();
    await seedRole(t);
    fs.writeFileSync(
      path.join(t, "src/app/(customer)/_layout.tsx"),
      "// no stack\n",
    );
    await expect(
      addBottomTab("customer", {
        target: t,
        promptInputs: async () => ({ tabs: ["a", "b"] }),
      }),
    ).rejects.toThrow(/expected shape/i);
    // No (tabs)/ created.
    expect(
      fs.existsSync(path.join(t, "src/app/(customer)/(tabs)")),
    ).toBe(false);
  });

  it("refuses tab count below 2", async () => {
    const t = mkTmp();
    await seedRole(t);
    await expect(
      addBottomTab("customer", {
        target: t,
        promptInputs: async () => ({ tabs: ["onlyOne"] }),
      }),
    ).rejects.toThrow(/between 2 and 5/i);
  });

  it("refuses tab count above 5", async () => {
    const t = mkTmp();
    await seedRole(t);
    await expect(
      addBottomTab("customer", {
        target: t,
        promptInputs: async () => ({
          tabs: ["a", "b", "c", "d", "e", "f"],
        }),
      }),
    ).rejects.toThrow(/between 2 and 5/i);
  });

  it("refuses duplicate tab names within the batch", async () => {
    const t = mkTmp();
    await seedRole(t);
    await expect(
      addBottomTab("customer", {
        target: t,
        promptInputs: async () => ({ tabs: ["home", "home", "profile"] }),
      }),
    ).rejects.toThrow(/duplicate tab name/i);
  });

  it("refuses reserved tab name", async () => {
    const t = mkTmp();
    await seedRole(t);
    await expect(
      addBottomTab("customer", {
        target: t,
        promptInputs: async () => ({ tabs: ["home", "_layout"] }),
      }),
    ).rejects.toThrow(/reserved/i);
  });

  it("rollback: late failure restores role _layout.tsx + removes tab files", async () => {
    const t = mkTmp();
    await seedRole(t);
    const beforeRoleLayout = fs.readFileSync(
      path.join(t, "src/app/(customer)/_layout.tsx"),
      "utf8",
    );
    await expect(
      addBottomTab("customer", {
        target: t,
        promptInputs: async () => ({ tabs: ["home", "profile"] }),
        _failAfterWrites: true,
      }),
    ).rejects.toThrow(/_failAfterWrites/);

    // (tabs)/ does not exist.
    expect(
      fs.existsSync(path.join(t, "src/app/(customer)/(tabs)")),
    ).toBe(false);
    // Role layout snapshot unchanged (no splice).
    expect(
      fs.readFileSync(
        path.join(t, "src/app/(customer)/_layout.tsx"),
        "utf8",
      ),
    ).toBe(beforeRoleLayout);
  });

  it("idempotent re-splice: a second call after manual `(tabs)` removal still works (substring probe)", async () => {
    // Direct unit-level coverage for the substring-probe idempotency lives in
    // shared.test.ts. Here we confirm that the end-to-end command path is
    // re-runnable after the user manually removes the (tabs)/ directory.
    const t = mkTmp();
    await seedRole(t);
    await addBottomTab("customer", {
      target: t,
      promptInputs: async () => ({ tabs: ["home", "profile"] }),
    });
    // Remove the (tabs)/ dir manually (simulating user wipe).
    fs.rmSync(path.join(t, "src/app/(customer)/(tabs)"), {
      recursive: true,
      force: true,
    });
    // Re-run — role _layout.tsx already contains the splice, so
    // `registerTabsInRoleLayout` returns null (idempotent). All other
    // pre-flight guards pass. Should NOT throw.
    await addBottomTab("customer", {
      target: t,
      promptInputs: async () => ({ tabs: ["a", "b"] }),
    });
    expect(
      fs.existsSync(path.join(t, "src/app/(customer)/(tabs)/a.tsx")),
    ).toBe(true);
    // Only ONE <Stack.Screen name="(tabs)" /> line (idempotent re-splice).
    const layout = fs.readFileSync(
      path.join(t, "src/app/(customer)/_layout.tsx"),
      "utf8",
    );
    expect(layout.match(/<Stack\.Screen name="\(tabs\)" \/>/g)?.length).toBe(1);
  });
});
