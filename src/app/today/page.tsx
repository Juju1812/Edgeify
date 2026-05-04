import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Redis } from "@upstash/redis";
import { LEADERBOARD_KEY, lbSummaryKey } from "@/lib/auth-server";
import { rankFromElo } from "@/lib/rank";
import { OwnerBadge } from "@/components/OwnerBadge";

export const runtime = "edge";
export const revalidate = 300; // 5 min

type Summary = {
  username: string;
  elo: number;
  wins: number;
  losses: number;
  edgeScore: number;
  faceDataUrl: string | null;
  countryCode: string | null;
  updatedAt: number;
};

async function getTopAndRecent(): Promise<{
  top: Summary[];
  recent: Summary[];
  count: number;
}> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return { top: [], recent: [], count: 0 };
  }
  const redis = Redis.fromEnv();
  const usernames = ((await redis.zrange(LEADERBOARD_KEY, 0, 99, {
    rev: true
  })) as string[]) || [];
  const summaries = await Promise.all(
    usernames.map(async (u) => {
      const raw = await redis.get<string | object>(lbSummaryKey(u));
      if (!raw) return null;
      const obj =
        typeof raw === "string"
          ? JSON.parse(raw)
          : (raw as Record<string, unknown>);
      return {
        username: String(obj.username || u),
        elo: Number(obj.elo) || 0,
        wins: Number(obj.wins) || 0,
        losses: Number(obj.losses) || 0,
        edgeScore: Number(obj.edgeScore) || 0,
        faceDataUrl: typeof obj.faceDataUrl === "string" ? obj.faceDataUrl : null,
        countryCode: typeof obj.countryCode === "string" ? obj.countryCode : null,
        updatedAt: Number(obj.updatedAt) || 0
      };
    })
  );
  const all = summaries.filter(Boolean) as Summary[];
  const top = [...all].sort((a, b) => b.elo - a.elo).slice(0, 5);
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const recent = all
    .filter((s) => s.updatedAt && now - s.updatedAt < dayMs)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);
  return { top, recent, count: all.length };
}

export default async function TodayPage() {
  const { top, recent, count } = await getTopAndRecent();
  const dateLabel = new Date().toUTCString().slice(0, 16);
  const headline =
    top.length > 0
      ? `${top[0].username} HOLDS THE TOP — ${top[0].elo} ELO`
      : "QUIET DAY ON THE LADDER";

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      {/* Newspaper header */}
      <div className="mt-6 border-b-4 border-double border-white/15 pb-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.32em] text-white/45">
          <span>The Edgify Times</span>
          <span>{dateLabel}</span>
          <span>Daily Edition</span>
        </div>
        <h1
          className="mt-3 text-center font-bold uppercase leading-none"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "clamp(2.2rem, 6vw, 4.5rem)",
            letterSpacing: "-0.025em"
          }}
        >
          <span className="brand-edge">EDGIFY</span>
        </h1>
        <p className="mt-1 text-center text-[11px] uppercase tracking-[0.32em] text-white/40">
          Vol. 1 · Issue {Math.floor(Date.now() / 86400000) % 999} · Free
        </p>
      </div>

      {/* Lead headline */}
      <section className="mt-6 border-b border-white/10 pb-6">
        <h2 className="heading-display text-3xl uppercase leading-tight sm:text-4xl">
          {headline}
        </h2>
        {top[0] && (
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            With <span className="font-semibold text-white">{top[0].wins}</span>{" "}
            wins and {top[0].losses} losses on record, {top[0].username} sits at
            an EdgeScore of {top[0].edgeScore}. The next contender,{" "}
            <span className="font-semibold text-white">{top[1]?.username || "an empty seat"}</span>
            , trails by{" "}
            <span className="text-edge-coral">
              {top[1] ? top[0].elo - top[1].elo : "—"}
            </span>{" "}
            ELO.
          </p>
        )}
      </section>

      {/* Two-column body */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-[0.32em] text-edge-cyan">
            Top of the ladder
          </h3>
          <ol className="mt-3 space-y-2">
            {top.map((s, i) => {
              const r = rankFromElo(s.elo);
              return (
                <li
                  key={s.username}
                  className="flex items-center gap-3 border-b border-white/5 pb-2 text-sm"
                >
                  <span className="stat-mono w-6 text-right text-white/40">
                    {i + 1}.
                  </span>
                  <div className="flex-1 truncate">
                    <p className="font-semibold uppercase tracking-[0.16em] text-white">
                      {s.username}
                      <OwnerBadge name={s.username} size="xs" />
                    </p>
                    <p
                      className="text-[10px] uppercase tracking-[0.22em]"
                      style={{ color: r.color }}
                    >
                      {r.emoji} {r.label}
                    </p>
                  </div>
                  <span className="stat-mono text-edge-cyan">{s.elo}</span>
                </li>
              );
            })}
            {top.length === 0 && (
              <li className="text-sm text-white/45">
                No ranked players yet.
              </li>
            )}
          </ol>
        </section>
        <section>
          <h3 className="border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-[0.32em] text-edge-coral">
            Recent activity
          </h3>
          <ol className="mt-3 space-y-2">
            {recent.map((s) => (
              <li
                key={s.username}
                className="flex items-center gap-3 border-b border-white/5 pb-2 text-sm"
              >
                <Link
                  href={`/u/${encodeURIComponent(s.username)}`}
                  className="flex-1 truncate hover:text-white"
                >
                  <span className="font-semibold uppercase tracking-[0.16em] text-white">
                    {s.username}
                    <OwnerBadge name={s.username} size="xs" />
                  </span>
                  <span className="ml-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
                    {Math.max(0, Math.floor((Date.now() - s.updatedAt) / 60000))}m ago
                  </span>
                </Link>
                <span className="stat-mono text-edge-cyan">{s.elo}</span>
              </li>
            ))}
            {recent.length === 0 && (
              <li className="text-sm text-white/45">No recent activity.</li>
            )}
          </ol>
        </section>
      </div>

      <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.015] p-5 text-center">
        <p className="text-[11px] uppercase tracking-[0.32em] text-white/40">
          Population
        </p>
        <p className="stat-mono mt-2 text-3xl text-edge-cyan">{count}</p>
        <p className="mt-1 text-xs text-white/45">
          ranked players currently on the global leaderboard
        </p>
      </div>

      <p className="mt-8 text-center text-[10px] uppercase tracking-[0.32em] text-white/30">
        Updated every 5 minutes · Editor-in-Chief: Edge Algorithm v1
      </p>

      <Footer />
    </main>
  );
}
