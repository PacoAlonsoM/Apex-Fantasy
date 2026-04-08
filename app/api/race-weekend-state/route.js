import { NextResponse } from "next/server";

import { readLocalAdminStore } from "../admin/_lib/localAdminStore";
import { getRoundControls, getRoundSessions } from "../admin/_lib/dashboardData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const season = Number(url.searchParams.get("season") || 2026) || 2026;
  const round = Number(url.searchParams.get("round") || 0) || null;
  const store = await readLocalAdminStore();

  if (round) {
    return NextResponse.json({
      season,
      round,
      controls: getRoundControls(store, season, round),
      sessions: getRoundSessions(store, season, round),
      updatedAt: store.updatedAt || null,
    });
  }

  const controlsByRound = {};
  const sessionsByRound = {};
  for (const key of Object.keys(store.roundControls || {})) {
    const [itemSeason, itemRound] = key.split(":").map(Number);
    if (itemSeason !== season) continue;
    controlsByRound[itemRound] = store.roundControls[key];
  }

  for (const key of Object.keys(store.scheduleSessions || {})) {
    const [itemSeason, itemRound] = key.split(":").map(Number);
    if (itemSeason !== season) continue;
    sessionsByRound[itemRound] = store.scheduleSessions[key];
  }

  return NextResponse.json({
    season,
    controlsByRound,
    sessionsByRound,
    updatedAt: store.updatedAt || null,
  });
}
