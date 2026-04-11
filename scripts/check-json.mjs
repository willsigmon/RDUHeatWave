import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const ignoredDirs = new Set([".git", "node_modules", ".next", ".vercel"]);

async function collectJsonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}

const jsonFiles = await collectJsonFiles(rootDir);
const brokenFiles = [];

for (const filePath of jsonFiles) {
  try {
    JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    brokenFiles.push({
      filePath: path.relative(rootDir, filePath),
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

if (brokenFiles.length > 0) {
  for (const brokenFile of brokenFiles) {
    console.error(`Invalid JSON: ${brokenFile.filePath} -> ${brokenFile.message}`);
  }

  process.exit(1);
}

console.log(`Validated ${jsonFiles.length} JSON file(s).`);
