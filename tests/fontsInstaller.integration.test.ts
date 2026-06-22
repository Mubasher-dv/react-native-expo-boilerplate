import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));
vi.mock("node:https", () => ({
  default: { get: vi.fn() },
  get: vi.fn(),
}));

import { execa } from "execa";
import https from "node:https";
import { installAndCopy } from "../src/fontsInstaller.js";

const execaMock = execa as unknown as ReturnType<typeof vi.fn>;
const httpsGetMock = (https as unknown as { get: ReturnType<typeof vi.fn> }).get;

let tmp: string;

beforeEach(() => {
  execaMock.mockReset();
  httpsGetMock.mockReset();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rneb-fonts-int-"));
  fs.mkdirSync(path.join(tmp, "src/assets/fonts"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ dependencies: { expo: "^54.0.0" } }));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function stageFakeTarball(opts: {
  family: string;
  fileBase: string;
  variants: Array<{ token: string; dir: string }>;
}): Promise<string> {
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), "rneb-stage-"));
  const pkgDir = path.join(stageDir, "package");
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(
    path.join(pkgDir, "metadata.json"),
    JSON.stringify({ family: opts.family, variants: opts.variants.map((v) => v.token) }),
  );
  for (const v of opts.variants) {
    const dir = path.join(pkgDir, v.dir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${opts.fileBase}_${v.dir}.ttf`), "TTF-BYTES-STUB");
  }
  const tarballPath = path.join(stageDir, "out.tgz");
  await tar.c({ gzip: true, file: tarballPath, cwd: stageDir }, ["package"]);
  return tarballPath;
}

describe("installAndCopy — tarball-direct flow", () => {
  it("Inter (full 9-weight) emits all 9 keys + writes TTFs", async () => {
    const tarballPath = await stageFakeTarball({
      family: "Inter",
      fileBase: "Inter",
      variants: [
        { token: "100", dir: "100Thin" },
        { token: "200", dir: "200ExtraLight" },
        { token: "300", dir: "300Light" },
        { token: "regular", dir: "400Regular" },
        { token: "500", dir: "500Medium" },
        { token: "600", dir: "600SemiBold" },
        { token: "700", dir: "700Bold" },
        { token: "800", dir: "800ExtraBold" },
        { token: "italic", dir: "400Regular_Italic" },
      ],
    });

    execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "https://registry.npmjs.org/inter.tgz", stderr: "" });
    httpsGetMock.mockImplementationOnce((url: string, cb: (res: any) => void) => {
      const stream = fs.createReadStream(tarballPath);
      const fakeRes = Object.assign(stream, { statusCode: 200, headers: {} });
      cb(fakeRes);
      return { on: () => {} } as any;
    });

    const installed = await installAndCopy(tmp, "Inter", "primary");

    expect(installed.displayName).toBe("Inter");
    expect(installed.fileBase).toBe("Inter");
    expect(installed.variants.map((v) => v.enumKey).sort()).toEqual(
      ["BOLD", "EXTRA_BOLD", "EXTRA_LIGHT", "ITALIC", "LIGHT", "MEDIUM", "REGULAR", "SEMI_BOLD", "THIN"],
    );
    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/Inter-Bold.ttf"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/Inter-Italic.ttf"))).toBe(true);
  });

  it("Sansita (partial) emits only REGULAR/BOLD/EXTRA_BOLD/ITALIC", async () => {
    const tarballPath = await stageFakeTarball({
      family: "Sansita",
      fileBase: "Sansita",
      variants: [
        { token: "regular", dir: "400Regular" },
        { token: "700", dir: "700Bold" },
        { token: "800", dir: "800ExtraBold" },
        { token: "italic", dir: "400Regular_Italic" },
      ],
    });

    execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "https://registry.npmjs.org/sansita.tgz", stderr: "" });
    httpsGetMock.mockImplementationOnce((url: string, cb: (res: any) => void) => {
      const stream = fs.createReadStream(tarballPath);
      cb(Object.assign(stream, { statusCode: 200, headers: {} }));
      return { on: () => {} } as any;
    });

    const installed = await installAndCopy(tmp, "Sansita", "primary");
    expect(installed.variants.map((v) => v.enumKey).sort()).toEqual(
      ["BOLD", "EXTRA_BOLD", "ITALIC", "REGULAR"],
    );
  });

  it("Open Sans (multi-word) emits correct TTFs + InstalledFamily", async () => {
    const tarballPath = await stageFakeTarball({
      family: "Open Sans",
      fileBase: "OpenSans",
      variants: [
        { token: "regular", dir: "400Regular" },
        { token: "700", dir: "700Bold" },
      ],
    });

    execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "https://x/open-sans.tgz", stderr: "" });
    httpsGetMock.mockImplementationOnce((_url: string, cb: (res: unknown) => void) => {
      const stream = fs.createReadStream(tarballPath);
      cb(Object.assign(stream, { statusCode: 200, headers: {} }));
      return { on: () => {} } as any;
    });

    const installed = await installAndCopy(tmp, "Open Sans", "primary");

    expect(installed.displayName).toBe("Open Sans");
    expect(installed.fileBase).toBe("OpenSans");
    expect(installed.variants.map((v) => v.enumKey).sort()).toEqual(["BOLD", "REGULAR"]);
    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/OpenSans-Regular.ttf"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "src/assets/fonts/OpenSans-Bold.ttf"))).toBe(true);
  });

  it("M6 invariant: package.json + lockfile untouched after installAndCopy", async () => {
    const tarballPath = await stageFakeTarball({
      family: "Inter",
      fileBase: "Inter",
      variants: [{ token: "regular", dir: "400Regular" }],
    });
    fs.writeFileSync(path.join(tmp, "package-lock.json"), '{"name":"x"}');
    const pkgBefore = fs.readFileSync(path.join(tmp, "package.json"), "utf8");
    const lockBefore = fs.readFileSync(path.join(tmp, "package-lock.json"), "utf8");

    execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: "https://x/inter.tgz", stderr: "" });
    httpsGetMock.mockImplementationOnce((url: string, cb: (res: any) => void) => {
      const stream = fs.createReadStream(tarballPath);
      cb(Object.assign(stream, { statusCode: 200, headers: {} }));
      return { on: () => {} } as any;
    });

    await installAndCopy(tmp, "Inter", "primary");

    expect(fs.readFileSync(path.join(tmp, "package.json"), "utf8")).toBe(pkgBefore);
    expect(fs.readFileSync(path.join(tmp, "package-lock.json"), "utf8")).toBe(lockBefore);
  });
});

describe("Decision #15 short-circuit", () => {
  it("returns cached InstalledFamily when sidecar matches; never calls execa", async () => {
    const dir = path.join(tmp, "src/assets/fonts");
    fs.writeFileSync(path.join(dir, "Inter-Regular.ttf"), "");
    const cached = {
      displayName: "Inter",
      fileBase: "Inter",
      variants: [{ google: "regular", enumKey: "REGULAR", suffix: "-Regular" }],
    };
    const { writeSidecar } = await import("../src/fontsInstaller.js");
    writeSidecar(tmp, {
      schemaVersion: 1,
      markerSyntax: "codingpixel:fonts",
      primary: cached,
      secondary: null,
    });

    const result = await installAndCopy(tmp, "Inter", "primary");

    expect(result).toEqual(cached);
    expect(execaMock).not.toHaveBeenCalled();
  });
});
