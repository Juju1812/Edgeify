import "server-only";
import bcrypt from "bcryptjs";
import { redis, K } from "./redis";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** e.g. "K7QX-M2PA-9RTD-WZ4N" — ~80 bits, easy to write down. */
export function newRecoveryCode() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  const chars = Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
  return chars.match(/.{4}/g)!.join("-");
}

export function normalizeCode(c: string) {
  return c.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Generate, store (hashed) and return a fresh code. Old code stops working. */
export async function rotateRecoveryCode(username: string) {
  const code = newRecoveryCode();
  await redis().hset(K.user(username), { recoveryHash: await bcrypt.hash(normalizeCode(code), 10) });
  return code;
}

export async function checkRecoveryCode(username: string, code: string) {
  const hash = await redis().hget<string>(K.user(username), "recoveryHash");
  if (!hash) return false;
  return bcrypt.compare(normalizeCode(code), hash);
}
