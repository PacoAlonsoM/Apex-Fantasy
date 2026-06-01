#!/usr/bin/env node
// Verifies the Pro Community League row exists in `leagues`. Seeds one if
// missing. Idempotent — running twice is a no-op the second time.
//
// The auto-enrollment in src/lib/subscription.js silently no-ops if this row
// doesn't exist, so every Pro upgrade up to now would have failed to add the
// user to the flagship board. This script closes that gap.
//
//   node ./scripts/check-pro-community-league.mjs
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (loaded from
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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function run() {
  const { data: existing, error: readErr } = await supabase
    .from("leagues")
    .select("id, name, code, type, is_active, created_at")
    .eq("type", "pro_community")
    .maybeSingle();

  if (readErr) throw readErr;

  if (existing) {
    console.log(`Pro Community League already exists: id=${existing.id} code=${existing.code} active=${existing.is_active}`);
    if (!existing.is_active) {
      const { error: actErr } = await supabase.from("leagues").update({ is_active: true }).eq("id", existing.id);
      if (actErr) throw actErr;
      console.log("  re-activated.");
    }
    return;
  }

  const code = "PRO" + Math.random().toString(36).slice(2, 5).toUpperCase();
  const { data: created, error: insertErr } = await supabase
    .from("leagues")
    .insert({
      name:       "Stint Pro Community",
      code,
      type:       "pro_community",
      is_public:  true,
      is_active:  true,
      game_mode:  "standard",
      visibility: "public",
      season:     new Date().getFullYear(),
      settings:   {},
    })
    .select("id, name, code")
    .single();

  if (insertErr) throw insertErr;

  console.log(`Seeded Pro Community League: id=${created.id} code=${created.code}`);

  // Back-fill: enroll any existing Pro users who missed the auto-enroll
  const { data: proUsers, error: proErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("subscription_status", "pro");
  if (proErr) throw proErr;

  if (!proUsers?.length) {
    console.log("  No existing Pro users to back-fill.");
    return;
  }

  const memberships = proUsers.map((u) => ({
    league_id: created.id,
    user_id:   u.id,
    role:      "member",
    status:    "active",
  }));

  const { error: memberErr } = await supabase
    .from("league_members")
    .upsert(memberships, { onConflict: "league_id,user_id", ignoreDuplicates: true });
  if (memberErr) throw memberErr;

  console.log(`  Back-filled ${memberships.length} existing Pro member(s).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
