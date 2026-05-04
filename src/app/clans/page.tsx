"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/lib/toast-context";
import {
  type Clan,
  createClan,
  joinClanByCode,
  leaveClan,
  loadClan
} from "@/lib/clans";

const COLORS = ["#22e9ff", "#ff5d8f", "#fde047", "#a855f7", "#34d399", "#f97316"];

export default function ClansPage() {
  const { user, status } = useUser();
  const { toast } = useToast();
  const [clan, setClan] = useState<Clan | null>(null);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    setClan(loadClan());
  }, []);

  if (status === "guest") {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 pt-10">
        <p className="text-sm text-white/40">Sign in to manage clans.</p>
      </main>
    );
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user.username) return;
    if (name.trim().length < 2 || tag.trim().length < 2) return;
    const c = createClan({
      name: name.trim(),
      tag: tag.trim(),
      color,
      ownerUsername: user.username
    });
    setClan(c);
    toast(`Clan ${c.name} created`, { kind: "success", emoji: "🛡️" });
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!user.username) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      toast("Codes are 6 characters.", { kind: "warn" });
      return;
    }
    // Local-first: prompt for the clan info if we don't have it.
    const fakeName = window.prompt(
      `Joining ${code}. What's the clan called?`,
      "New Crew"
    );
    if (!fakeName) return;
    const fakeTag = window.prompt(
      `Tag (2-4 chars)?`,
      fakeName.slice(0, 3).toUpperCase()
    );
    if (!fakeTag) return;
    const c = joinClanByCode(code, user.username, {
      name: fakeName,
      tag: fakeTag.toUpperCase().slice(0, 4),
      color: COLORS[0]
    });
    if (c) {
      setClan(c);
      toast(`Joined ${c.name}`, { kind: "success", emoji: "🛡️" });
    }
  }

  function handleLeave() {
    if (!confirm("Leave this clan?")) return;
    leaveClan();
    setClan(null);
    toast("Left clan.", { kind: "info" });
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-cyan">Crews</p>
        <h1 className="heading-display mt-2 text-4xl">
          <span className="brand-edge">Clans</span>
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Form a small crew with friends. Share a tag that shows next to
          your name in matches and on the leaderboard.
        </p>
      </div>

      {clan ? (
        <div className="mt-8">
          <div
            className="glass overflow-hidden rounded-2xl"
            style={{ borderColor: clan.color + "40" }}
          >
            <div
              className="px-6 py-8 text-center"
              style={{
                background: `linear-gradient(135deg, ${clan.color}25, ${clan.color}10)`
              }}
            >
              <p className="label-xs" style={{ color: clan.color }}>
                Your clan
              </p>
              <h2 className="heading-display mt-2 text-3xl">
                <span style={{ color: clan.color }}>[{clan.tag}]</span>{" "}
                {clan.name}
              </h2>
              <p className="mt-2 stat-mono text-[10px] uppercase tracking-[0.32em] text-white/45">
                Code · {clan.id}
              </p>
            </div>
            <div className="border-t border-white/[0.04] p-5">
              <p className="label-xs mb-2">Members ({clan.members.length}/8)</p>
              <div className="flex flex-wrap gap-2">
                {clan.members.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/80"
                  >
                    {m === clan.ownerUsername && <span title="Owner">👑</span>}
                    {m}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(clan.id).then(
                      () => toast("Code copied", { kind: "success" }),
                      () => {}
                    )
                  }
                  className="rounded-md border border-edge-cyan/40 bg-edge-cyan/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan/60"
                >
                  Copy code
                </button>
                <button
                  onClick={handleLeave}
                  className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200 transition hover:border-rose-500/50"
                >
                  Leave clan
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {/* Create */}
          <form
            onSubmit={handleCreate}
            className="glass rounded-2xl p-5"
          >
            <p className="label-xs text-edge-coral">Create a clan</p>
            <h3 className="heading-display mt-2 text-2xl">Start your crew</h3>
            <div className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 24))}
                placeholder="Clan name"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-edge-coral"
              />
              <input
                value={tag}
                onChange={(e) =>
                  setTag(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 4))
                }
                placeholder="Tag (2-4 chars, e.g. EDG)"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm uppercase tracking-[0.22em] text-white outline-none focus:border-edge-coral"
              />
              <div>
                <p className="label-xs mb-2">Color</p>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={
                        "h-7 w-7 rounded-full border-2 transition " +
                        (color === c ? "border-white" : "border-white/10")
                      }
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={name.length < 2 || tag.length < 2}
                className="w-full rounded-lg border border-edge-coral/50 bg-edge-coral/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-coral hover:bg-edge-coral/25 disabled:opacity-40"
              >
                Create →
              </button>
            </div>
          </form>

          {/* Join */}
          <form
            onSubmit={handleJoin}
            className="glass rounded-2xl p-5"
          >
            <p className="label-xs text-edge-cyan">Join a clan</p>
            <h3 className="heading-display mt-2 text-2xl">Got a code?</h3>
            <div className="mt-4 space-y-3">
              <input
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
                  )
                }
                placeholder="6-char clan code"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-center text-base uppercase tracking-[0.32em] text-white outline-none focus:border-edge-cyan"
              />
              <button
                type="submit"
                disabled={joinCode.length !== 6}
                className="w-full rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-cyan hover:bg-edge-cyan/25 disabled:opacity-40"
              >
                Join →
              </button>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/30">
                Local-only · clan registry coming soon
              </p>
            </div>
          </form>
        </div>
      )}

      <Footer />
    </main>
  );
}
