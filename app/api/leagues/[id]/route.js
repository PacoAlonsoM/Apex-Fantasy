import "server-only";

import { NextResponse } from "next/server";
import {
  getLeagueAndVerifyComisionado,
  leagueAccessErrorResponse,
  requireLeagueUser,
} from "../_lib/leagueServer";

export async function DELETE(request, { params }) {
  const { id: leagueId } = await params;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  let auth;
  try {
    auth = await requireLeagueUser(request, body);
  } catch (error) {
    return leagueAccessErrorResponse(error);
  }

  const { league, error, status } = await getLeagueAndVerifyComisionado(auth.supabase, leagueId, auth.user.id);
  if (error) return NextResponse.json({ error }, { status });

  if (league.type === "pro_community") {
    return NextResponse.json({ error: "The Pro Community League cannot be deleted here." }, { status: 403 });
  }

  const { error: deleteError } = await auth.supabase
    .from("leagues")
    .delete()
    .eq("id", leagueId);

  if (deleteError) {
    console.error("[leagues/delete]", deleteError.message);
    return NextResponse.json({ error: "Failed to delete league" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
