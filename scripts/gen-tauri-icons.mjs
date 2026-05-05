/**
 * Generates all required Tauri icon formats from public/icons/icon.svg.
 * Run once before your first `npm run tauri:build`:
 *
 *   npm run tauri:icons
 *
 * Requires @tauri-apps/cli to be installed (added as a devDependency).
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const svgPath = resolve(root, "public/icons/icon.svg");

if (!existsSync(svgPath)) {
  console.error(`SVG not found at ${svgPath}`);
  process.exit(1);
}

console.log("Generating Tauri icons from", svgPath);
execSync(`npx @tauri-apps/cli icon "${svgPath}"`, {
  cwd: root,
  stdio: "inherit",
});
console.log("Icons written to src-tauri/icons/");
