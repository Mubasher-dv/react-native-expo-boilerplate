import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyBottomSheet, applyImagePicker } from "../src/overlay.js";
import { patchConstants } from "../src/patch.js";
import type { Answers } from "../src/prompts.js";

let target: string;
let templatesRoot: string;

beforeEach(() => {
  target = fs.mkdtempSync(path.join(os.tmpdir(), "cpx-cond-tgt-"));
  templatesRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cpx-cond-tpl-"));

  // Seed a minimal `templates/bottom-sheet/` + `templates/image-picker/` mirror.
  fs.mkdirSync(path.join(templatesRoot, "bottom-sheet/src/ui/appComponents/foo"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(templatesRoot, "bottom-sheet/src/ui/appComponents/foo/index.tsx"),
    "export default function Foo() { return null; }\n",
  );

  fs.mkdirSync(path.join(templatesRoot, "image-picker/src/core/services"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(templatesRoot, "image-picker/src/core/services/PermissionService.ts"),
    "export const ok = true;\n",
  );
  fs.writeFileSync(
    path.join(templatesRoot, "image-picker/media-constants.snippet.ts"),
    "export const SNIPPET = 1;\n",
  );

  // Seed a target with the constants.ts sentinel file.
  fs.mkdirSync(path.join(target, "src/core/utils"), { recursive: true });
  fs.writeFileSync(
    path.join(target, "src/core/utils/constants.ts"),
    "export const A = 1;\n// @@MEDIA_CONSTANTS@@\nexport const B = 2;\n",
  );
});

afterEach(() => {
  fs.rmSync(target, { recursive: true, force: true });
  fs.rmSync(templatesRoot, { recursive: true, force: true });
});

const baseAnswers: Answers = {
  primaryFont: "",
  secondaryFont: "",
  bottomSheet: false,
  imagePicker: false,
  packageManager: "yarn",
};

describe("applyBottomSheet", () => {
  it("copies bottom-sheet subtree onto target", () => {
    applyBottomSheet(target, templatesRoot);
    expect(
      fs.existsSync(path.join(target, "src/ui/appComponents/foo/index.tsx")),
    ).toBe(true);
  });
});

describe("applyImagePicker", () => {
  it("copies src subtree but NOT the snippet file", () => {
    applyImagePicker(target, templatesRoot);
    expect(
      fs.existsSync(
        path.join(target, "src/core/services/PermissionService.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(target, "media-constants.snippet.ts")),
    ).toBe(false);
  });
});

describe("patchConstants", () => {
  it("imagePicker=false → drops sentinel line cleanly (no orphan blank)", () => {
    patchConstants(target, templatesRoot, baseAnswers);
    const out = fs.readFileSync(
      path.join(target, "src/core/utils/constants.ts"),
      "utf8",
    );
    expect(out).toBe("export const A = 1;\nexport const B = 2;\n");
    expect(out).not.toMatch(/@@/);
  });

  it("imagePicker=true → splices snippet contents in place of sentinel", () => {
    patchConstants(target, templatesRoot, { ...baseAnswers, imagePicker: true });
    const out = fs.readFileSync(
      path.join(target, "src/core/utils/constants.ts"),
      "utf8",
    );
    expect(out).toContain("export const SNIPPET = 1;");
    expect(out).not.toMatch(/@@/);
    // Order: A then snippet then B.
    expect(out.indexOf("A = 1")).toBeLessThan(out.indexOf("SNIPPET"));
    expect(out.indexOf("SNIPPET")).toBeLessThan(out.indexOf("B = 2"));
  });
});
