import "server-only";

import { CONSTRUCTORS, DRV } from "@/src/constants/teams";
import { getDnfDrivers, serializeDnfDrivers } from "@/src/lib/resultHelpers";

export const MANUAL_RESULT_KEYS = [
  "pole",
  "dotd",
  "best_constructor",
  "sp_pole",
  "sp_winner",
  "sp_p2",
  "sp_p3",
];

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function titleCase(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

const DRIVER_ALIASES = {
  "alex albon": "Alexander Albon",
};

const CONSTRUCTOR_ALIASES = {
  "red bull": "Red Bull Racing",
  "red bull racing": "Red Bull Racing",
  rb: "Racing Bulls",
  "haas f1 team": "Haas",
};

const DRIVER_NAME_MAP = new Map();
DRV.forEach((driver) => {
  const canonical = driver.n;
  [
    canonical,
    driver.s,
    String(driver.nb),
  ].filter(Boolean).forEach((alias) => {
    DRIVER_NAME_MAP.set(normalizeKey(alias), canonical);
  });
});
Object.entries(DRIVER_ALIASES).forEach(([alias, canonical]) => {
  DRIVER_NAME_MAP.set(normalizeKey(alias), canonical);
});

const CONSTRUCTOR_NAME_MAP = new Map();
CONSTRUCTORS.forEach((constructor) => {
  CONSTRUCTOR_NAME_MAP.set(normalizeKey(constructor), constructor);
});
Object.entries(CONSTRUCTOR_ALIASES).forEach(([alias, canonical]) => {
  CONSTRUCTOR_NAME_MAP.set(normalizeKey(alias), canonical);
});

export function normalizeDriverName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return DRIVER_NAME_MAP.get(normalizeKey(trimmed)) || titleCase(trimmed);
}

export function normalizeConstructorName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return CONSTRUCTOR_NAME_MAP.get(normalizeKey(trimmed)) || titleCase(trimmed);
}

function uniqueNormalizedList(values = [], normalizer = (value) => value) {
  const seen = new Set();
  const normalized = [];

  values.forEach((value) => {
    const next = normalizer(value);
    const key = normalizeKey(next);
    if (!next || !key || seen.has(key)) return;
    seen.add(key);
    normalized.push(next);
  });

  return normalized;
}

function normalizeRawResults(rows = []) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      ...row,
      driver: normalizeDriverName(row?.driver),
    }))
    .filter((row) => row.driver);
}

export function normalizeResultsPayload(payload = {}) {
  const dnfList = uniqueNormalizedList(getDnfDrivers(payload), normalizeDriverName);

  return {
    ...payload,
    race_round: Number(payload?.race_round || 0) || null,
    pole: normalizeDriverName(payload?.pole),
    winner: normalizeDriverName(payload?.winner),
    p2: normalizeDriverName(payload?.p2),
    p3: normalizeDriverName(payload?.p3),
    dnf: serializeDnfDrivers(dnfList),
    dnf_list: dnfList,
    fastest_lap: normalizeDriverName(payload?.fastest_lap),
    dotd: normalizeDriverName(payload?.dotd),
    best_constructor: normalizeConstructorName(payload?.best_constructor || payload?.ctor),
    safety_car: !!payload?.safety_car,
    red_flag: !!payload?.red_flag,
    sp_pole: normalizeDriverName(payload?.sp_pole),
    sp_winner: normalizeDriverName(payload?.sp_winner),
    sp_p2: normalizeDriverName(payload?.sp_p2),
    sp_p3: normalizeDriverName(payload?.sp_p3),
    raw_results: normalizeRawResults(payload?.raw_results || []),
    integrity: payload?.integrity || null,
  };
}

export function normalizeDraftRecord(draft = {}) {
  return {
    ...draft,
    season: Number(draft?.season || 2026) || 2026,
    round: Number(draft?.round || draft?.payload?.race_round || 0) || 0,
    payload: normalizeResultsPayload(draft?.payload || {}),
    publishedSnapshot: draft?.publishedSnapshot
      ? {
          ...draft.publishedSnapshot,
          officialRow: normalizeResultsPayload(draft.publishedSnapshot.officialRow || {}),
        }
      : null,
  };
}

export function normalizeOfficialResultsRow(row = null) {
  if (!row) return null;

  return {
    ...row,
    ...normalizeResultsPayload(row),
  };
}

export function buildDraftPayload({ season = 2026, round, imported = {}, manual = {}, previousDraft = null }) {
  const draft = normalizeResultsPayload(previousDraft?.payload || {});
  const normalizedImported = normalizeResultsPayload(imported || {});
  const normalizedManual = normalizeResultsPayload(manual || {});
  const dnfList = normalizedManual.dnf_list?.length
    ? normalizedManual.dnf_list
    : normalizedImported.dnf_list?.length
      ? normalizedImported.dnf_list
      : draft.dnf_list || [];

  return {
    season,
    round,
    payload: normalizeResultsPayload({
      race_round: Number(round),
      pole: normalizedManual.pole || draft.pole || "",
      winner: normalizedImported.winner || draft.winner || "",
      p2: normalizedImported.p2 || draft.p2 || "",
      p3: normalizedImported.p3 || draft.p3 || "",
      dnf_list: dnfList,
      fastest_lap: normalizedImported.fastest_lap || draft.fastest_lap || "",
      dotd: normalizedManual.dotd || draft.dotd || "",
      best_constructor: normalizedManual.best_constructor || draft.best_constructor || "",
      safety_car: typeof imported?.safety_car === "boolean" ? imported.safety_car : !!draft.safety_car,
      red_flag: typeof imported?.red_flag === "boolean" ? imported.red_flag : !!draft.red_flag,
      sp_pole: normalizedManual.sp_pole || draft.sp_pole || "",
      sp_winner: normalizedManual.sp_winner || draft.sp_winner || "",
      sp_p2: normalizedManual.sp_p2 || draft.sp_p2 || "",
      sp_p3: normalizedManual.sp_p3 || draft.sp_p3 || "",
      raw_results: normalizedImported.raw_results?.length ? normalizedImported.raw_results : draft.raw_results || [],
      integrity: normalizedImported.integrity || draft.integrity || null,
    }),
  };
}

export function validateDraftForPublish(draft) {
  const payload = normalizeResultsPayload(draft?.payload || {});
  const missing = [];

  if (!payload.winner) missing.push("winner");
  if (!payload.p2) missing.push("p2");
  if (!payload.p3) missing.push("p3");
  if (!payload.fastest_lap) missing.push("fastest_lap");
  if (!payload.pole) missing.push("pole");
  if (!payload.dotd) missing.push("dotd");
  if (!payload.best_constructor) missing.push("best_constructor");

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function buildRaceResultsRowFromDraft(draft) {
  const payload = normalizeResultsPayload(draft?.payload || {});
  return {
    race_round: Number(draft?.round || payload.race_round || 0),
    pole: payload.pole || null,
    winner: payload.winner || null,
    p2: payload.p2 || null,
    p3: payload.p3 || null,
    dnf: serializeDnfDrivers(payload.dnf_list),
    fastest_lap: payload.fastest_lap || null,
    dotd: payload.dotd || null,
    best_constructor: payload.best_constructor || null,
    safety_car: !!payload.safety_car,
    red_flag: !!payload.red_flag,
    sp_pole: payload.sp_pole || null,
    sp_winner: payload.sp_winner || null,
    sp_p2: payload.sp_p2 || null,
    sp_p3: payload.sp_p3 || null,
    results_entered: true,
    locked_at: new Date().toISOString(),
  };
}

export function deriveManualFieldsUsed(payload) {
  return MANUAL_RESULT_KEYS.filter((key) => Boolean(payload?.[key]));
}
