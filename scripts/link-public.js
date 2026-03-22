#!/usr/bin/env node
/**
 * Postinstall script: links Images/ and weapons-catalog.json into public/
 * so Next.js can serve them as static assets.
 *
 * Run automatically via "postinstall" in package.json, or manually:
 *   node scripts/link-public.js
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, ".."); // tfd-web/
const repoRoot = path.resolve(root, ".."); // TFD/
const publicDir = path.join(root, "public");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// --- Images symlink ---
const imagesTarget = path.join(repoRoot, "Images");
const imagesLink = path.join(publicDir, "Images");

if (!fs.existsSync(imagesTarget)) {
  console.log("⚠  Images/ not found at", imagesTarget, "— skipping symlink");
} else if (fs.existsSync(imagesLink)) {
  console.log("✓  public/Images already exists");
} else {
  try {
    // 'junction' works on Windows dirs; regular symlink used on Linux/Mac
    const type = process.platform === "win32" ? "junction" : "dir";
    fs.symlinkSync(imagesTarget, imagesLink, type);
    console.log("✓  Created public/Images ->", imagesTarget);
  } catch (e) {
    console.warn("⚠  Could not create Images symlink:", e.message);
    console.warn("   Run manually: ln -s ../../Images tfd-web/public/Images");
  }
}

// --- weapons-catalog.json copy ---
const catalogSrc = path.join(repoRoot, "weapons-catalog.json");
const catalogDst = path.join(publicDir, "weapons-catalog.json");

if (!fs.existsSync(catalogSrc)) {
  console.log("⚠  weapons-catalog.json not found — skipping copy");
} else if (fs.existsSync(catalogDst)) {
  const srcMtime = fs.statSync(catalogSrc).mtimeMs;
  const dstMtime = fs.statSync(catalogDst).mtimeMs;
  if (srcMtime > dstMtime) {
    fs.copyFileSync(catalogSrc, catalogDst);
    console.log("✓  Updated public/weapons-catalog.json");
  } else {
    console.log("✓  public/weapons-catalog.json is up to date");
  }
} else {
  fs.copyFileSync(catalogSrc, catalogDst);
  console.log("✓  Copied weapons-catalog.json to public/");
}
