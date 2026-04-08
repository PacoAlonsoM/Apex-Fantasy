import "server-only";

import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const STORE_DIR = process.env.LOCAL_ADMIN_STORE_DIR || path.join(process.cwd(), ".stint-local");
const STORE_FILE = path.join(STORE_DIR, "admin-control-center.json");

function createDefaultStore() {
  return {
    version: 1,
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

export function roundStoreKey(season, round) {
  return `${Number(season) || 0}:${Number(round) || 0}`;
}

async function ensureStoreDir() {
  await mkdir(STORE_DIR, { recursive: true });
}

export async function readLocalAdminStore() {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return createDefaultStore();
    }

    console.warn("Local admin store read fallback", error);
    return createDefaultStore();
  }
}

export async function writeLocalAdminStore(nextStore) {
  const normalized = normalizeStore({
    ...nextStore,
    updatedAt: new Date().toISOString(),
  });

  await ensureStoreDir();
  await writeFile(STORE_FILE, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

export async function updateLocalAdminStore(mutator) {
  const current = await readLocalAdminStore();
  const draft = normalizeStore(structuredClone(current));
  const maybeNext = await mutator(draft);
  return await writeLocalAdminStore(maybeNext || draft);
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

