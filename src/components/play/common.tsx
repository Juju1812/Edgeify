"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/client/session";
import { Card, Spinner } from "@/components/ui";

/** Redirect signed-out visitors to /login?next=<this page>. Returns the session. */
export function useRequireSignIn() {
  const session = useSession();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!session.loading && !session.me) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [session.loading, session.me, router, path]);
  return session;
}

export function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink-3">
      <Spinner className="h-7 w-7" />
      {label && <p className="text-[15px]">{label}</p>}
    </div>
  );
}

export function ErrorCard({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <p className="text-[20px] font-semibold tracking-tight text-ink">{title}</p>
      {body && <p className="mt-2 text-[15px] text-ink-3">{body}</p>}
      {action && <div className="mt-6 flex justify-center gap-3">{action}</div>}
    </Card>
  );
}

/** Code input limited to the room-code alphabet. */
export function cleanCode(v: string) {
  return v.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
