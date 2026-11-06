"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { MeProfile } from "@/lib/shared/types";
import { api } from "./api";

export type Badges = { unread: number; requests: number };

type SessionValue = {
  me: MeProfile | null;
  loading: boolean;
  badges: Badges;
  /** Bumps when the face thumbnail changes, to bust image caches. */
  faceVersion: number;
  setMe: (me: MeProfile | null, faceChanged?: boolean) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMeState] = useState<MeProfile | null>(null);
  const [badges, setBadges] = useState<Badges>({ unread: 0, requests: 0 });
  const [loading, setLoading] = useState(true);
  const [faceVersion, setFaceVersion] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ me: MeProfile | null; badges?: Badges }>("/api/me");
      setMeState(r.me);
      setBadges(r.badges ?? { unread: 0, requests: 0 });
    } catch {
      /* offline — keep what we have */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Presence heartbeat + keeps ELO/score/badges fresh.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const setMe = useCallback((next: MeProfile | null, faceChanged?: boolean) => {
    setMeState(next);
    if (faceChanged) setFaceVersion(Date.now());
  }, []);

  const signOut = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setMeState(null);
    setBadges({ unread: 0, requests: 0 });
  }, []);

  return (
    <Ctx.Provider value={{ me, loading, badges, faceVersion, setMe, refresh, signOut }}>{children}</Ctx.Provider>
  );
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
