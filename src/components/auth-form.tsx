"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { MeProfile } from "@/lib/shared/types";
import { Button, Card, Input, Notice } from "./ui";
import { Logo } from "./nav";
import { RecoveryCodeCard } from "./recovery-code";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { me, setMe } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<{ code: string; me: MeProfile } | null>(null);
  // Where to go once signed in. New accounts head to their first scan.
  const [dest, setDest] = useState(next);

  useEffect(() => {
    if (me && !recovery) router.replace(dest);
  }, [me, dest, router, recovery]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ me: MeProfile; recoveryCode?: string }>(`/api/auth/${mode}`, {
        body: mode === "signup" ? { username, password, isOver18: adult } : { username, password }
      });
      if (r.recoveryCode) {
        // Show the code before letting them in; session is already active.
        setDest(next === "/" ? "/scan" : next);
        setRecovery({ code: r.recoveryCode, me: r.me });
        return;
      }
      setMe(r.me, true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach Edgify. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  const signup = mode === "signup";

  if (recovery) {
    return (
      <main className="page flex min-h-[calc(100vh-64px)] items-start justify-center md:items-center">
        <Card className="w-full max-w-[420px] p-7 sm:p-9">
          <RecoveryCodeCard
            code={recovery.code}
            username={recovery.me.username}
            continueLabel="Get my score"
            onContinue={() => {
              setMe(recovery.me, true);
              setRecovery(null); // the effect above navigates to `dest`
            }}
          />
        </Card>
      </main>
    );
  }

  return (
    <main className="page flex min-h-[calc(100vh-64px)] items-start justify-center md:items-center">
      <Card className="w-full max-w-[420px] p-7 sm:p-9">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="display mt-5 text-[28px]">{signup ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1.5 text-[15px] text-ink-3">
            {signup ? "Get your score in under a minute." : "Sign in to keep climbing."}
          </p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="sr-only" htmlFor="username">Username</label>
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
            maxLength={16}
            required
          />
          <label className="sr-only" htmlFor="password">Password</label>
          <Input
            id="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          {signup && (
            <label className="mt-1 flex cursor-pointer items-start gap-3 rounded-2xl bg-fill px-4 py-3 text-[14px] text-ink-2">
              <input
                type="checkbox"
                checked={adult}
                onChange={(e) => setAdult(e.target.checked)}
                className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#0071e3]"
              />
              <span>
                I&apos;m 18 or older, and I understand my score is an AI&apos;s opinion for entertainment — not a fact about me.
              </span>
            </label>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" size="lg" className="mt-2 w-full" loading={busy} disabled={signup && !adult}>
            {signup ? "Create account" : "Sign in"}
          </Button>
          {!signup && (
            <Link href="/forgot" className="mt-1 self-center text-[14px] text-accent-ink hover:underline">
              Forgot password?
            </Link>
          )}
        </form>
        <p className="mt-6 text-center text-[14px] text-ink-3">
          {signup ? "Already have an account? " : "New to Edgify? "}
          <Link
            href={`${signup ? "/login" : "/signup"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-medium text-accent-ink hover:underline"
          >
            {signup ? "Sign in" : "Create one"}
          </Link>
        </p>
      </Card>
    </main>
  );
}

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}
