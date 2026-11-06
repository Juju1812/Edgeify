import "server-only";
import { cookies } from "next/headers";
import { redis, K } from "./redis";
import { HttpError } from "./http";

export const SESSION_COOKIE = "e2_session";
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30;

type Session = { username: string; expiresAt: number };

export function isValidUsername(u: unknown): u is string {
  return typeof u === "string" && /^[A-Za-z0-9_-]{2,16}$/.test(u);
}

export function isValidPassword(p: unknown): p is string {
  return typeof p === "string" && p.length >= 6 && p.length <= 200;
}

export function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Create a session (same storage format as v1) and set the cookie. */
export async function startSession(username: string) {
  const token = randomToken();
  const session: Session = { username, expiresAt: Date.now() + SESSION_TTL_SEC * 1000 };
  await redis().set(K.session(token), JSON.stringify(session), { ex: SESSION_TTL_SEC });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SEC
  });
}

export async function endSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await redis().del(K.session(token));
  cookies().delete(SESSION_COOKIE);
}

/** Username of the signed-in user, or null. */
export async function currentUser(): Promise<string | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const raw = await redis().get<Session | string>(K.session(token));
  if (!raw) return null;
  const s: Session = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!s?.username || s.expiresAt < Date.now()) return null;
  return s.username;
}

export async function requireUser(): Promise<string> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "signed_out", "Sign in to continue.");
  return u;
}
