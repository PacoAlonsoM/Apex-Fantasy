export function normalizeRaceKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/grand prix/g, "gp")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function insightMatchesRace(insight, race) {
  if (!insight || !race) return false;

  const targetDate = String(insight?.metadata?.target_race_date || "").slice(0, 10);
  if (targetDate && targetDate === String(race.date || "")) {
    return true;
  }

  const insightName = normalizeRaceKey(insight.race_name);
  const raceName = normalizeRaceKey(race.n);

  return !!insightName && !!raceName && insightName === raceName;
}

export function chooseInsightForRace(rows, race) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return null;
  if (!race) return list[0] || null;
  return list.find((row) => insightMatchesRace(row, race)) || null;
}
