"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/Footer";
import { GuestBanner } from "@/components/GuestBanner";
import { HeroBadge } from "@/components/HeroBadge";
import {
  ArrowRightIcon,
  LockIcon,
  PersonIcon,
  SwordsIcon,
  TrophyIcon
} from "@/components/icons";
import { ModeCard } from "@/components/ModeCard";
import { SideRail } from "@/components/SideRail";
import { SignInModal } from "@/components/SignInModal";
import { SocialRow } from "@/components/SocialRow";
import { useUser } from "@/lib/user-context";
import { rankFromElo } from "@/lib/rank";

export default function HomePage() {
  const { user, status, ready } = useUser();
  const [signInOpen, setSignInOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const router = useRouter();

  const openSignIn = () => setSignInOpen(true);

  function arenaFooter() {
    if (!ready || status === "guest")
      return (
        <button
          onClick={(e) => {
            e.preventDefault();
            openSignIn();
          }}
          className="mx-auto flex w-fit items-center gap-2 rounded-full border border-mog-violet/40 bg-mog-violet/10 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-mog-violet transition hover:border-mog-violet hover:bg-mog-violet/20 hover:text-white"
        >
          Sign in to play
        </button>
      );
    if (status === "auth-no-scan")
      return (
        <span className="mx-auto block w-fit rounded-full border border-white/10 bg-black/40 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-mog-violet">
          Scan first →
        </span>
      );
    const rank = rankFromElo(user.elo);
    return (
      <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em]">
        <span className="font-semibold text-white/90">{user.username}</span>
        <span className="text-white/20">|</span>
        {status === "calibrating" ? (
          <span className="text-cyan-300">
            Placement {5 - user.placementsLeft}/5
          </span>
        ) : (
          <>
            <span
              className="inline-flex items-center gap-1"
              style={{ color: rank.color }}
            >
              <span aria-hidden>{rank.emoji}</span> {rank.label}
            </span>
            <span className="text-white/20">|</span>
            <span className="text-cyan-300">{user.elo} ELO</span>
          </>
        )}
      </div>
    );
  }

  function labFooter() {
    if (!ready || status === "guest") return undefined;
    if (status === "auth-no-scan")
      return (
        <span className="mx-auto block w-fit rounded-full border border-mog-violet/30 bg-mog-violet/10 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-mog-violet">
          Start scan →
        </span>
      );
    if (status === "calibrating")
      return (
        <span className="mx-auto block w-fit rounded-full border border-cyan-400/30 bg-cyan-500/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-cyan-200">
          {user.placementsLeft} placements left
        </span>
      );
    return (
      <span className="mx-auto block w-fit rounded-full border border-emerald-400/30 bg-emerald-500/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-emerald-200">
        Re-scan
      </span>
    );
  }

  function privateFooter() {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (joinCode.trim().length === 6)
            router.push(`/private?code=${joinCode.trim().toUpperCase()}`);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/5 px-2 py-1 text-[11px] uppercase tracking-[0.22em] text-rose-200/90 transition focus-within:border-rose-300/60 focus-within:bg-rose-500/10">
          <input
            value={joinCode}
            onChange={(e) =>
              setJoinCode(
                e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
              )
            }
            placeholder="HAVE A CODE?"
            className="w-[7.5rem] bg-transparent px-2 py-1 text-center text-[11px] tracking-[0.22em] text-rose-100 outline-none placeholder:text-rose-200/40"
          />
          <button
            type="submit"
            className="group inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-3 py-1 text-rose-100 transition hover:bg-rose-500/30"
            disabled={joinCode.length !== 6}
            style={{ opacity: joinCode.length === 6 ? 1 : 0.4 }}
          >
            Join
            <ArrowRightIcon className="h-3 w-3 transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </form>
    );
  }

  return (
    <main className="min-h-screen pb-12">
      <GuestBanner onSignIn={openSignIn} />
      <SideRail />

      <section className="mx-auto max-w-[1400px] px-6 pt-12 sm:pt-16">
        <HeroBadge onSignIn={openSignIn} />
      </section>

      <section className="mx-auto mt-14 grid max-w-[1400px] grid-cols-1 gap-5 px-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
        <ModeCard
          index={0}
          href="/arena"
          icon={<SwordsIcon className="h-20 w-20" />}
          title="1V1 Arena"
          subtitle="Ranked Matchmaking"
          footer={arenaFooter()}
        />

        <ModeCard
          index={1}
          href="/lab"
          icon={<PersonIcon className="h-20 w-20" />}
          title="The Lab"
          subtitle="Solo Calibration"
          footer={labFooter()}
        />

        <ModeCard
          index={2}
          href="/leaderboard"
          icon={<TrophyIcon className="h-20 w-20" />}
          title="Global Rank"
          subtitle="Top 100 Adams"
        />

        <ModeCard
          index={3}
          href="/private"
          icon={<LockIcon className="h-20 w-20" />}
          title="Private Room"
          subtitle="Click to generate code"
          footer={privateFooter()}
        />
      </section>

      <section className="mx-auto mt-14 max-w-[1400px] px-6">
        <SocialRow />
      </section>

      <Footer />

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </main>
  );
}
