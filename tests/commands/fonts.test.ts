import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";

vi.mock("execa", () => ({ execa: vi.fn() }));
vi.mock("prompts", () => ({ default: vi.fn() }));
vi.mock("node:https", () => ({ default: { get: vi.fn() }, get: vi.fn() }));

import { execa } from "execa";
import prompts from "prompts";
import https from "node:https";
import { writeSidecar } from "../../src/fontsInstaller.js";

const execaMock = execa as unknown as ReturnType<typeof vi.fn>;
const promptsMock = prompts as unknown as ReturnType<typeof vi.fn>;
const httpsGetMock = (https as unknown as { get: ReturnType<typeof vi.fn> }).get;

async function stageFontTarball(family: string, fileBase: string): Promise<string> {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "rneb-fonts-cmd-"));
  const pkg = path.join(stage, "package");
  fs.mkdirSync(path.join(pkg, "400Regular"), { recursive: true });
  fs.writeFileSync(
    path.join(pkg, "metadata.json"),
    JSON.stringify({ family, variants: ["regular"] }),
  );
  fs.writeFileSync(path.join(pkg, "400Regular", `${fileBase}_400Regular.ttf`), "TTF");
  const out = path.join(stage, `${fileBase.toLowerCase()}.tgz`);
  await tar.c({ gzip: true, file: out, cwd: stage }, ["package"]);
  return out;
}

function mockFontFetch(tarballPath: string) {
  execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "pkg-name", stderr: "" });
  execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "https://x/pkg.tgz", stderr: "" });
  httpsGetMock.mockImplementationOnce((_url: string, cb: (res: any) => void) => {
    const stream = fs.createReadStream(tarballPath);
    cb(Object.assign(stream, { statusCode: 200, headers: {} }));
    return { on: () => {} } as any;
  });
}

let tmp: string;

function stubExpoProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rneb-recipe-"));
  fs.writeFileSync(path.join(dir, "app.json"), JSON.stringify({ expo: { name: "x" } }));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ dependencies: { expo: "^54.0.0" } }),
  );
  fs.writeFileSync(path.join(dir, "yarn.lock"), "");
  fs.mkdirSync(path.join(dir, "src/assets/fonts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src/ui/theme"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src/app"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "src/ui/theme/fonts.ts"),
    "export enum Fonts {}\n",
  );
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

beforeEach(() => {
  execaMock.mockReset();
  promptsMock.mockReset();
  httpsGetMock.mockReset();
  tmp = stubExpoProject();
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("addFonts recipe", () => {
  it("empty primary + no sidecar → exits no-op", async () => {
    promptsMock.mockResolvedValueOnce({ primaryFont: "" });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);
    expect(execaMock).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(tmp, "src/ui/theme/fonts.ts"), "utf8")).toBe("export enum Fonts {}\n");
  });

  it("empty primary + sidecar present + confirm 'y' → wipe (Decision #14)", async () => {
    writeSidecar(tmp, {
      schemaVersion: 1,
      markerSyntax: "codingpixel:fonts",
      primary: { displayName: "Inter", fileBase: "Inter", variants: [] },
      secondary: null,
    });
    fs.writeFileSync(path.join(tmp, "src/assets/fonts/Inter-Regular.ttf"), "");
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "" })
      .mockResolvedValueOnce({ confirmWipe: true });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);
    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/.codingpixel-fonts.json"))).toBe(false);
    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/Inter-Regular.ttf"))).toBe(false);
  });

  it("empty primary + sidecar present + confirm 'N' → no-op", async () => {
    writeSidecar(tmp, {
      schemaVersion: 1,
      markerSyntax: "codingpixel:fonts",
      primary: { displayName: "Inter", fileBase: "Inter", variants: [] },
      secondary: null,
    });
    fs.writeFileSync(path.join(tmp, "src/assets/fonts/Inter-Regular.ttf"), "");
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "" })
      .mockResolvedValueOnce({ confirmWipe: false });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);
    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/.codingpixel-fonts.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/Inter-Regular.ttf"))).toBe(true);
  });

  it("primary-only install → writes TTF + sidecar, secondary null", async () => {
    const tarball = await stageFontTarball("Inter", "Inter");
    mockFontFetch(tarball);
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Inter" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);
    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/Inter-Regular.ttf"))).toBe(true);
    const sidecar = JSON.parse(
      fs.readFileSync(path.join(tmp, "src/assets/fonts/.codingpixel-fonts.json"), "utf8"),
    );
    expect(sidecar.primary.displayName).toBe("Inter");
    expect(sidecar.secondary).toBeNull();
  });

  it("idempotent re-run → sidecar short-circuit, no dist.tarball call", async () => {
    const tarball = await stageFontTarball("Inter", "Inter");
    mockFontFetch(tarball);
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Inter" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);
    const callsAfterFirst = execaMock.mock.calls.length;

    // Second run: checkPackageExists still runs; installAndCopy short-circuits via sidecar.
    execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "@expo-google-fonts/inter", stderr: "" });
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Inter" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    await addFonts(tmp);

    const tarballCalls = execaMock.mock.calls
      .slice(callsAfterFirst)
      .filter((args) => Array.isArray(args[1]) && (args[1] as string[]).includes("dist.tarball"));
    expect(tarballCalls.length).toBe(0);
  });

  it("family swap → old TTFs removed, new TTFs written", async () => {
    const tarball1 = await stageFontTarball("Inter", "Inter");
    mockFontFetch(tarball1);
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Inter" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);
    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/Inter-Regular.ttf"))).toBe(true);

    const tarball2 = await stageFontTarball("Roboto", "Roboto");
    execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "@expo-google-fonts/roboto", stderr: "" });
    execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "https://x/roboto.tgz", stderr: "" });
    httpsGetMock.mockImplementationOnce((_url: string, cb: (res: any) => void) => {
      const stream = fs.createReadStream(tarball2);
      cb(Object.assign(stream, { statusCode: 200, headers: {} }));
      return { on: () => {} } as any;
    });
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Roboto" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    await addFonts(tmp);

    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/Inter-Regular.ttf"))).toBe(false);
    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/Roboto-Regular.ttf"))).toBe(true);
  });

  it("user-placed TTF (non-recipe-pattern name) is preserved during install", async () => {
    fs.writeFileSync(path.join(tmp, "src/assets/fonts/CustomFont.ttf"), "USER");
    const tarball = await stageFontTarball("Inter", "Inter");
    mockFontFetch(tarball);
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Inter" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);
    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/CustomFont.ttf"))).toBe(true);
  });

  it("fonts.ts updated with populated enum after install", async () => {
    const tarball = await stageFontTarball("Inter", "Inter");
    mockFontFetch(tarball);
    promptsMock
      .mockResolvedValueOnce({ primaryFont: "Inter" })
      .mockResolvedValueOnce({ secondaryFont: "" });
    const { addFonts } = await import("../../src/commands/fonts.js");
    await addFonts(tmp);
    const fontsTsContent = fs.readFileSync(path.join(tmp, "src/ui/theme/fonts.ts"), "utf8");
    expect(fontsTsContent).toContain("export enum Fonts {");
    expect(fontsTsContent).toContain("REGULAR");
  });
});
