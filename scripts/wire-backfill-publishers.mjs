#!/usr/bin/env node
// One-shot backfill: rewrites existing news_articles ingested via Google News
// so the source becomes the real publisher (Sky Sports, AutoRacing1.com,
// WGNO, …) and the trailing " - Publisher" suffix is stripped from the title.
//
// Idempotent — rows where source no longer matches "Google News*" are skipped.
//
//   node ./scripts/wire-backfill-publishers.mjs
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

function extractPublisher(title) {
  const raw = String(title || "").trim();
  if (!raw) return null;
  const match = raw.match(/^(.+?)\s+[–-]\s+([^–-]{2,60})$/);
  if (!match) return null;
  const stripped = match[1].trim();
  const publisher = match[2].trim();
  if (publisher.length < 2 || /^\d+$/.test(publisher)) return null;
  if (!stripped) return null;
  return { title: stripped, publisher };
}

const PAGE_SIZE = 500;

async function fetchPage(offset) {
  const { data, error } = await supabase
    .from("news_articles")
    .select("id,title,source,metadata,source_priority")
    .ilike("source", "Google News%")
    .order("id")
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return data || [];
}

async function run() {
  let offset = 0;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for (;;) {
    const rows = await fetchPage(offset);
    if (!rows.length) break;
    scanned += rows.length;

    for (const row of rows) {
      const parsed = extractPublisher(row.title);
      if (!parsed) {
        skipped += 1;
        continue;
      }
      const metadata = { ...(row.metadata || {}) };
      if (!metadata.ingested_from) metadata.ingested_from = row.source;
      const nextPriority = Math.max(Number(row.source_priority || 0), 3);
      const { error } = await supabase
        .from("news_articles")
        .update({
          title: parsed.title,
          source: parsed.publisher,
          source_priority: nextPriority,
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) {
        console.error(`  id=${row.id}: ${error.message}`);
        continue;
      }
      updated += 1;
    }

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }

  console.log(`scanned ${scanned} GN row(s); updated ${updated}; skipped ${skipped} (title had no \" - Publisher\" suffix).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
