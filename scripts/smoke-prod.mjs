import assert from "node:assert/strict";

const PROD_BASE_URL = process.env.PROD_BASE_URL || "https://www.stint-web.com";

async function get(path) {
  const response = await fetch(`${PROD_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });

  return response;
}

async function expectHtml(path, label) {
  const response = await get(path);
  const text = await response.text();

  assert.equal(response.ok, true, `${label} should return 200.`);
  assert.match(String(response.headers.get("content-type") || ""), /text\/html/i, `${label} should return HTML.`);
  assert.ok(text.includes("<html"), `${label} should return a real HTML document.`);
  assert.doesNotMatch(
    text,
    /STINT could not start because required public configuration is missing/i,
    `${label} should not render the public config crash page.`
  );

  return text;
}

async function expectJson(path, label) {
  const response = await get(path);
  const text = await response.text();

  assert.equal(response.ok, true, `${label} should return 200.`);
  assert.match(String(response.headers.get("content-type") || ""), /application\/json/i, `${label} should return JSON.`);
  return JSON.parse(text);
}

async function main() {
  await expectHtml("/", "Production home page");
  await expectHtml("/?page=admin", "Production admin shell");

  const readiness = await expectJson("/api/health/readiness", "Readiness endpoint");
  assert.equal(readiness?.ok, true, "Readiness endpoint should report ok.");
  assert.equal(readiness?.env?.public?.contractOk, true, "Production public env contract should be complete.");
  assert.equal(readiness?.supabase?.reachable, true, "Production Supabase read client should be reachable.");

  const weekendState = await expectJson("/api/race-weekend-state", "Race weekend state API");
  assert.ok(
    weekendState && typeof weekendState === "object",
    "Production race weekend state should return a JSON object."
  );

  const insightPayload = await expectJson("/api/insight?season=2026", "Public AI insight payload");
  assert.ok(
    insightPayload && typeof insightPayload === "object",
    "Production AI insight payload should return a JSON object."
  );
  assert.ok(
    Array.isArray(insightPayload?.articles),
    "Production AI insight payload should include article rows."
  );

  console.log("Production smoke passed.");
  console.log(`Base URL: ${PROD_BASE_URL}`);
  console.log(`Readiness commit: ${readiness?.app?.commitShort || "unknown"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
