// Reads Phase 0 probe results from `docs/SDK_NOTES.md`. Each probe wrote a
// `KEY=VALUE` line; this exposes a Map-like lookup so CLI runtime branches
// don't need raw-text grep.

import fs from "node:fs";

export type SDKNotes = Map<string, string>;

export function readSDKNotes(filePath: string): SDKNotes {
  const out: SDKNotes = new Map();
  if (!fs.existsSync(filePath)) {
    // No probe file → CLI runs against an unprobed installation. All callers
    // get conservative defaults (empty Map → `.get()` returns undefined).
    return out;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}
