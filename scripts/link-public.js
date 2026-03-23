#!/usr/bin/env node
/**
 * Postinstall: link or ensure Images/ + weapons-catalog under public/
 *
 * Images resolution order:
 *   1) <appRoot>/Images          (repo contains game assets)
 *   2) <appRoot>/../Images       (legacy: sibling folder next to repo)
 *   3) <appRoot>/public/Images   (already present — skip symlink)
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

function resolveImagesDir() {
  const inside = path.join(root, "Images");
  const sibling = path.join(root, "..", "Images");
  const alreadyPublic = path.join(publicDir, "Images");

  if (fs.existsSync(alreadyPublic)) {
    const st = fs.statSync(alreadyPublic);
    if (st.isDirectory()) {
      const files = fs.readdirSync(alreadyPublic);
      if (files.length > 0) return { mode: "skip", target: alreadyPublic, reason: "public/Images has files" };
    }
  }
  if (fs.existsSync(inside) && fs.statSync(inside).isDirectory()) {
    return { mode: "link", target: inside };
  }
  if (fs.existsSync(sibling) && fs.statSync(sibling).isDirectory()) {
    return { mode: "link", target: sibling };
  }
  return { mode: "none", target: null };
}

const imagesLink = path.join(publicDir, "Images");
const resolved = resolveImagesDir();

if (resolved.mode === "skip") {
  console.log("✓ ", resolved.reason, "—", imagesLink);
} else if (resolved.mode === "link") {
  if (fs.existsSync(imagesLink)) {
    console.log("✓  public/Images already exists");
  } else {
    try {
      const type = process.platform === "win32" ? "junction" : "dir";
      fs.symlinkSync(resolved.target, imagesLink, type);
      console.log("✓  Created public/Images ->", resolved.target);
    } catch (e) {
      console.warn("⚠  Could not create Images symlink:", e.message);
      console.warn("   Expected Images at:", path.join(root, "Images"), "or", path.join(root, "..", "Images"));
    }
  }
} else {
  console.log("⚠  No Images folder found — element/skill icons use committed SVGs under public/game-icons/ and public/game-ammo/.");
}

// --- weapons-catalog.json copy ---
const catalogCandidates = [path.join(root, "weapons-catalog.json"), path.join(root, "..", "weapons-catalog.json")];
let catalogSrc = null;
for (const c of catalogCandidates) {
  if (fs.existsSync(c)) {
    catalogSrc = c;
    break;
  }
}
const catalogDst = path.join(publicDir, "weapons-catalog.json");

if (!catalogSrc) {
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
