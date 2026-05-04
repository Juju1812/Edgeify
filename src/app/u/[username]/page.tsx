import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { Footer } from "@/components/Footer";
import { OwnerBadge } from "@/components/OwnerBadge";
import { Redis } from "@upstash/redis";
import { rankFromElo } from "@/lib/rank";

// QRCode (Node) needs the Node runtime; the rest of the page works fine
// either way. We pre-render the SVG at request time and inline it.
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
  params: { username: string };
}): Promise<Metadata> {
  const profile = await getProfile(params.username);
  const title = profile
    ? `${profile.username} · Edgify`
    : `${params.username} · Edgify`;
  const description = profile
    ? `${profile.username} on Edgify. ${profile.elo} ELO · ${profile.wins}W ${profile.losses}L · EdgeScore ${profile.edgeScore}.`
    : `${params.username}'s profile on Edgify.`;
  const ogUrl = `/api/og/${encodeURIComponent(params.username)}`;
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

export default async function PublicProfilePage({
  params
}: {
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();
  const rank = rankFromElo(profile.elo);
  const total = profile.wins + profile.losses;
  const winRate = total > 0 ? Math.round((profile.wins / total) * 100) : 0;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 transition hover:text-white"
      >
        ← Edgify
      </Link>

      <div className="mt-6 grid gap-6 md:grid-cols-[260px_1fr]">
        <div className="glass overflow-hidden rounded-2xl">
          <div className="aspect-square w-full bg-black/40">
            {profile.faceDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.faceDataUrl}
                alt=""
                className="h-full w-full -scale-x-100 object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl">
                {rank.emoji}
              </div>
            )}
          </div>
          <div className="border-t border-white/[0.04] px-4 py-4 text-center">
            <p className="text-base font-semibold uppercase tracking-[0.22em] text-white">
              {profile.username}
              <OwnerBadge name={profile.username} size="sm" />
            </p>
            <p
              className="mt-1 text-[11px] uppercase tracking-[0.32em]"
              style={{ color: rank.color }}
            >
              {rank.emoji} {rank.label}
            </p>
            <p className="mt-2 font-mono text-cyan-300">{profile.elo} ELO</p>
          </div>
        </div>

        <div className="space-y-3">
          <Stat label="Wins" value={profile.wins} />
          <Stat label="Losses" value={profile.losses} />
          <Stat label="Win rate" value={`${winRate}%`} />
          <Stat label="EdgeScore" value={profile.edgeScore} />
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="glass rounded-2xl p-6">
          <p className="label-xs text-edge-cyan">Challenge</p>
          <p className="mt-2 text-sm text-white/70">
            Want to face off against {profile.username}? Hop into the Arena and
            queue for a Random Match — if you&apos;re close in ELO you&apos;ll
            probably get matched.
          </p>
          <Link
            href="/arena"
            className="mt-4 inline-block rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-cyan/25"
          >
            Enter Arena →
          </Link>
        </div>
        <ProfileQR username={profile.username} />
      </div>

      <Footer />
    </main>
  );
}

function Stat({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="glass flex items-center justify-between rounded-xl px-5 py-3">
      <span className="text-[11px] uppercase tracking-[0.32em] text-white/40">
        {label}
      </span>
      <span className="font-mono text-base text-white">{value}</span>
    </div>
  );
}

/**
 * Server-rendered QR code pointing at the public profile URL. Lets
 * players show their phone to quickly share their rank card.
 */
async function ProfileQR({ username }: { username: string }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://edgify.cc";
  const url = `${base}/u/${encodeURIComponent(username)}`;
  let svg = "";
  try {
    svg = await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      width: 160,
      color: { dark: "#22e9ff", light: "#00000000" }
    });
  } catch {
    return null;
  }
  return (
    <div className="glass flex flex-col items-center justify-center gap-2 rounded-2xl p-4">
      <p className="label-xs text-edge-cyan">Scan</p>
      <div
        aria-label="QR code to this profile"
        className="rounded-lg bg-black/40 p-2"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
        /u/{username}
      </p>
    </div>
  );
}
