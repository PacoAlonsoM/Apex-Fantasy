import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalDir = path.resolve(process.env.STINT_CANONICAL_DIR || path.join(os.homedir(), "Code", "apex-fantasy"));

const errors = [];
const warnings = [];

function walk(dir, visitor) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, visitor);
      continue;
    }

    visitor(fullPath);
  }
}

function git(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function rel(filePath) {
  return path.relative(repoRoot, filePath) || ".";
}

try {
  const realRepoRoot = fs.realpathSync(repoRoot);
  const realCanonicalDir = fs.realpathSync(canonicalDir);

  if (realRepoRoot !== realCanonicalDir) {
    errors.push(`This repo must run from the canonical workspace: ${realCanonicalDir}`);
  }
} catch (error) {
  errors.push(`Could not resolve the canonical workspace: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  git(["rev-parse", "--verify", "HEAD"]);
} catch {
  errors.push("Git HEAD is not valid. Re-clone the canonical repo instead of repairing broken refs locally.");
}

try {
  const branch = git(["symbolic-ref", "--short", "HEAD"]);
  if (!branch) {
    errors.push("Git is not on a normal branch.");
  }
} catch {
  errors.push("Git is not attached to a valid local branch.");
}

let trackedFiles = [];
try {
  trackedFiles = git(["ls-files"]).split("\n").filter(Boolean);
} catch (error) {
  errors.push(`Could not inspect tracked files: ${error instanceof Error ? error.message : String(error)}`);
}

const forbiddenTracked = trackedFiles.filter((file) => (
  file === ".env.local"
  || file === ".env"
  || file === ".stint-local"
  || file.startsWith(".stint-local/")
  || file === ".vercel"
  || file.startsWith(".vercel/")
));

if (forbiddenTracked.length) {
  errors.push(`Tracked local-only files are not allowed: ${forbiddenTracked.join(", ")}`);
}

walk(repoRoot, (fullPath) => {
  const base = path.basename(fullPath);
  if (/ 2\.(js|jsx|ts|tsx)$/.test(base)) {
    errors.push(`Accidental backup file found: ${rel(fullPath)}`);
  }
});

const desktopWorkspace = path.join(os.homedir(), "Desktop", "apex-fantasy");
if (fs.existsSync(desktopWorkspace) && path.resolve(desktopWorkspace) !== path.resolve(repoRoot)) {
  warnings.push(`Desktop copy still exists at ${desktopWorkspace}. Keep it as backup only and do not run dev or publish flows from there.`);
}

if (errors.length) {
  console.error("STINT repo check failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  if (warnings.length) {
    console.error("");
    warnings.forEach((warning) => console.error(`warning: ${warning}`));
  }
  process.exit(1);
}

console.log("STINT repo check passed.");
console.log(`Canonical workspace: ${repoRoot}`);
if (warnings.length) {
  warnings.forEach((warning) => console.log(`warning: ${warning}`));
}
