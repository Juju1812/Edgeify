"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { DEFAULT_USER, getStatus, type UserState, type UserStatus } from "./types";

const STORAGE_KEY = "edgeify:user:v1";

type UserContextValue = {
  user: UserState;
  status: UserStatus;
  ready: boolean;
  signIn: (username: string, isOver18: boolean) => void;
  signOut: () => void;
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

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserState>(DEFAULT_USER);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(loadFromStorage());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveToStorage(user);
  }, [user, ready]);

  const update = useCallback<UserContextValue["update"]>((patch) => {
    setUser((prev) => {
      const delta = typeof patch === "function" ? patch(prev) : patch;
      return { ...prev, ...delta };
    });
  }, []);

  const signIn = useCallback((username: string, isOver18: boolean) => {
    setUser((prev) => ({
      ...prev,
      username: username.trim().toUpperCase().slice(0, 16),
      authedAt: Date.now(),
      isOver18,
      consentedAt: Date.now()
    }));
  }, []);

  const signOut = useCallback(() => {
    setUser((prev) => ({ ...prev, username: null, authedAt: null }));
  }, []);

  const deleteAccount = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setUser(DEFAULT_USER);
  }, []);

  const value = useMemo<UserContextValue>(
    () => ({
      user,
      status: getStatus(user),
      ready,
      signIn,
      signOut,
      update,
      deleteAccount
    }),
    [user, ready, signIn, signOut, update, deleteAccount]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside <UserProvider>");
  return ctx;
}
