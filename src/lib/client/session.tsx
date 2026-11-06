"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { MeProfile } from "@/lib/shared/types";
import { api } from "./api";

type SessionValue = {
  me: MeProfile | null;
  loading: boolean;
  /** Bumps when the face thumbnail changes, to bust image caches. */
  faceVersion: number;
  setMe: (me: MeProfile | null, faceChanged?: boolean) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMeState] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [faceVersion, setFaceVersion] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ me: MeProfile | null }>("/api/me");
      setMeState(r.me);
    } catch {
      /* offline — keep what we have */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Presence heartbeat + keeps ELO/score fresh across tabs.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 45_000);
    return () => clearInterval(t);
  }, [refresh]);

  const setMe = useCallback((next: MeProfile | null, faceChanged?: boolean) => {
    setMeState(next);
    if (faceChanged) setFaceVersion(Date.now());
  }, []);

  const signOut = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setMeState(null);
  }, []);

  return (
    <Ctx.Provider value={{ me, loading, faceVersion, setMe, refresh, signOut }}>{children}</Ctx.Provider>
  );
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
