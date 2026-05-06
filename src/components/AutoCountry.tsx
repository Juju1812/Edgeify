"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/user-context";

const STORAGE_KEY = "edgify:geo:checked:v1";

/**
 * Mounts once at the root layout. If the user hasn't picked a country
 * yet AND we haven't already attempted detection in this browser, hit
 * /api/geo and auto-fill `countryCode`. Never overrides an explicit
 * choice. Silently no-ops on local dev (no Vercel IP header).
 */
export function AutoCountry() {
  const { user, ready, update } = useUser();

  useEffect(() => {
    if (!ready) return;
    if (user.countryCode) return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* sessionStorage unavailable — proceed once anyway */
    }
    fetch("/api/geo")
      .then((r) => r.json())
      .then((d) => {
        if (d?.country && !user.countryCode) {
          update({ countryCode: String(d.country).toUpperCase().slice(0, 2) });
        }
      })
      .catch(() => {
        /* offline / blocked — fine */
      });
  }, [ready, user.countryCode, update]);

  return null;
}
