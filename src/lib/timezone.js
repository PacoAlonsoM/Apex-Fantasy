export function getViewerTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export function getViewerTimeZoneLabel(timeZone = getViewerTimeZone()) {
  if (!timeZone) return "Local";

  return String(timeZone)
    .split("/")
    .map((part) => part.split("_").join(" "))
    .join(" / ");
}
