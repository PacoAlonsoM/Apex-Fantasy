/**
 * Truncate a string to `max` characters, appending an ellipsis if it was
 * cut. Used for one-line previews of AI insight summaries, news teasers,
 * race notes, etc.
 *
 * @param {string} value — source text
 * @param {number} [max=140] — max length including the ellipsis
 * @returns {string}
 */
export function previewText(value, max = 140) {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

/**
 * Format an ISO date / Date / timestamp into a short "Apr 5, 2:00 PM" stamp
 * using the user's locale. Returns `""` for falsy input.
 */
export function formatStamp(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month:  "short",
    day:    "numeric",
    hour:   "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
