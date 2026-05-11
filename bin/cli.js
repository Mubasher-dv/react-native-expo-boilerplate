#!/usr/bin/env node
import("../dist/index.js").catch((err) => {
  if (err?.code === "ERR_MODULE_NOT_FOUND") {
    console.error("Build artifacts missing. Did you run `yarn build`?");
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
