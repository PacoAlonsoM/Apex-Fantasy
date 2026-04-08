import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envExamplePath = path.join(repoRoot, ".env.example");
const envLocalPath = path.join(repoRoot, ".env.local");

const REQUIRED_PUBLIC = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const REQUIRED_SERVER = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "RACE_RESULTS_SYNC_SECRET",
];

const OPTIONAL = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "CALENDAR_SYNC_SECRET",
  "NEWS_INGEST_SECRET",
  "LOCAL_ADMIN_STORE_DIR",
];

const LEGACY_PUBLIC = [
  "REACT_APP_PUBLIC_SITE_URL",
  "REACT_APP_SUPABASE_URL",
  "REACT_APP_SUPABASE_KEY",
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        return [key, value];
      })
  );
}

const exampleEnv = parseEnvFile(envExamplePath);
const localEnv = parseEnvFile(envLocalPath);
const mergedEnv = {
  ...localEnv,
  ...process.env,
};

const errors = [];
const warnings = [];

for (const name of [...REQUIRED_PUBLIC, ...REQUIRED_SERVER, ...OPTIONAL]) {
  if (!(name in exampleEnv)) {
    errors.push(`.env.example is missing ${name}.`);
  }
}

for (const name of REQUIRED_PUBLIC) {
  if (!String(mergedEnv[name] || "").trim()) {
    errors.push(`Missing required public env ${name} in .env.local or process env.`);
  }
}

for (const name of REQUIRED_SERVER) {
  if (!String(mergedEnv[name] || "").trim()) {
    errors.push(`Missing required server/admin env ${name} in .env.local or process env.`);
  }
}

const legacyOnly = LEGACY_PUBLIC.filter((name) => String(localEnv[name] || process.env[name] || "").trim());
if (legacyOnly.length) {
  warnings.push(`Legacy REACT_APP_* variables detected: ${legacyOnly.join(", ")}. They are not part of the supported Next.js env contract.`);
}

if (!mergedEnv.NEXT_PUBLIC_SUPABASE_URL && mergedEnv.REACT_APP_SUPABASE_URL) {
  errors.push("Found REACT_APP_SUPABASE_URL without NEXT_PUBLIC_SUPABASE_URL. Use the Next.js public env names.");
}

if (!mergedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY && mergedEnv.REACT_APP_SUPABASE_KEY) {
  errors.push("Found REACT_APP_SUPABASE_KEY without NEXT_PUBLIC_SUPABASE_ANON_KEY. Use the Next.js public env names.");
}

if (!mergedEnv.NEXT_PUBLIC_SITE_URL && mergedEnv.REACT_APP_PUBLIC_SITE_URL) {
  errors.push("Found REACT_APP_PUBLIC_SITE_URL without NEXT_PUBLIC_SITE_URL. Use the Next.js public env names.");
}

if (errors.length) {
  console.error("STINT env check failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  if (warnings.length) {
    console.error("");
    warnings.forEach((warning) => console.error(`warning: ${warning}`));
  }
  process.exit(1);
}

console.log("STINT env check passed.");
console.log(`Required public envs: ${REQUIRED_PUBLIC.join(", ")}`);
console.log(`Required admin envs: ${REQUIRED_SERVER.join(", ")}`);
if (warnings.length) {
  warnings.forEach((warning) => console.log(`warning: ${warning}`));
}
