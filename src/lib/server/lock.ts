import "server-only";
import { redis } from "./redis";
import { HttpError } from "./http";
import { randomToken } from "./auth";

/** Run `fn` while holding a short Redis lock on `key`. */
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const lockKey = `${key}:lock`;
  const token = randomToken(8);
  for (let i = 0; i < 40; i++) {
    if (await redis().set(lockKey, token, { nx: true, px: 8000 })) {
      try {
        return await fn();
      } finally {
        if ((await redis().get(lockKey)) === token) await redis().del(lockKey);
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new HttpError(503, "busy", "Busy, try again.");
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function roomCode(len = 6) {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
}

export function isRoomCode(c: unknown): c is string {
  return typeof c === "string" && /^[A-HJ-NP-Z2-9]{6}$/.test(c.toUpperCase());
}
