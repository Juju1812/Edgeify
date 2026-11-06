import "server-only";
import { redis, K } from "./redis";

export type Dm = { from: string; text: string; at: number };

const KEEP = 300;

export async function sendDm(from: string, to: string, text: string): Promise<Dm> {
  const msg: Dm = { from, text, at: Date.now() };
  const key = K.dm(from, to);
  await redis().rpush(key, JSON.stringify(msg));
  await redis().ltrim(key, -KEEP, -1);
  await Promise.all([
    redis().zadd(K.dmIndex(from), { score: msg.at, member: to.toLowerCase() }),
    redis().zadd(K.dmIndex(to), { score: msg.at, member: from.toLowerCase() }),
    redis().set(K.dmRead(from, to), msg.at)
  ]);
  return msg;
}

export async function readDms(me: string, other: string, after = 0): Promise<Dm[]> {
  const raw = await redis().lrange<Dm | string>(K.dm(me, other), -100, -1);
  const msgs = raw.map((r) => (typeof r === "string" ? (JSON.parse(r) as Dm) : r));
  if (msgs.length) await redis().set(K.dmRead(me, other), msgs[msgs.length - 1].at);
  return after ? msgs.filter((m) => m.at > after) : msgs;
}

export type Conversation = { with: string; lastAt: number; last: Dm | null; unread: boolean };

export async function conversations(me: string): Promise<Conversation[]> {
  const items = (await redis().zrange(K.dmIndex(me), 0, 49, { rev: true, withScores: true })) as (string | number)[];
  const out: Conversation[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const other = String(items[i]);
    const lastAt = Number(items[i + 1]);
    const [lastRaw, readAt] = await Promise.all([
      redis().lindex(K.dm(me, other), -1) as Promise<Dm | string | null>,
      redis().get<number>(K.dmRead(me, other))
    ]);
    const last = lastRaw ? (typeof lastRaw === "string" ? (JSON.parse(lastRaw) as Dm) : lastRaw) : null;
    const display = (await redis().hget<string>(K.user(other), "username")) || other;
    out.push({ with: display, lastAt, last, unread: !!last && last.from.toLowerCase() !== me.toLowerCase() && Number(readAt || 0) < lastAt });
  }
  return out;
}
