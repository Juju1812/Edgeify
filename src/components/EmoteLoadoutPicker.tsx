"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/lib/toast-context";
import {
  loadLoadouts,
  findLoadout,
  type Loadout
} from "@/lib/emote-loadouts";
import { FREE_LOADOUTS, isPro } from "@/lib/pro";

/**
 * Quick loadout swapper. Visible in /settings; lets the user choose
 * which 6-emoji set is their active reaction palette in matches.
 */
export function EmoteLoadoutPicker() {
  const { user, update } = useUser();
  const { toast } = useToast();
  const [loadouts] = useState<Loadout[]>(loadLoadouts());
  const active = matchActive(user.customEmojis, loadouts);
  const pro = isPro(user);

  function activate(id: string) {
    const isFree = (FREE_LOADOUTS as readonly string[]).includes(id);
    if (!isFree && !pro) {
      toast("Pro loadout — upgrade to unlock.", { kind: "warn" });
      return;
    }
    const lo = findLoadout(id);
    if (!lo) return;
    update({ customEmojis: lo.emojis });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-white/55">
        Pre-built emote loadouts for different match vibes. Active set
        becomes your reaction palette in live matches.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {loadouts.map((l) => {
          const isActive = active === l.id;
          const isFree = (FREE_LOADOUTS as readonly string[]).includes(l.id);
          const locked = !isFree && !pro;
          return (
            <button
              key={l.id}
              onClick={() => activate(l.id)}
              className={
                "rounded-xl border p-3 text-left transition " +
                (locked
                  ? "border-white/[0.04] bg-white/[0.01] opacity-60"
                  : isActive
                    ? "border-edge-cyan/60 bg-edge-cyan/[0.06]"
                    : "border-white/[0.06] bg-white/[0.015] hover:border-white/20")
              }
            >
              <div className="flex items-center justify-between">
                <p
                  className={
                    "text-[11px] font-semibold uppercase tracking-[0.22em] " +
                    (isActive ? "text-edge-cyan" : "text-white/85")
                  }
                >
                  {l.name}
                </p>
                {isActive && (
                  <span className="text-[9px] uppercase tracking-[0.32em] text-edge-cyan">
                    ACTIVE
                  </span>
                )}
                {locked && (
                  <span className="rounded-full bg-edge-coral/25 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.22em] text-edge-coral">
                    PRO
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {l.emojis.map((e, i) => (
                  <span
                    key={i}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/30 text-base"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
      {!pro && (
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/30">
          <Link href="/pricing" className="text-edge-coral hover:underline">
            Unlock all loadouts
          </Link>{" "}
          with Edgify Pro
        </p>
      )}
    </div>
  );
}

function matchActive(emojis: string[], loadouts: Loadout[]): string | null {
  const sig = (a: string[]) => a.join("|");
  const target = sig(emojis);
  return loadouts.find((l) => sig(l.emojis) === target)?.id || null;
}
