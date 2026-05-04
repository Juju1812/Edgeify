/**
 * Local DM threads with friends. Messages live in localStorage and are
 * device-scoped — there's no server delivery yet (would need a real
 * websocket / KV pub-sub layer). Useful for note-keeping and as the
 * scaffolding for a future real-time DM system.
 */

const KEY = "edgify:dms:v1";

export type DmMessage = {
  id: string;
  from: "me" | string; // "me" or the friend's username for incoming (future)
  text: string;
  ts: number;
};

type Threads = Record<string, DmMessage[]>;

function load(): Threads {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return typeof p === "object" && p ? p : {};
  } catch {
    return {};
  }
}

function save(t: Threads) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    /* */
  }
}

export function getThread(friend: string): DmMessage[] {
  return load()[friend.toUpperCase()] || [];
}

export function appendDm(friend: string, msg: Omit<DmMessage, "id" | "ts">) {
  const all = load();
  const key = friend.toUpperCase();
  const list = all[key] || [];
  list.push({
    ...msg,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now()
  });
  // Cap thread length to 200 messages.
  all[key] = list.slice(-200);
  save(all);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("edgify:dm-update", { detail: { friend: key } })
    );
  }
}

export function clearThread(friend: string) {
  const all = load();
  delete all[friend.toUpperCase()];
  save(all);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("edgify:dm-update"));
  }
}
