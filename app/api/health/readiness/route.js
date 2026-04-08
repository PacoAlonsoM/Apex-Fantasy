import { NextResponse } from "next/server";
import { collectReadinessSnapshot } from "@/app/api/_lib/readiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const readiness = await collectReadinessSnapshot();

  return NextResponse.json(readiness, {
    status: readiness.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
