import { NextResponse } from "next/server";
import { LOCAL_ADMIN_TOKEN_COOKIE } from "../_lib/localAdminAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookieOptions(request) {
  const url = new URL(request.url);

  return {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";

  if (!accessToken) {
    return NextResponse.json({ status: "error", message: "Missing access token." }, { status: 400 });
  }

  const response = NextResponse.json({ status: "ok" });
  response.cookies.set(LOCAL_ADMIN_TOKEN_COOKIE, accessToken, cookieOptions(request));
  return response;
}

export async function DELETE(request) {
  const response = NextResponse.json({ status: "ok" });
  response.cookies.set(LOCAL_ADMIN_TOKEN_COOKIE, "", {
    ...cookieOptions(request),
    maxAge: 0,
  });
  return response;
}
