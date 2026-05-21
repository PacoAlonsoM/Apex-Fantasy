#!/usr/bin/env node
// One-shot WC reset used at launch time. Mirrors POST /api/admin/wc/reset
// but uses the service-role key directly so it can run before the admin UI
// session exists. Idempotent.
//
//   node ./scripts/wc-launch-reset.mjs
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from
// .env.local automatically).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(repoRoot, ".env.local"));
loadEnvFile(path.join(repoRoot, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const SENTINEL = "00000000-0000-0000-0000-000000000000";

async function wipe(table) {
  const { error, count } = await supabase.from(table).delete({ count: "exact" }).neq("id", SENTINEL);
  if (error) {
    if (/relation .* does not exist|schema cache/i.test(error.message || "")) {
      console.log(`  ${table}: skipped (table missing)`);
      return 0;
    }
    throw error;
  }
  console.log(`  ${table}: deleted ${count || 0} row(s)`);
  return count || 0;
}

async function resetMatches() {
  const { error, count } = await supabase
    .from("wc_matches")
    .update({
      home_score: null,
      away_score: null,
      winner_team_code: null,
      status: "scheduled",
      source_note: "WC seed",
      updated_at: new Date().toISOString(),
    }, { count: "exact" })
    .neq("id", SENTINEL);
  if (error) throw error;
  console.log(`  wc_matches: reset ${count || 0} match(es) to scheduled`);
  return count || 0;
}

const tables = [
  "wc_survivor_picks",
  "wc_match_predictions",
  "wc_bracket_predictions",
  "wc_league_members",
  "wc_leagues",
  "wc_score_runs",
];

console.log("Wiping WC user data...");
const counts = {};
for (const table of tables) {
  counts[table] = await wipe(table);
}
counts.wc_matches_reset = await resetMatches();

await supabase.from("wc_score_runs").insert({
  operation_type: "launch-reset",
  status: "ok",
  message: "WC platform reset to launch-ready zero state (via script).",
  counts,
});

console.log("\nDone. Summary:");
console.log(counts);
