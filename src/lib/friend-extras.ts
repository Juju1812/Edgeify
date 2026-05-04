/**
 * Local extras per friend — nicknames + private notes.
 * Device-scoped via localStorage; never sent to the server.
 */

const KEY = "edgify:friend-extras:v1";

type Extras = Record<string, { nick?: string; note?: string }>;

function load(): Extras {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function save(e: Extras) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(e));
  } catch {
    /* */
  }
}

export function getExtras(friend: string) {
  return load()[friend.toUpperCase()] || {};
}

export function setNick(friend: string, nick: string) {
  const e = load();
  const k = friend.toUpperCase();
  e[k] = { ...e[k], nick: nick.slice(0, 24) };
  if (!nick.trim()) delete e[k].nick;
  save(e);
}

export function setNote(friend: string, note: string) {
  const e = load();
  const k = friend.toUpperCase();
  e[k] = { ...e[k], note: note.slice(0, 280) };
  if (!note.trim()) delete e[k].note;
  save(e);
}

export function exportFriendsCSV(friends: string[]): string {
  const e = load();
  const rows = ["username,nickname,note"];
  for (const f of friends) {
    const k = f.toUpperCase();
    const ex = e[k] || {};
    const csvRow = [
      f,
      (ex.nick || "").replace(/"/g, '""'),
      (ex.note || "").replace(/"/g, '""').replace(/\n/g, " ")
    ].map((v) => `"${v}"`).join(",");
    rows.push(csvRow);
  }
  return rows.join("\n");
}
