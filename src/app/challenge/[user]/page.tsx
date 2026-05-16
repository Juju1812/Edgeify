import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { ChallengeJoinButton } from "@/components/ChallengeJoinButton";
import { Redis } from "@upstash/redis";
import { rankFromElo } from "@/lib/rank";

export const runtime = "nodejs";
export const revalidate = 60;

type ProfileSummary = {
  username: string;
  elo: number;
  wins: number;
  losses: number;
  edgeScore: number;
  faceDataUrl: string | null;
};

async function getProfile(u: string): Promise<ProfileSummary | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const redis = Redis.fromEnv();
  const raw = await redis.get<string | object>(
    `lb:summary:v1:${u.toLowerCase()}`
  );
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as ProfileSummary);
}

export async function generateMetadata({
  params
}: {
  params: { user: string };
}): Promise<Metadata> {
  const p = await getProfile(params.user);
  const display = p?.username || params.user;
  const elo = p?.elo;
  const title = elo
    ? `${display} challenged you · ${elo} ELO · Edgify`
    : `${display} challenged you · Edgify`;
  const description = `Open this link to drop into a private 1v1 face-off against ${display}.`;
  const ogUrl = `/api/og/${encodeURIComponent(params.user)}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630 }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl]
    }
  };
}

/**
 * /challenge/[user] — share-friendly challenge link. Designed for the
 * "text my friend a link" pattern: the receiver opens it, sees who
 * challenged them and their stats, taps a button, and lands in a
 * private room pre-keyed for that exact opponent.
 *
 * Room code is derived from the sorted username pair (same scheme as
 * /play/[user]) so the challenger only needs to hit the same /play
 * URL from their own client to land in the same room.
 */
export default async function ChallengePage({
  params
}: {
  params: { user: string };
}) {
  const profile = await getProfile(params.user);
  if (!profile) notFound();
  const rank = rankFromElo(profile.elo);
  const total = profile.wins + profile.losses;
  const winRate = total > 0 ? Math.round((profile.wins / total) * 100) : 0;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 pt-16 pb-16 text-center">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Edgify
      </Link>

      <p className="label-xs mt-10 text-edge-coral">Challenge incoming</p>
      <h1 className="heading-display mt-3 text-4xl">
        <span className="brand-edge">{profile.username}</span> wants
        <br />
        to face off
      </h1>

      <div className="glass mx-auto mt-8 max-w-sm overflow-hidden rounded-2xl">
        <div className="aspect-square w-full bg-black/40">
          {profile.faceDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.faceDataUrl}
              alt=""
              className="h-full w-full -scale-x-100 object-cover"
            />
          ) : (
            <div
              className="flex h-full items-center justify-center text-7xl"
              style={{ color: rank.color }}
            >
              {rank.emoji}
            </div>
          )}
        </div>
        <div className="border-t border-white/[0.04] px-5 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
            {profile.username}
          </p>
          <p
            className="mt-1 text-[10px] uppercase tracking-[0.32em]"
            style={{ color: rank.color }}
          >
            {rank.emoji} {rank.label}
          </p>
          <p className="stat-mono mt-2 text-edge-cyan">{profile.elo} ELO</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/45">
            {profile.wins}W · {profile.losses}L · {winRate}% WR
          </p>
        </div>
      </div>

      <div className="mt-8">
        <ChallengeJoinButton challengerUsername={profile.username} />
        <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-white/35">
          Private 1v1 · best of 3 · ranked
        </p>
      </div>

      <Footer />
    </main>
  );
}
