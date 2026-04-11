import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const ignoredDirs = new Set([".git", "node_modules", ".next", ".vercel"]);
const allowedExtensions = new Set([".js", ".mjs", ".cjs"]);

async function collectJavaScriptFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectJavaScriptFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

const jsFiles = await collectJavaScriptFiles(rootDir);

if (jsFiles.length === 0) {
  console.log("No JavaScript files found.");
  process.exit(0);
}

let failed = false;

for (const filePath of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || `Syntax check failed: ${path.relative(rootDir, filePath)}\n`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Syntax-checked ${jsFiles.length} JavaScript file(s).`);
