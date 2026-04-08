import "server-only";

import path from "node:path";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { normalizeDraftRecord } from "./results";
import { getSupabaseAdmin, getSupabaseReadClient, isServiceRoleConfigured } from "./supabaseAdmin";

const LEGACY_STORE_DIR = process.env.LOCAL_ADMIN_STORE_DIR || path.join(process.cwd(), ".stint-local");
const LEGACY_STORE_FILE = path.join(LEGACY_STORE_DIR, "admin-control-center.json");
const ADMIN_STATE_MIGRATION_HINT = "Apply supabase/migrations/20260404_admin_control_center.sql to the linked Supabase project before using live admin state.";

function createDefaultStore() {
  return {
    version: 2,
    updatedAt: null,
    resultsDrafts: {},
    scheduleSessions: {},
    roundControls: {},
    operationRuns: [],
  };
}

function normalizeStore(payload) {
  const next = payload && typeof payload === "object" ? payload : {};
  return {
    ...createDefaultStore(),
    ...next,
    resultsDrafts: next.resultsDrafts && typeof next.resultsDrafts === "object" ? next.resultsDrafts : {},
    scheduleSessions: next.scheduleSessions && typeof next.scheduleSessions === "object" ? next.scheduleSessions : {},
    roundControls: next.roundControls && typeof next.roundControls === "object" ? next.roundControls : {},
    operationRuns: Array.isArray(next.operationRuns) ? next.operationRuns : [],
  };
}

function coerceObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function coerceArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeDate(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? value : null;
}

function maxIso(left, right) {
  if (!left) return right || null;
  if (!right) return left || null;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function stableJson(value) {
  return JSON.stringify(value || null);
}

function normalizeAdminStateError(error) {
  const message = String(error?.message || "").trim();

  if (/relation .* does not exist/i.test(message) || /Could not find the table/i.test(message)) {
    return new Error(`Admin control center tables are missing in Supabase. ${ADMIN_STATE_MIGRATION_HINT}`);
  }

  return error instanceof Error ? error : new Error("Admin control center state is unavailable.");
}

function getAdminStateReadClient() {
  return isServiceRoleConfigured() ? getSupabaseAdmin() : getSupabaseReadClient();
}

export function roundStoreKey(season, round) {
  return `${Number(season) || 0}:${Number(round) || 0}`;
}

async function readLegacyStoreSnapshot() {
  try {
    const raw = await readFile(LEGACY_STORE_FILE, "utf8");
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    console.warn("Legacy local admin store read fallback", error);
    return null;
  }
}

function hydrateDraftRow(row) {
  const sourcePayload = coerceObject(row?.source_payload);
  return normalizeDraftRecord({
    id: row?.id || null,
    season: Number(row?.season || 2026) || 2026,
    round: Number(row?.race_round || 0) || 0,
    status: row?.draft_status || "draft",
    payload: coerceObject(row?.payload),
    source: sourcePayload.source || sourcePayload || null,
    importedAt: sourcePayload.imported_at || sourcePayload.importedAt || null,
    publishedAt: safeDate(row?.published_at),
    updatedAt: safeDate(row?.updated_at) || safeDate(row?.created_at),
    publishedSnapshot: sourcePayload.published_snapshot || sourcePayload.publishedSnapshot || null,
    integritySummary: coerceObject(row?.integrity_summary),
  });
}

function serializeDraftEntry(key, draft) {
  const normalized = normalizeDraftRecord(draft);
  const [seasonFromKey, roundFromKey] = String(key).split(":").map(Number);
  const publishedSnapshot = normalized.publishedSnapshot && typeof normalized.publishedSnapshot === "object"
    ? normalized.publishedSnapshot
    : null;

  return {
    season: Number(normalized.season || seasonFromKey || 2026) || 2026,
    race_round: Number(normalized.round || normalized?.payload?.race_round || roundFromKey || 0) || 0,
    draft_status: normalized.status || "draft",
    payload: normalized.payload || {},
    source_payload: {
      source: normalized.source || null,
      imported_at: normalized.importedAt || null,
      published_snapshot: publishedSnapshot,
    },
    integrity_summary: normalized.integritySummary || normalized?.payload?.integrity || {},
    published_at: normalized.publishedAt || publishedSnapshot?.publishedAt || null,
    published_by: publishedSnapshot?.publishedBy || null,
    updated_at: normalized.updatedAt || new Date().toISOString(),
  };
}

function hydrateControlRow(row) {
  return {
    id: row?.id || null,
    season: Number(row?.season || 2026) || 2026,
    round: Number(row?.race_round || 0) || 0,
    event_status_override: row?.event_status_override || null,
    race_lock_override_at: safeDate(row?.race_lock_override_at),
    sprint_lock_override_at: safeDate(row?.sprint_lock_override_at),
    admin_note: row?.admin_note || null,
    updatedAt: safeDate(row?.updated_at) || safeDate(row?.created_at),
  };
}

function serializeControlEntry(key, control) {
  const [seasonFromKey, roundFromKey] = String(key).split(":").map(Number);
  return {
    season: Number(control?.season || seasonFromKey || 2026) || 2026,
    race_round: Number(control?.round || roundFromKey || 0) || 0,
    event_status_override: control?.event_status_override || null,
    race_lock_override_at: control?.race_lock_override_at || null,
    sprint_lock_override_at: control?.sprint_lock_override_at || null,
    admin_note: control?.admin_note || null,
    updated_at: control?.updatedAt || new Date().toISOString(),
  };
}

function hydrateSessionRow(row) {
  return {
    id: row?.id || null,
    season: Number(row?.season || 2026) || 2026,
    round: Number(row?.race_round || 0) || 0,
    session_type: row?.session_type || null,
    session_name: row?.session_name || null,
    scheduled_start: safeDate(row?.scheduled_start),
    scheduled_end: safeDate(row?.scheduled_end),
    actual_start: safeDate(row?.actual_start),
    actual_end: safeDate(row?.actual_end),
    status: row?.status || "scheduled",
    session_key: row?.session_key ?? null,
    meeting_key: row?.meeting_key ?? null,
    source: row?.source || "openf1",
    source_payload: coerceObject(row?.source_payload),
    last_synced_at: safeDate(row?.last_synced_at),
    updatedAt: safeDate(row?.updated_at) || safeDate(row?.created_at),
  };
}

function serializeSessionEntries(key, rows = []) {
  const [seasonFromKey, roundFromKey] = String(key).split(":").map(Number);

  return coerceArray(rows).map((row) => ({
    season: Number(row?.season || seasonFromKey || 2026) || 2026,
    race_round: Number(row?.round || roundFromKey || 0) || 0,
    session_type: row?.session_type || row?.sessionType || null,
    session_name: row?.session_name || row?.sessionName || null,
    scheduled_start: row?.scheduled_start || row?.date_start || null,
    scheduled_end: row?.scheduled_end || row?.date_end || null,
    actual_start: row?.actual_start || null,
    actual_end: row?.actual_end || null,
    status: row?.status || "scheduled",
    session_key: row?.session_key ?? null,
    meeting_key: row?.meeting_key ?? null,
    source: row?.source || "openf1",
    source_payload: row?.source_payload || row?.sourcePayload || {},
    last_synced_at: row?.last_synced_at || row?.lastSyncedAt || new Date().toISOString(),
    updated_at: row?.updatedAt || new Date().toISOString(),
  })).filter((row) => row.session_type);
}

function hydrateOperationRunRow(row) {
  return {
    id: row?.id || null,
    type: row?.operation_type || "",
    season: Number(row?.season || 2026) || 2026,
    round: row?.race_round ?? null,
    status: row?.status || "ok",
    message: row?.message || "",
    warnings: coerceArray(row?.warnings),
    counts: coerceObject(row?.counts),
    details: coerceObject(row?.details),
    updatedAt: safeDate(row?.created_at),
  };
}

function serializeOperationRun(run) {
  return {
    id: run?.id || randomUUID(),
    operation_type: run?.type || "",
    season: Number(run?.season || 2026) || 2026,
    race_round: run?.round ?? null,
    status: run?.status || "ok",
    message: run?.message || "",
    warnings: coerceArray(run?.warnings),
    counts: coerceObject(run?.counts),
    details: coerceObject(run?.details),
    created_at: run?.updatedAt || new Date().toISOString(),
  };
}

function buildStoreFromRemoteRows({ draftRows = [], sessionRows = [], controlRows = [], runRows = [] }) {
  const store = createDefaultStore();

  draftRows.forEach((row) => {
    const entry = hydrateDraftRow(row);
    store.resultsDrafts[roundStoreKey(entry.season, entry.round)] = entry;
    store.updatedAt = maxIso(store.updatedAt, entry.updatedAt);
  });

  const sessionsByKey = new Map();
  sessionRows.forEach((row) => {
    const entry = hydrateSessionRow(row);
    const key = roundStoreKey(entry.season, entry.round);
    const current = sessionsByKey.get(key) || [];
    current.push(entry);
    sessionsByKey.set(key, current);
    store.updatedAt = maxIso(store.updatedAt, entry.updatedAt || entry.last_synced_at);
  });
  for (const [key, rows] of sessionsByKey.entries()) {
    store.scheduleSessions[key] = rows;
  }

  controlRows.forEach((row) => {
    const entry = hydrateControlRow(row);
    store.roundControls[roundStoreKey(entry.season, entry.round)] = entry;
    store.updatedAt = maxIso(store.updatedAt, entry.updatedAt);
  });

  store.operationRuns = runRows.map((row) => {
    const entry = hydrateOperationRunRow(row);
    store.updatedAt = maxIso(store.updatedAt, entry.updatedAt);
    return entry;
  });

  return normalizeStore(store);
}

function isStoreEmpty(store) {
  return (
    Object.keys(store.resultsDrafts || {}).length === 0
    && Object.keys(store.scheduleSessions || {}).length === 0
    && Object.keys(store.roundControls || {}).length === 0
    && (store.operationRuns || []).length === 0
  );
}

async function loadRemoteRows(client) {
  const [draftResponse, sessionResponse, controlResponse, runResponse] = await Promise.all([
    client.from("race_result_drafts").select("*").order("updated_at", { ascending: false }),
    client.from("race_schedule_sessions").select("*").order("race_round", { ascending: true }).order("scheduled_start", { ascending: true }),
    client.from("race_round_controls").select("*").order("updated_at", { ascending: false }),
    client.from("admin_operation_runs").select("*").order("created_at", { ascending: false }).limit(160),
  ]);

  const errors = [
    draftResponse.error,
    sessionResponse.error,
    controlResponse.error,
    runResponse.error,
  ].filter(Boolean);

  if (errors.length) {
    throw normalizeAdminStateError(errors[0]);
  }

  return {
    draftRows: draftResponse.data || [],
    sessionRows: sessionResponse.data || [],
    controlRows: controlResponse.data || [],
    runRows: runResponse.data || [],
  };
}

async function replaceScheduleRows(client, key, rows) {
  const [season, round] = String(key).split(":").map(Number);

  const { error: deleteError } = await client
    .from("race_schedule_sessions")
    .delete()
    .eq("season", season)
    .eq("race_round", round);

  if (deleteError) throw normalizeAdminStateError(deleteError);

  if (!rows.length) return;

  const { error: insertError } = await client
    .from("race_schedule_sessions")
    .insert(rows);

  if (insertError) throw normalizeAdminStateError(insertError);
}

async function persistStoreChanges(currentStore, nextStore, client = null) {
  const supabase = client || getSupabaseAdmin();

  const draftKeys = new Set([
    ...Object.keys(currentStore.resultsDrafts || {}),
    ...Object.keys(nextStore.resultsDrafts || {}),
  ]);
  for (const key of draftKeys) {
    const currentValue = currentStore.resultsDrafts?.[key] || null;
    const nextValue = nextStore.resultsDrafts?.[key] || null;
    if (stableJson(currentValue) === stableJson(nextValue)) continue;

    const [season, round] = String(key).split(":").map(Number);
    if (!nextValue) {
      const { error } = await supabase
        .from("race_result_drafts")
        .delete()
        .eq("season", season)
        .eq("race_round", round);
      if (error) throw normalizeAdminStateError(error);
      continue;
    }

    const { error } = await supabase
      .from("race_result_drafts")
      .upsert(serializeDraftEntry(key, nextValue), { onConflict: "season,race_round" });
    if (error) throw normalizeAdminStateError(error);
  }

  const controlKeys = new Set([
    ...Object.keys(currentStore.roundControls || {}),
    ...Object.keys(nextStore.roundControls || {}),
  ]);
  for (const key of controlKeys) {
    const currentValue = currentStore.roundControls?.[key] || null;
    const nextValue = nextStore.roundControls?.[key] || null;
    if (stableJson(currentValue) === stableJson(nextValue)) continue;

    const [season, round] = String(key).split(":").map(Number);
    if (!nextValue) {
      const { error } = await supabase
        .from("race_round_controls")
        .delete()
        .eq("season", season)
        .eq("race_round", round);
      if (error) throw normalizeAdminStateError(error);
      continue;
    }

    const { error } = await supabase
      .from("race_round_controls")
      .upsert(serializeControlEntry(key, nextValue), { onConflict: "season,race_round" });
    if (error) throw normalizeAdminStateError(error);
  }

  const sessionKeys = new Set([
    ...Object.keys(currentStore.scheduleSessions || {}),
    ...Object.keys(nextStore.scheduleSessions || {}),
  ]);
  for (const key of sessionKeys) {
    const currentValue = currentStore.scheduleSessions?.[key] || [];
    const nextValue = nextStore.scheduleSessions?.[key] || [];
    if (stableJson(currentValue) === stableJson(nextValue)) continue;
    await replaceScheduleRows(supabase, key, serializeSessionEntries(key, nextValue));
  }

  const currentRuns = new Map((currentStore.operationRuns || []).map((run) => [run.id, run]));
  const nextRuns = (nextStore.operationRuns || []).map((run) => serializeOperationRun(run));
  const runsToUpsert = nextRuns.filter((run) => stableJson(currentRuns.get(run.id)) !== stableJson({
    id: run.id,
    type: run.operation_type,
    season: run.season,
    round: run.race_round,
    status: run.status,
    message: run.message,
    warnings: run.warnings,
    counts: run.counts,
    details: run.details,
    updatedAt: run.created_at,
  }));

  if (runsToUpsert.length) {
    const { error } = await supabase
      .from("admin_operation_runs")
      .upsert(runsToUpsert, { onConflict: "id" });
    if (error) throw normalizeAdminStateError(error);
  }
}

async function importLegacyStoreIfNeeded() {
  if (!isServiceRoleConfigured()) return false;

  const legacyStore = await readLegacyStoreSnapshot();
  if (!legacyStore || isStoreEmpty(legacyStore)) return false;

  const admin = getSupabaseAdmin();
  const existing = buildStoreFromRemoteRows(await loadRemoteRows(admin));
  if (!isStoreEmpty(existing)) return false;

  await persistStoreChanges(createDefaultStore(), legacyStore, admin);
  return true;
}

export async function readLocalAdminStore() {
  try {
    const client = getAdminStateReadClient();
    let remote = await loadRemoteRows(client);
    let store = buildStoreFromRemoteRows(remote);

    if (isStoreEmpty(store)) {
      const imported = await importLegacyStoreIfNeeded();
      if (imported) {
        remote = await loadRemoteRows(getAdminStateReadClient());
        store = buildStoreFromRemoteRows(remote);
      }
    }

    return store;
  } catch (error) {
    throw normalizeAdminStateError(error);
  }
}

export async function writeLocalAdminStore(nextStore) {
  const normalized = normalizeStore({
    ...nextStore,
    updatedAt: new Date().toISOString(),
  });
  await persistStoreChanges(createDefaultStore(), normalized);
  return normalized;
}

export async function updateLocalAdminStore(mutator) {
  const current = await readLocalAdminStore();
  const draft = normalizeStore(structuredClone(current));
  const maybeNext = await mutator(draft);
  const normalized = normalizeStore(maybeNext || draft);
  await persistStoreChanges(current, normalized);
  return normalized;
}

export function buildOperationRun(type, extras = {}) {
  return {
    id: extras.id || randomUUID(),
    type,
    season: Number(extras.season || 2026),
    round: extras.round ?? null,
    status: extras.status || "ok",
    message: extras.message || "",
    warnings: Array.isArray(extras.warnings) ? extras.warnings : [],
    counts: extras.counts || {},
    details: extras.details || {},
    updatedAt: extras.updatedAt || new Date().toISOString(),
  };
}

export function appendOperationRun(store, run) {
  const runs = Array.isArray(store.operationRuns) ? store.operationRuns : [];
  store.operationRuns = [run, ...runs].slice(0, 160);
  return store;
}

export function getLatestOperationRun(store, type, round = null) {
  const runs = Array.isArray(store?.operationRuns) ? store.operationRuns : [];
  return runs.find((run) => run.type === type && (round === null || Number(run.round || 0) === Number(round || 0))) || null;
}
