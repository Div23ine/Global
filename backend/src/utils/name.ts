/**
 * Display-name assembly for profile patches.
 *
 * Promise: `full_name` is always recomputed from the STORED name parts plus
 * the patched parts, so a partial patch can never erase the unpatched half
 * (audit F-7: `firstName`-only patch rebuilt `full_name` from the request's
 * missing `lastName`, and `lastName`-only patches left `full_name` stale).
 */

export interface NameParts {
  first_name: string | null;
  last_name: string | null;
}

export interface NamePatch {
  firstName?: string;
  lastName?: string;
}

/** Join the stored and patched parts the same way every caller must. */
export function computeFullName(current: NameParts | null, patch: NamePatch): string {
  const first = patch.firstName ?? current?.first_name ?? '';
  const last = patch.lastName ?? current?.last_name ?? '';
  return [first, last]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim())
    .join(' ');
}
