const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "dist");
fs.mkdirSync(dist, { recursive: true });

esbuild.buildSync({
  entryPoints: ["src/background.js"],
  bundle: true,
  outfile: "dist/background.bundle.js",
  format: "iife",
  target: "chrome109",
});

esbuild.buildSync({
  entryPoints: ["src/popup.js"],
  bundle: true,
  outfile: "dist/popup.bundle.js",
  format: "iife",
  target: "chrome109",
});

fs.copyFileSync("manifest.json", path.join(dist, "manifest.json"));
fs.copyFileSync(path.join("src", "popup.html"), path.join(dist, "popup.html"));

console.log("Build complete -> dist/");
