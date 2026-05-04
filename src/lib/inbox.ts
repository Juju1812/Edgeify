/**
 * Local in-app notifications inbox. Backed by localStorage so guests
 * and signed-in users alike accumulate match summaries, level-ups,
 * achievement unlocks, friend events, etc.
 *
 * Server push isn't wired yet (would need VAPID + service worker);
 * for now the inbox is populated by the user-context's existing
 * lifecycle hooks (level-up detector, achievement detector, match
 * finalize). Future: also pull from /api/inbox when server-side
 * notifications arrive.
 */

const KEY = "edgify:inbox:v1";
const MAX = 100;

export type InboxKind =
  | "match"
  | "levelup"
  | "achievement"
  | "friend"
  | "system";

export type InboxItem = {
  id: string;
  kind: InboxKind;
  title: string;
  body?: string;
  emoji?: string;
  href?: string;
  createdAt: number;
  read: boolean;
};

export function loadInbox(): InboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InboxItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveInbox(items: InboxItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* */
  }
}

export function pushInbox(item: Omit<InboxItem, "id" | "createdAt" | "read">) {
  const items = loadInbox();
  const fresh: InboxItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    read: false
  };
  saveInbox([fresh, ...items]);
  // Notify any open tab/listener so badges update without a reload.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("edgify:inbox-update"));
  }
}

export function unreadCount(): number {
  return loadInbox().filter((i) => !i.read).length;
}

export function markAllRead() {
  const items = loadInbox().map((i) => ({ ...i, read: true }));
  saveInbox(items);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("edgify:inbox-update"));
  }
}

export function clearInbox() {
  saveInbox([]);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("edgify:inbox-update"));
  }
}
