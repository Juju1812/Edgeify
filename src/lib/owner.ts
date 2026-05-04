/**
 * Special-cased owner identity. The owner is the project creator and
 * gets a visible "OWNER" badge throughout the UI.
 *
 * Match is case-insensitive — "Jrubski", "JRUBSKI", "jrubski" all hit.
 */
const OWNER_NAME = "JRUBSKI";

export function isOwnerName(name: string | null | undefined): boolean {
  if (!name) return false;
  return name.trim().toUpperCase() === OWNER_NAME;
}
