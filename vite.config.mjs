import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { defineConfig } from "vite";

const staticFiles = [
  "firebase-messaging-sw.js",
  "manifest.json",
  "robots.txt",
  "sitemap.xml",
  "_headers",
  ".htaccess",
];

const staticDirs = [
  "articles",
  "bulletin",
  "collabs",
  "commissions",
  "creators",
  "status-wall",
  "vtubers",
];

function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  readdirSync(src).forEach((entry) => {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
      return;
    }
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(srcPath, destPath);
  });
}

function copyStaticPublishFiles() {
  return {
    name: "copy-static-publish-files",
    closeBundle() {
      const root = resolve(".");
      const dist = resolve("dist");

      staticFiles.forEach((file) => {
        const src = join(root, file);
        if (!existsSync(src)) return;
        const dest = join(dist, file);
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(src, dest);
      });

      staticDirs.forEach((dir) => {
        const src = join(root, dir);
        if (!existsSync(src)) return;
        const dest = join(dist, dir);
        rmSync(dest, { recursive: true, force: true });
        copyDirRecursive(src, dest);
      });
    },
  };
}

export default defineConfig({
  appType: "spa",
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
  plugins: [copyStaticPublishFiles()],
});
