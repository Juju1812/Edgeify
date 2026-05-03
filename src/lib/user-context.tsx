"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { DEFAULT_USER, getStatus, type UserState, type UserStatus } from "./types";
import {
  applyInactivityDecay,
  checkSeasonRollover,
  levelFromXp,
  POWERUP_META,
  rewardAtLevel,
  tickDailyStreak
} from "./season";
import { useToast } from "./toast-context";
import { ACHIEVEMENTS } from "./achievements";
import { setSoundVolume } from "./audio";

const STORAGE_KEY = "edgify:user:v1";
const TOKEN_KEY = "edgify:auth:token:v1";

type AuthError = { error: string; message?: string };

type UserContextValue = {
  user: UserState;
  status: UserStatus;
  ready: boolean;
  /** True when this device has a verified server session. */
  authedRemote: boolean;
  /** Local-only fast sign-in (legacy, no password). Kept for compatibility. */
  signIn: (username: string, isOver18: boolean) => void;
  /** Server-backed sign-up: creates an account and seeds local state. */
  signUp: (username: string, password: string, isOver18: boolean) => Promise<AuthError | null>;
  /** Server-backed sign-in: verifies password and pulls saved profile. */
  signInRemote: (username: string, password: string) => Promise<AuthError | null>;
  signOut: () => Promise<void>;
  update: (patch: Partial<UserState> | ((prev: UserState) => Partial<UserState>)) => void;
  deleteAccount: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

function loadFromStorage(): UserState {
  if (typeof window === "undefined") return DEFAULT_USER;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USER;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_USER, ...parsed };
  } catch {
    return DEFAULT_USER;
  }
}

function saveToStorage(u: UserState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

function loadToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(t: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (t) window.localStorage.setItem(TOKEN_KEY, t);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* */
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserState>(DEFAULT_USER);
  const [ready, setReady] = useState(false);
  const [authedRemote, setAuthedRemote] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const lastSyncedRef = useRef<string>("");
  const syncTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const lastLevelRef = useRef(0);
  const lastAchievementsRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  // Load from local storage on mount, then check for an existing session.
  useEffect(() => {
    const local = loadFromStorage();
    // Apply on-load timers: daily streak tick, inactivity decay, season
    // rollover. These are all idempotent.
    setUser((u) => {
      const merged = { ...local, ...u };
      const withRollover = { ...merged, ...checkSeasonRollover(merged) };
      const withStreak = { ...withRollover, ...tickDailyStreak(withRollover) };
      const withDecay = { ...withStreak, ...applyInactivityDecay(withStreak) };
      return withDecay;
    });

    const token = loadToken();
    tokenRef.current = token;

    (async () => {
      if (token) {
        try {
          const res = await fetch("/api/auth/me", {
            method: "POST",
            headers: { authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.profile) {
              const merged = { ...DEFAULT_USER, ...data.profile };
              const withRollover = { ...merged, ...checkSeasonRollover(merged) };
              const withStreak = { ...withRollover, ...tickDailyStreak(withRollover) };
              const withDecay = { ...withStreak, ...applyInactivityDecay(withStreak) };
              setUser(withDecay);
              saveToStorage(withDecay);
            }
            setAuthedRemote(true);
          } else {
            // Stale/invalid token — clear it.
            saveToken(null);
            tokenRef.current = null;
          }
        } catch {
          /* offline — keep using local cache */
        }
      }
      setReady(true);
    })();
  }, []);

  // Persist to local storage on every change.
  useEffect(() => {
    if (ready) saveToStorage(user);
  }, [user, ready]);

  // Keep audio module in sync with the user's volume preference.
  useEffect(() => {
    if (typeof user.soundVolume === "number") setSoundVolume(user.soundVolume);
  }, [user.soundVolume]);

  // Detect level-ups + new achievements and surface as toasts.
  useEffect(() => {
    if (!ready || !user.username) return;
    const lvl = levelFromXp(user.seasonXp);
    if (lastLevelRef.current === 0) {
      lastLevelRef.current = lvl;
      // Initial achievements snapshot — don't toast existing ones on first load
      for (const a of ACHIEVEMENTS) {
        if (a.check(user)) lastAchievementsRef.current.add(a.id);
      }
      return;
    }
    if (lvl > lastLevelRef.current) {
      const reward = rewardAtLevel(lvl);
      let extra = "";
      if (reward?.kind === "edgeBoost") extra = " · ⚡ Edge Boost";
      else if (reward?.kind === "powerUp")
        extra = ` · ${POWERUP_META[reward.powerUp].emoji} ${POWERUP_META[reward.powerUp].name}`;
      else if (reward?.kind === "title") extra = ` · "${reward.title}"`;
      else if (reward?.kind === "frame") extra = ` · ${reward.frame} frame`;
      toast(`Level ${lvl}!${extra}`, { kind: "success", emoji: "✨", ttl: 5000 });
      lastLevelRef.current = lvl;
    }
    for (const a of ACHIEVEMENTS) {
      if (a.check(user) && !lastAchievementsRef.current.has(a.id)) {
        lastAchievementsRef.current.add(a.id);
        toast(`${a.name} unlocked`, { kind: "success", emoji: a.emoji, ttl: 5000 });
      }
    }
  }, [user, ready, toast]);

  // While authed, ping the server every 30s so /api/stats can count us
  // as online. Stop pinging on logout / unmount.
  useEffect(() => {
    if (!authedRemote || !tokenRef.current) return;
    const ping = () => {
      const t = tokenRef.current;
      if (!t) return;
      fetch("/api/heartbeat", {
        method: "POST",
        headers: { authorization: `Bearer ${t}` }
      }).catch(() => {});
    };
    ping();
    heartbeatTimerRef.current = window.setInterval(ping, 30_000);
    return () => {
      if (heartbeatTimerRef.current)
        window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    };
  }, [authedRemote]);

  // Debounced server sync when authed.
  useEffect(() => {
    if (!ready || !authedRemote || !tokenRef.current) return;
    const serialized = JSON.stringify(user);
    if (serialized === lastSyncedRef.current) return;

    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(async () => {
      const token = tokenRef.current;
      if (!token) return;
      try {
        const res = await fetch("/api/profile/sync", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`
          },
          body: serialized
        });
        if (res.ok) {
          lastSyncedRef.current = serialized;
        } else if (res.status === 401) {
          // Session expired → drop remote auth, keep local data.
          saveToken(null);
          tokenRef.current = null;
          setAuthedRemote(false);
        }
      } catch {
        /* network blip — try again next change */
      }
    }, 1500);
  }, [user, ready, authedRemote]);

  const update = useCallback<UserContextValue["update"]>((patch) => {
    setUser((prev) => {
      const delta = typeof patch === "function" ? patch(prev) : patch;
      return { ...prev, ...delta };
    });
  }, []);

  // Local-only sign-in (no password). Used by older flows; server sync is off.
  const signIn = useCallback((username: string, isOver18: boolean) => {
    setUser((prev) => ({
      ...prev,
      username: username.trim().toUpperCase().slice(0, 16),
      authedAt: Date.now(),
      isOver18,
      consentedAt: Date.now()
    }));
  }, []);

  const signUp = useCallback(
    async (username: string, password: string, isOver18: boolean) => {
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username, password, isOver18 })
        });
        const data = await res.json();
        if (!res.ok) {
          return data as AuthError;
        }
        const token = data.token as string;
        saveToken(token);
        tokenRef.current = token;
        setAuthedRemote(true);
        // Fresh account → keep current local state but stamp identity fields.
        setUser((prev) => ({
          ...prev,
          username: data.username,
          authedAt: Date.now(),
          isOver18: true,
          consentedAt: Date.now()
        }));
        return null;
      } catch {
        return { error: "network", message: "Couldn't reach the server. Try again." };
      }
    },
    []
  );

  const signInRemote = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        return data as AuthError;
      }
      const token = data.token as string;
      saveToken(token);
      tokenRef.current = token;
      setAuthedRemote(true);
      // Hydrate from server profile if there is one.
      if (data.profile) {
        const merged = { ...DEFAULT_USER, ...data.profile };
        setUser(merged);
      } else {
        setUser((prev) => ({
          ...prev,
          username: data.username,
          authedAt: Date.now()
        }));
      }
      return null;
    } catch {
      return { error: "network", message: "Couldn't reach the server. Try again." };
    }
  }, []);

  const signOut = useCallback(async () => {
    const token = tokenRef.current;
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` }
        });
      } catch {
        /* ignore */
      }
    }
    saveToken(null);
    tokenRef.current = null;
    setAuthedRemote(false);
    setUser((prev) => ({ ...prev, username: null, authedAt: null }));
  }, []);

  const deleteAccount = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
    }
    tokenRef.current = null;
    setAuthedRemote(false);
    setUser(DEFAULT_USER);
  }, []);

  const value = useMemo<UserContextValue>(
    () => ({
      user,
      status: getStatus(user),
      ready,
      authedRemote,
      signIn,
      signUp,
      signInRemote,
      signOut,
      update,
      deleteAccount
    }),
    [user, ready, authedRemote, signIn, signUp, signInRemote, signOut, update, deleteAccount]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside <UserProvider>");
  return ctx;
}
