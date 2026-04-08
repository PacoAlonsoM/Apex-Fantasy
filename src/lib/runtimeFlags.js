export const IS_SNAPSHOT =
  typeof navigator !== "undefined" && /ReactSnap/i.test(navigator.userAgent || "");
