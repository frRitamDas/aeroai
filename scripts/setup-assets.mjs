#!/usr/bin/env node
/**
 * Copies static runtime assets that ship inside npm packages into /public so
 * they can be served same-origin (no CDN round trip, no bundler worker quirks):
 *   - pdf.js web worker (used to rasterise PDF pages)
 *
 * Run automatically via `postinstall`, `predev` and `prebuild`.
 */
import { copyFile, mkdir, stat, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

async function copyIfNeeded(from, to, label) {
  if (!existsSync(from)) {
    console.warn(`[setup-assets] missing source for ${label}: ${from}`);
    return false;
  }
  await mkdir(path.dirname(to), { recursive: true });
  const [srcStat, dstStat] = await Promise.all([
    stat(from),
    stat(to).catch(() => null),
  ]);
  if (dstStat && dstStat.size === srcStat.size) return true;
  await copyFile(from, to);
  console.log(`[setup-assets] ${label} → ${path.relative(root, to)}`);
  return true;
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  const pdfWorker = path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
  const copied = await copyIfNeeded(pdfWorker, path.join(publicDir, "pdf.worker.min.mjs"), "pdf.js worker");

  // Record the resolved versions so the UI can display (and the CDN fallback can match).
  const versions = {};
  for (const pkg of ["pdfjs-dist", "tesseract.js", "next", "react"]) {
    try {
      const json = JSON.parse(await readFile(path.join(root, "node_modules", pkg, "package.json"), "utf8"));
      versions[pkg] = json.version;
    } catch {
      // ignore
    }
  }
  await writeFile(
    path.join(publicDir, "runtime-versions.json"),
    `${JSON.stringify(versions, null, 2)}\n`,
    "utf8",
  );
  if (!copied) {
    console.warn("[setup-assets] pdf.js worker not copied — the app will fall back to the CDN build.");
  }
}

main().catch((error) => {
  console.error("[setup-assets] failed:", error);
  process.exitCode = 0; // never break installs
});
