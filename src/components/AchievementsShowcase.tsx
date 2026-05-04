"use client";

import { useUser } from "@/lib/user-context";
import { ACHIEVEMENTS } from "@/lib/achievements";

/**
 * Profile-page widget that surfaces up to 3 pinned achievements as a
 * trophy showcase. Click an unlocked one to pin/unpin (max 3). Locked
 * achievements aren't pinnable.
 */
export function AchievementsShowcase() {
  const { user, update } = useUser();
  const unlocked = ACHIEVEMENTS.filter((a) => a.check(user));
  const pinnedIds = user.pinnedAchievementIds || [];
  const pinned = pinnedIds
    .map((id) => unlocked.find((a) => a.id === id))
    .filter((a): a is (typeof ACHIEVEMENTS)[number] => Boolean(a));

  function togglePin(id: string) {
    update((prev) => {
      const cur = prev.pinnedAchievementIds || [];
      if (cur.includes(id)) {
        return { pinnedAchievementIds: cur.filter((x) => x !== id) };
      }
      // Cap at 3 — drop oldest.
      const next = [...cur, id].slice(-3);
      return { pinnedAchievementIds: next };
    });
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-center justify-between">
        <p className="label-xs">Showcase ({pinned.length}/3)</p>
        <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">
          Tap to pin / unpin
        </p>
      </div>
      {/* Pinned row */}
      {pinned.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {pinned.map((a) => (
            <button
              key={a.id}
              onClick={() => togglePin(a.id)}
              className="rounded-xl border border-edge-cyan/40 bg-edge-cyan/[0.06] p-3 text-center transition hover:border-edge-cyan/70"
              title={`Unpin ${a.name}`}
            >
              <div className="text-3xl">{a.emoji}</div>
              <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-edge-cyan">
                {a.name}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-white/10 bg-black/30 px-3 py-4 text-center text-[11px] uppercase tracking-[0.22em] text-white/35">
          Pick up to 3 trophies below
        </p>
      )}
      {/* Unlocked picker */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {unlocked.map((a) => {
          const isPinned = pinnedIds.includes(a.id);
          return (
            <button
              key={a.id}
              onClick={() => togglePin(a.id)}
              className={
                "flex h-9 w-9 items-center justify-center rounded-md border text-base transition " +
                (isPinned
                  ? "border-edge-cyan/60 bg-edge-cyan/[0.06]"
                  : "border-white/10 bg-white/[0.02] hover:border-edge-cyan/40")
              }
              title={`${a.name} — ${isPinned ? "click to unpin" : "click to pin"}`}
            >
              {a.emoji}
            </button>
          );
        })}
        {unlocked.length === 0 && (
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">
            Unlock achievements to fill the showcase.
          </p>
        )}
      </div>
    </div>
  );
}
