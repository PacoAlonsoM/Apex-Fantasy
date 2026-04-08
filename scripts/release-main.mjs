import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const waitMs = Number(process.env.STINT_PROD_SMOKE_WAIT_MS || 15000);
const maxProdAttempts = Number(process.env.STINT_PROD_SMOKE_ATTEMPTS || 8);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function git(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch !== "main") {
  console.error(`Release flow only supports main. Current branch: ${branch}`);
  process.exit(1);
}

const status = git(["status", "--porcelain"]);
if (status) {
  console.error("Release flow requires a clean working tree. Commit or stash changes first.");
  process.exit(1);
}

run("npm", ["run", "check:repo"]);
run("npm", ["run", "check:env"]);
run("npm", ["run", "build"]);
run("npm", ["run", "smoke:local-admin"]);
run("git", ["push", "origin", "main"]);

let prodPassed = false;

for (let attempt = 1; attempt <= maxProdAttempts; attempt += 1) {
  const result = spawnSync("npm", ["run", "smoke:prod"], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.status === 0) {
    prodPassed = true;
    break;
  }

  if (attempt < maxProdAttempts) {
    console.log(`Production smoke attempt ${attempt} failed. Waiting ${waitMs}ms before retrying...`);
    sleep(waitMs);
  }
}

if (!prodPassed) {
  console.error("Production smoke never passed after push. Check Vercel and production readiness before releasing again.");
  process.exit(1);
}

console.log("Release flow passed: local gates, push to main, and production smoke.");
