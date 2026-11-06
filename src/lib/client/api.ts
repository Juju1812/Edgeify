"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public body: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

/** JSON fetch against our API. Session rides on the httpOnly cookie. */
export async function api<T = Record<string, unknown>>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal; keepalive?: boolean } = {}
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    keepalive: opts.keepalive,
    cache: "no-store",
    credentials: "same-origin"
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new ApiError(
      res.status,
      String(data.error || "error"),
      String(data.message || "Something went wrong. Try again."),
      data
    );
  }
  return data as T;
}

export const faceUrl = (username: string, bust?: number) =>
  `/api/face/${encodeURIComponent(username)}${bust ? `?v=${bust}` : ""}`;
