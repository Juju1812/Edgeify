"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "./session";

/** Redirect signed-out visitors to /login, returning here afterwards. */
export function useRequireAuth() {
  const session = useSession();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!session.loading && !session.me) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [session.loading, session.me, path, router]);
  return session;
}
