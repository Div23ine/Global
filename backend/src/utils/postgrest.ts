/**
 * PostgREST filter helpers.
 *
 * .or() consumes a comma-separated filter grammar. User-supplied search terms
 * must be stripped of the characters that carry grammar meaning (commas,
 * parentheses, backslashes) and of LIKE wildcards before being interpolated
 * into an .or() expression; otherwise a term like "a,b" silently widens the
 * OR block or breaks the filter with a 400. Row scoping stays ANDed outside
 * the OR block, so this is robustness hardening, not an authorization
 * control.
 */
export function ilikeOr(columns: readonly string[], rawTerm: string, maxLength = 60): string {
  const term = rawTerm
    .slice(0, maxLength)
    .replace(/[,()\\*%]/g, ' ')
    .trim();
  if (!term) return '';
  return columns.map((column) => `${column}.ilike.%${term}%`).join(',');
}
