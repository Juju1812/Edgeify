"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { MeProfile } from "@/lib/shared/types";
import { Button, Card, Input, Notice } from "@/components/ui";
import { Logo } from "@/components/nav";
import { RecoveryCodeCard } from "@/components/recovery-code";

export default function ForgotPage() {
  const router = useRouter();
  const { setMe } = useSession();
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ me: MeProfile; code: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ me: MeProfile; recoveryCode: string }>("/api/auth/recover", {
        body: { username, code, password }
      });
      setDone({ me: r.me, code: r.recoveryCode });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach Edgify. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page flex min-h-[calc(100vh-64px)] items-start justify-center md:items-center">
      <Card className="w-full max-w-[420px] p-7 sm:p-9">
        {done ? (
          <>
            <Notice tone="good">Password changed — you&apos;re signed in. Your old recovery code no longer works.</Notice>
            <div className="mt-6">
              <RecoveryCodeCard
                code={done.code}
                username={done.me.username}
                onContinue={() => {
                  setMe(done.me, true);
                  router.replace("/");
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="mb-7 flex flex-col items-center text-center">
              <Logo size={44} />
              <h1 className="display mt-5 text-[28px]">Reset your password</h1>
              <p className="mt-1.5 text-[15px] text-ink-3">Use the recovery code you saved when you signed up.</p>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-3">
              <Input
                aria-label="Username"
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                maxLength={16}
                required
              />
              <Input
                aria-label="Recovery code"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="Recovery code (XXXX-XXXX-XXXX-XXXX)"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono tracking-wider"
                required
              />
              <Input
                aria-label="New password"
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
              {error && <Notice tone="error">{error}</Notice>}
              <Button type="submit" size="lg" className="mt-2 w-full" loading={busy}>
                Reset password
              </Button>
            </form>
            <p className="mt-6 text-center text-[14px] text-ink-3">
              No recovery code? Accounts made before the redesign don&apos;t have one — sign in and create one in{" "}
              <Link href="/settings" className="text-accent-ink hover:underline">
                Profile
              </Link>
              .
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
