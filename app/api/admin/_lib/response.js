import { NextResponse } from "next/server";

function basePayload(status, message, extras = {}) {
  return {
    status,
    message,
    runId: extras.runId || null,
    round: extras.round ?? null,
    warnings: Array.isArray(extras.warnings) ? extras.warnings : [],
    counts: extras.counts || {},
    updatedAt: extras.updatedAt || new Date().toISOString(),
    ...extras,
  };
}

export function jsonOk(message, extras = {}, status = 200) {
  return NextResponse.json(basePayload("ok", message, extras), { status });
}

export function jsonPartial(message, extras = {}, status = 207) {
  return NextResponse.json(basePayload("partial", message, extras), { status });
}

export function jsonError(message, status = 500, extras = {}) {
  return NextResponse.json(basePayload("error", message, extras), { status });
}

