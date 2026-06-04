import { createWriteStream, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceDir = join(root, "apps", "extension");
const outDir = join(root, "dist");
const zipPath = join(outDir, "link-steward-onenav-extension.zip");

mkdirSync(outDir, { recursive: true });

const zip = spawnSync("zip", ["-r", zipPath, "."], {
  cwd: sourceDir,
  stdio: "inherit"
});

if (zip.status !== 0) {
  const files = collectFiles(sourceDir);
  const output = createWriteStream(join(outDir, "link-steward-onenav-extension-files.txt"));
  for (const file of files) {
    output.write(`${relative(sourceDir, file)}\n`);
  }
  output.end();
  throw new Error("zip command is required to build the extension archive");
}

console.log(`Created ${zipPath}`);

function collectFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? collectFiles(path) : [path];
  });
}
