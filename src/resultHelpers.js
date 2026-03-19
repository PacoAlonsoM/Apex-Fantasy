function normalizeListValue(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  if (typeof value === "string") {
    return [...new Set(
      value
        .split(/\s*\|\s*|\s*,\s*/)
        .map((item) => item.trim())
        .filter(Boolean)
    )];
  }

  if (value) {
    const normalized = String(value).trim();
    return normalized ? [normalized] : [];
  }

  return [];
}

export function getDnfDrivers(results) {
  if (!results) return [];

  const fromList = normalizeListValue(results.dnf_list);
  if (fromList.length) return fromList;

  return normalizeListValue(results.dnf);
}

export function serializeDnfDrivers(value) {
  const drivers = normalizeListValue(value);
  return drivers.length ? drivers.join(" | ") : null;
}

export function formatDnfDrivers(results) {
  const drivers = getDnfDrivers(results);
  return drivers.length ? drivers.join(", ") : null;
}

export function matchesDnfPick(pick, results) {
  if (!pick) return false;
  return getDnfDrivers(results).includes(pick);
}
