#!/usr/bin/env node
/**
 * Safe postinstall: runs link-public.js if present (avoids npm hard-failing
 * when a shallow copy or wrong cwd omits scripts/link-public.js).
 */
const fs = require("fs");
const path = require("path");

const linkScript = path.join(__dirname, "link-public.js");

if (!fs.existsSync(linkScript)) {
  console.warn(
    "[postinstall] scripts/link-public.js not found — skipping Images / weapons-catalog setup.",
    "\n  Deploy from the repo root that contains the scripts/ folder, or git pull the full repository."
  );
  process.exit(0);
}

require("./link-public.js");
