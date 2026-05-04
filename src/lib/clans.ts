/**
 * Local-first clan system. A clan is a small crew (up to 8 members)
 * with a shared name, tag, and color. The owner creates the clan and
 * generates a join code; other members paste the code to join.
 *
 * Storage is device-local — no server registry. Members carry their
 * clan tag as part of their UserState for display purposes.
 *
 * Future: server-side clan registry, cross-clan leaderboard, shared
 * XP boosts on win.
 */

const KEY = "edgify:clan:v1";

export type Clan = {
  id: string; // 6-char join code
  name: string;
  tag: string; // 2-4 char displayed in brackets
  color: string; // hex
  ownerUsername: string;
  members: string[]; // usernames
  createdAt: number;
};

export function genClanId(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function loadClan(): Clan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Clan;
  } catch {
    return null;
  }
}

export function saveClan(c: Clan | null) {
  if (typeof window === "undefined") return;
  try {
    if (c) window.localStorage.setItem(KEY, JSON.stringify(c));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* */
  }
}

export function createClan(opts: {
  name: string;
  tag: string;
  color: string;
  ownerUsername: string;
}): Clan {
  const clan: Clan = {
    id: genClanId(),
    name: opts.name.slice(0, 24),
    tag: opts.tag.toUpperCase().slice(0, 4),
    color: opts.color,
    ownerUsername: opts.ownerUsername,
    members: [opts.ownerUsername],
    createdAt: Date.now()
  };
  saveClan(clan);
  return clan;
}

export function joinClanByCode(
  code: string,
  username: string,
  options?: { name?: string; tag?: string; color?: string }
): Clan | null {
  // Local-only: we trust the code and reconstruct a clan record.
  // In a future server-backed version, this would hit /api/clans/[id]
  // to fetch the canonical record.
  const cur = loadClan();
  if (cur && cur.id === code.toUpperCase()) {
    if (!cur.members.includes(username)) cur.members.push(username);
    saveClan(cur);
    return cur;
  }
  // Fresh join — caller-provided clan info, since there's no registry.
  if (options?.name && options?.tag) {
    const clan: Clan = {
      id: code.toUpperCase(),
      name: options.name,
      tag: options.tag,
      color: options.color || "#22e9ff",
      ownerUsername: username,
      members: [username],
      createdAt: Date.now()
    };
    saveClan(clan);
    return clan;
  }
  return null;
}

export function leaveClan() {
  saveClan(null);
}
