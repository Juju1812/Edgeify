import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Redis } from "@upstash/redis";

export const runtime = "edge";
export const revalidate = 60;

type ReplayRound = { criterion: string; me: number; opp: number };
type ReplayDoc = {
  id: string;
  myName: string;
  oppName: string;
  myScore: number;
  oppScore: number;
  won: boolean;
  eloDelta: number;
  rounds: ReplayRound[];
  myFace: string | null;
  oppFace: string | null;
  mode?: string;
  playedAt: number;
};

async function getReplay(id: string): Promise<ReplayDoc | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const redis = Redis.fromEnv();
  const raw = await redis.get<string | object>(`replay:v1:${id}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as ReplayDoc);
}

export default async function ReplayPage({
  params
}: {
  params: { id: string };
}) {
  const r = await getReplay(params.id);
  if (!r) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 pt-10 pb-16">
      <Link href="/" className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white">
        ← Edgify
      </Link>

      <div className="mt-6 text-center">
        <p className="label-xs">Match Replay {r.mode && r.mode !== "bo3" ? `· ${r.mode.toUpperCase()}` : ""}</p>
        <h1 className="heading-card mt-2 text-3xl">
          {r.myName} <span className="text-white/30">vs</span> {r.oppName}
        </h1>
        <p className="mt-1 text-xs text-white/40">
          {new Date(r.playedAt).toLocaleString()}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <FacePanel name={r.myName} face={r.myFace} winner={r.won} score={r.myScore} />
        <FacePanel name={r.oppName} face={r.oppFace} winner={!r.won} score={r.oppScore} />
      </div>

      <div className="mt-6 text-center">
        <p
          className="text-3xl font-bold"
          style={{ color: r.eloDelta >= 0 ? "#22d3ee" : "#f43f5e" }}
        >
          {r.eloDelta >= 0 ? "+" : ""}
          {r.eloDelta} ELO
        </p>
      </div>

      {r.rounds && r.rounds.length > 0 && (
        <div className="mt-8 space-y-3">
          {r.rounds.map((rd, i) => {
            const won = rd.me > rd.opp;
            const tied = rd.me === rd.opp;
            const total = rd.me + rd.opp || 1;
            const myPct = (rd.me / total) * 100;
            return (
              <div key={i}>
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/60">
                  <span>R{i + 1} · {rd.criterion}</span>
                  <span style={{ color: tied ? "#fff" : won ? "#34d399" : "#f43f5e" }}>
                    {tied ? "TIED" : won ? "WIN" : "LOSS"}
                  </span>
                </div>
                <div className="mt-1 flex h-7 overflow-hidden rounded-md">
                  <div
                    className="flex items-center justify-end bg-emerald-500/30 pr-2 text-[10px] font-bold text-emerald-100"
                    style={{ width: `${myPct}%` }}
                  >
                    {rd.me}
                  </div>
                  <div
                    className="flex items-center justify-start bg-rose-500/30 pl-2 text-[10px] font-bold text-rose-100"
                    style={{ width: `${100 - myPct}%` }}
                  >
                    {rd.opp}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          href="/arena"
          className="rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
        >
          Play Edgify →
        </Link>
      </div>

      <Footer />
    </main>
  );
}

function FacePanel({
  name,
  face,
  winner,
  score
}: {
  name: string;
  face: string | null;
  winner: boolean;
  score: number;
}) {
  return (
    <div
      className={
        "glass overflow-hidden rounded-2xl border-2 " +
        (winner ? "border-emerald-400/50" : "border-rose-400/30")
      }
    >
      <div className="aspect-[4/3] bg-black/40">
        {face ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={face}
            alt=""
            className="h-full w-full -scale-x-100 object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl opacity-40">
            ?
          </div>
        )}
      </div>
      <div className="border-t border-white/[0.04] bg-black/50 px-3 py-2 text-center">
        <p className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-white">
          {name}
        </p>
        <p
          className="mt-1 text-2xl font-bold"
          style={{ color: winner ? "#34d399" : "#f43f5e" }}
        >
          {score}
        </p>
      </div>
    </div>
  );
}
