import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";
import * as fontsInstaller from "../../src/fontsInstaller.js";

vi.mock("execa", () => ({ execa: vi.fn() }));
vi.mock("prompts", () => ({ default: vi.fn() }));
vi.mock("node:https", () => ({ default: { get: vi.fn() }, get: vi.fn() }));

import { execa } from "execa";
import prompts from "prompts";
import https from "node:https";

const execaMock = execa as unknown as ReturnType<typeof vi.fn>;
const promptsMock = prompts as unknown as ReturnType<typeof vi.fn>;
const httpsGetMock = (https as unknown as { get: ReturnType<typeof vi.fn> }).get;

let tmp: string;

async function stageInterTarball(): Promise<string> {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "rneb-inter-"));
  const pkg = path.join(stage, "package");
  fs.mkdirSync(path.join(pkg, "400Regular"), { recursive: true });
  fs.writeFileSync(path.join(pkg, "metadata.json"), JSON.stringify({ family: "Inter", variants: ["regular"] }));
  fs.writeFileSync(path.join(pkg, "400Regular", "Inter_400Regular.ttf"), "TTF");
  const out = path.join(stage, "inter.tgz");
  await tar.c({ gzip: true, file: out, cwd: stage }, ["package"]);
  return out;
}

function mockInterFetch(tarballPath: string) {
  // checkPackageExists calls: npm view @expo-google-fonts/inter name
  execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "@expo-google-fonts/inter", stderr: "" });
  // installAndCopy calls: npm view @expo-google-fonts/inter dist.tarball
  execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "https://x/inter.tgz", stderr: "" });
  httpsGetMock.mockImplementationOnce((url: string, cb: (res: any) => void) => {
    const stream = fs.createReadStream(tarballPath);
    cb(Object.assign(stream, { statusCode: 200, headers: {} }));
    return { on: () => {} } as any;
  });
}

function stubProject(withSplashDep: boolean): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rneb-interplay-"));
  fs.writeFileSync(path.join(dir, "app.json"), JSON.stringify({ expo: { name: "x" } }));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({
      dependencies: {
        expo: "^54.0.0",
        ...(withSplashDep ? { "expo-splash-screen": "*" } : {}),
      },
    }),
  );
  fs.writeFileSync(path.join(dir, "yarn.lock"), "");
  fs.mkdirSync(path.join(dir, "src/assets/fonts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src/ui/theme"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src/app"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src/ui/theme/fonts.ts"), "export enum Fonts {}\n");
  fs.writeFileSync(
    path.join(dir, "src/app/_layout.tsx"),
    [
      "export default function RootLayout() {",
      "  return null;",
      "}",
    ].join("\n"),
  );
  return dir;
}

function addSplashDep(dir: string) {
  const p = path.join(dir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
  pkg.dependencies["expo-splash-screen"] = "*";
  fs.writeFileSync(p, JSON.stringify(pkg));
}

function countMatches(s: string, re: RegExp): number {
  return (s.match(re) ?? []).length;
}

beforeEach(() => {
  execaMock.mockReset();
  promptsMock.mockReset();
  httpsGetMock.mockReset();
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
});

afterEach(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe("fonts × splash interplay", () => {
  it("Scenario 1: add fonts → add splash → exactly one useEffect inside marker block", async () => {
    tmp = stubProject(false);
    const tarball = await stageInterTarball();
    mockInterFetch(tarball);
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Inter" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);

    addSplashDep(tmp);
    const { patchLayoutForSplash } = await import("../../src/add.js");
    patchLayoutForSplash(tmp);

    const layout = fs.readFileSync(path.join(tmp, "src/app/_layout.tsx"), "utf8");
    expect(countMatches(layout, /useEffect\s*\(/g)).toBe(1);
    expect(layout).toMatch(/\[fontsLoaded, fontError\]/);
    expect(countMatches(layout, /^SplashScreen\.preventAutoHideAsync\(\)/gm)).toBe(1);
    expect(countMatches(layout, /import\s+\*\s+as\s+SplashScreen/g)).toBe(1);
  });

  it("Scenario 2: add splash → add fonts → exactly one useEffect inside marker block, orphan gone", async () => {
    tmp = stubProject(true); // splash dep already present
    const tarball = await stageInterTarball();
    const { patchLayoutForSplash } = await import("../../src/add.js");
    patchLayoutForSplash(tmp);

    mockInterFetch(tarball);
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Inter" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);

    const layout = fs.readFileSync(path.join(tmp, "src/app/_layout.tsx"), "utf8");
    expect(countMatches(layout, /useEffect\s*\(/g)).toBe(1);
    expect(layout).toMatch(/\[fontsLoaded, fontError\]/);
    expect(layout).not.toMatch(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\)/);
    expect(countMatches(layout, /import\s+\*\s+as\s+SplashScreen/g)).toBe(1);
  });

  it("Scenario 5: add splash → add fonts → re-run add splash → still one useEffect, marker block idempotent", async () => {
    tmp = stubProject(true);
    const tarball = await stageInterTarball();
    const { patchLayoutForSplash } = await import("../../src/add.js");
    patchLayoutForSplash(tmp);

    mockInterFetch(tarball);
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Inter" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);

    const afterFonts = fs.readFileSync(path.join(tmp, "src/app/_layout.tsx"), "utf8");
    patchLayoutForSplash(tmp);
    const afterSecondSplash = fs.readFileSync(path.join(tmp, "src/app/_layout.tsx"), "utf8");

    expect(afterSecondSplash).toBe(afterFonts);
    expect(countMatches(afterSecondSplash, /useEffect\s*\(/g)).toBe(1);
  });

  it("Scenario 4 (C1 regression): re-run add splash after both → still one useEffect, idempotent imports", async () => {
    tmp = stubProject(false);
    const tarball = await stageInterTarball();
    mockInterFetch(tarball);
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Inter" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);
    addSplashDep(tmp);
    const { patchLayoutForSplash } = await import("../../src/add.js");
    patchLayoutForSplash(tmp);
    const afterFirstSplash = fs.readFileSync(path.join(tmp, "src/app/_layout.tsx"), "utf8");

    // Spy ensures the C1 regression guard is active: marker-block-present path must
    // delegate to regenerateFontsMarkerBlock, not short-circuit via substring guard.
    const regenSpy = vi.spyOn(fontsInstaller, "regenerateFontsMarkerBlock");
    patchLayoutForSplash(tmp);
    expect(regenSpy).toHaveBeenCalledWith(tmp);
    regenSpy.mockRestore();

    const afterSecondSplash = fs.readFileSync(path.join(tmp, "src/app/_layout.tsx"), "utf8");
    expect(afterSecondSplash).toBe(afterFirstSplash);
    expect(countMatches(afterSecondSplash, /useEffect\s*\(/g)).toBe(1);
  });

  it("Scenario 3: re-run add fonts after both → sidecar short-circuit (no extra tarball fetch)", async () => {
    tmp = stubProject(false);
    const tarball = await stageInterTarball();
    mockInterFetch(tarball);
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Inter" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);
    addSplashDep(tmp);
    const { patchLayoutForSplash } = await import("../../src/add.js");
    patchLayoutForSplash(tmp);
    const callsAfterFirstRound = execaMock.mock.calls.length;

    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Inter" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    // checkPackageExists still runs on re-run (pre-check before installAndCopy).
    // installAndCopy itself will short-circuit via sidecar — so no dist.tarball call.
    execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "@expo-google-fonts/inter", stderr: "" });
    await addFonts(tmp);

    // Short-circuit must skip the `npm view dist.tarball` call.
    const tarballCalls = execaMock.mock.calls
      .slice(callsAfterFirstRound)
      .filter((args) => Array.isArray(args[1]) && args[1].includes("dist.tarball"));
    expect(tarballCalls.length).toBe(0);

    const layout = fs.readFileSync(path.join(tmp, "src/app/_layout.tsx"), "utf8");
    expect(countMatches(layout, /useEffect\s*\(/g)).toBe(1);
  });
});
