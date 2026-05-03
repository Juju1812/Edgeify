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
import { SocialRow } from "@/components/SocialRow";
import { rankFromElo } from "@/lib/rank";

export default function HomePage() {
  // Placeholder values until auth + DB are wired in next pass.
  const username = "JRUB";
  const elo = 337;
  const onlineCount = 3400;
  const rank = rankFromElo(elo);

  return (
    <main className="min-h-screen pb-12">
      <GuestBanner />
      <SideRail />

      <section className="mx-auto max-w-[1400px] px-6 pt-12 sm:pt-16">
        <HeroBadge username={username} elo={elo} online={onlineCount} />
      </section>

      <section className="mx-auto mt-14 grid max-w-[1400px] grid-cols-1 gap-5 px-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
        <ModeCard
          index={0}
          href="/arena"
          icon={<SwordsIcon className="h-20 w-20" />}
          title="1V1 Arena"
          subtitle="Ranked Matchmaking"
          footer={
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em]">
              <span className="font-semibold text-white/90">{username}</span>
              <span className="text-white/20">|</span>
              <span
                className="inline-flex items-center gap-1"
                style={{ color: rank.color }}
              >
                <span aria-hidden>{rank.emoji}</span> {rank.label}
              </span>
              <span className="text-white/20">|</span>
              <span className="text-cyan-300">{elo} ELO</span>
            </div>
          }
        />

        <ModeCard
          index={1}
          href="/lab"
          icon={<PersonIcon className="h-20 w-20" />}
          title="The Lab"
          subtitle="Solo Calibration"
        />

        <ModeCard
          index={2}
          href="/leaderboard"
          icon={<TrophyIcon className="h-20 w-20" />}
          title="Global Rank"
          subtitle="Top 100 Moggers"
        />

        <ModeCard
          index={3}
          href="/private"
          icon={<LockIcon className="h-20 w-20" />}
          title="Private Room"
          subtitle="Click to generate code"
          footer={
            <button className="group mx-auto flex w-fit items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/5 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-rose-200/90 transition hover:border-rose-300/60 hover:bg-rose-500/10 hover:text-rose-100">
              Have a code? Join
              <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </button>
          }
        />
      </section>

      <section className="mx-auto mt-14 max-w-[1400px] px-6">
        <SocialRow />
      </section>

      <Footer />
    </main>
  );
}
