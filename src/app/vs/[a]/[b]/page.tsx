import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { OwnerBadge } from "@/components/OwnerBadge";
import { Redis } from "@upstash/redis";
import { rankFromElo } from "@/lib/rank";

export const runtime = "edge";
export const revalidate = 60;

type ProfileSummary = {
  username: string;
  elo: number;
  wins: number;
  losses: number;
  edgeScore: number;
  faceDataUrl: string | null;
};

async function getProfile(username: string): Promise<ProfileSummary | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const redis = Redis.fromEnv();
  const raw = await redis.get<string | object>(
    `lb:summary:v1:${username.toLowerCase()}`
  );
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as ProfileSummary);
}

export async function generateMetadata({
  params
}: {
  params: { a: string; b: string };
}): Promise<Metadata> {
  const ogUrl = `/api/og/vs/${encodeURIComponent(params.a)}/${encodeURIComponent(
    params.b
  )}`;
  const title = `${params.a} vs ${params.b} · Edgify`;
  const description = `Head-to-head comparison of two Edgify players.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl]
    }
  };
}

export default async function VersusPage({
  params
}: {
  params: { a: string; b: string };
}) {
  const [pa, pb] = await Promise.all([getProfile(params.a), getProfile(params.b)]);
  if (!pa || !pb) notFound();
  const rankA = rankFromElo(pa.elo);
  const rankB = rankFromElo(pb.elo);
  const winRate = (p: ProfileSummary) =>
    p.wins + p.losses > 0
      ? Math.round((p.wins / (p.wins + p.losses)) * 100)
      : 0;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-cyan">Head to head</p>
        <h1 className="heading-display mt-2 text-4xl">
          {pa.username} <span className="brand-edge">vs</span> {pb.username}
        </h1>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_auto_1fr]">
        <PlayerCard p={pa} rank={rankA} />
        <div className="self-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-edge-cyan bg-black text-xl font-bold tracking-[0.18em] text-edge-cyan shadow-glow">
            VS
          </div>
        </div>
        <PlayerCard p={pb} rank={rankB} />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Compare label="ELO" a={pa.elo} b={pb.elo} />
        <Compare label="Wins" a={pa.wins} b={pb.wins} />
        <Compare label="Losses" a={pa.losses} b={pb.losses} flip />
        <Compare label="Win rate" a={`${winRate(pa)}%`} b={`${winRate(pb)}%`} aN={winRate(pa)} bN={winRate(pb)} />
        <Compare label="EdgeScore" a={pa.edgeScore} b={pb.edgeScore} />
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/arena"
          className="rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-cyan/25"
        >
          Queue match →
        </Link>
      </div>

      <Footer />
    </main>
  );
}

function PlayerCard({
  p,
  rank
}: {
  p: ProfileSummary;
  rank: { color: string; label: string; emoji: string };
}) {
  return (
    <Link
      href={`/u/${encodeURIComponent(p.username)}`}
      className="glass overflow-hidden rounded-2xl"
    >
      <div className="aspect-[4/3] w-full bg-black/40">
        {p.faceDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.faceDataUrl}
            alt=""
            className="h-full w-full -scale-x-100 object-cover"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center text-6xl"
            style={{ color: rank.color }}
          >
            {rank.emoji}
          </div>
        )}
      </div>
      <div className="border-t border-white/[0.04] px-4 py-3 text-center">
        <p className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-white">
          {p.username}
          <OwnerBadge name={p.username} size="sm" />
        </p>
        <p
          className="mt-1 text-[10px] uppercase tracking-[0.32em]"
          style={{ color: rank.color }}
        >
          {rank.emoji} {rank.label}
        </p>
        <p className="stat-mono mt-1 text-edge-cyan">{p.elo} ELO</p>
      </div>
    </Link>
  );
}

function Compare({
  label,
  a,
  b,
  aN,
  bN,
  flip
}: {
  label: string;
  a: string | number;
  b: string | number;
  aN?: number;
  bN?: number;
  flip?: boolean;
}) {
  const aNum = typeof aN === "number" ? aN : typeof a === "number" ? a : 0;
  const bNum = typeof bN === "number" ? bN : typeof b === "number" ? b : 0;
  // For "flip" stats (lower is better), invert.
  const aWins = flip ? aNum < bNum : aNum > bNum;
  const bWins = flip ? bNum < aNum : bNum > aNum;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
      <p className="label-xs text-center">{label}</p>
      <div className="mt-2 grid grid-cols-3 items-center gap-2">
        <p
          className={
            "stat-mono text-right text-2xl font-bold " +
            (aWins ? "text-edge-cyan" : "text-white/65")
          }
        >
          {a}
        </p>
        <p className="text-center text-[10px] uppercase tracking-[0.32em] text-white/35">
          vs
        </p>
        <p
          className={
            "stat-mono text-left text-2xl font-bold " +
            (bWins ? "text-edge-cyan" : "text-white/65")
          }
        >
          {b}
        </p>
      </div>
    </div>
  );
}
