import { NextResponse } from "next/server";
import { getWcAccessToken, loadWcBootstrap } from "../_lib/wcServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const payload = await loadWcBootstrap(getWcAccessToken(request));
    return NextResponse.json({ status: "ok", ...payload });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Could not load WC data.",
    }, { status: 500 });
  }
}
