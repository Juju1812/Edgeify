/**
 * Emote loadouts — multiple saved sets of 6 reaction emojis. Lets the
 * user keep different vibes (tryhard, friendly, hostile, classic) and
 * swap mid-match. Stored device-locally; the active loadout's emojis
 * become user.customEmojis.
 */

const KEY = "edgify:emote-loadouts:v1";

export type Loadout = {
  id: string;
  name: string;
  emojis: string[]; // length 6
};

const DEFAULT_LOADOUTS: Loadout[] = [
  {
    id: "classic",
    name: "Classic",
    emojis: ["🔥", "💀", "👑", "😂", "🗿", "🤡"]
  },
  {
    id: "friendly",
    name: "Friendly",
    emojis: ["👋", "🙌", "💪", "✨", "🤝", "🎉"]
  },
  {
    id: "tryhard",
    name: "Tryhard",
    emojis: ["⚔️", "🎯", "📈", "🏆", "💯", "👁️"]
  },
  {
    id: "hostile",
    name: "Hostile",
    emojis: ["💀", "🤡", "🪦", "🚮", "👎", "🥀"]
  }
];

export function loadLoadouts(): Loadout[] {
  if (typeof window === "undefined") return DEFAULT_LOADOUTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LOADOUTS;
    const parsed = JSON.parse(raw) as Loadout[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LOADOUTS;
    return parsed;
  } catch {
    return DEFAULT_LOADOUTS;
  }
}

export function saveLoadouts(list: Loadout[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* */
  }
}

export function findLoadout(id: string): Loadout | null {
  return loadLoadouts().find((l) => l.id === id) || null;
}
