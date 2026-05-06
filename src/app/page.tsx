"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Footer } from "@/components/Footer";
import { GuestBanner } from "@/components/GuestBanner";
import { HeroBadge } from "@/components/HeroBadge";
import { FeaturedArenaCard } from "@/components/FeaturedArenaCard";
import { SecondaryTile } from "@/components/SecondaryTile";
import {
  ArrowRightIcon,
  LockIcon,
  PersonIcon,
  TrophyIcon
} from "@/components/icons";
import { SideRail } from "@/components/SideRail";
import { SignInModal } from "@/components/SignInModal";
import { SocialRow } from "@/components/SocialRow";
import { SuggestedActions } from "@/components/SuggestedActions";
import { useUser } from "@/lib/user-context";

// ─── Below-the-fold lazy chunks ─────────────────────────────────────
// Mounting these inline grew the initial JS hot-path noticeably. They
// don't matter for above-the-fold paint; defer the import + render so
// slow devices get to interactive faster.
const skeleton = (h: string) => (
  <div className={`glass animate-pulse rounded-2xl ${h}`} />
);
const SeasonStrip = dynamic(
  () => import("@/components/SeasonStrip").then((m) => m.SeasonStrip),
  { ssr: false, loading: () => skeleton("h-16") }
);
const Tutorial = dynamic(
  () => import("@/components/Tutorial").then((m) => m.Tutorial),
  { ssr: false }
);
const PromoSeriesWidget = dynamic(
  () => import("@/components/RankUpModal").then((m) => m.PromoSeriesWidget),
  { ssr: false }
);
const RankUpModal = dynamic(
  () => import("@/components/RankUpModal").then((m) => m.RankUpModal),
  { ssr: false }
);
const ActivityTicker = dynamic(
  () => import("@/components/ActivityTicker").then((m) => m.ActivityTicker),
  { ssr: false, loading: () => skeleton("h-12") }
);
const RankProgressWidget = dynamic(
  () =>
    import("@/components/RankProgressWidget").then((m) => m.RankProgressWidget),
  { ssr: false, loading: () => skeleton("h-32") }
);
const StreakCalendar = dynamic(
  () => import("@/components/StreakCalendar").then((m) => m.StreakCalendar),
  { ssr: false, loading: () => skeleton("h-32") }
);
const StreakLadder = dynamic(
  () => import("@/components/StreakLadder").then((m) => m.StreakLadder),
  { ssr: false, loading: () => skeleton("h-24") }
);
const RankDecayWidget = dynamic(
  () => import("@/components/RankDecayWidget").then((m) => m.RankDecayWidget),
  { ssr: false }
);
const EventBanner = dynamic(
  () => import("@/components/EventBanner").then((m) => m.EventBanner),
  { ssr: false }
);
const OnboardingChecklist = dynamic(
  () =>
    import("@/components/OnboardingChecklist").then((m) => m.OnboardingChecklist),
  { ssr: false }
);
const DailyQuests = dynamic(
  () => import("@/components/DailyQuests").then((m) => m.DailyQuests),
  { ssr: false, loading: () => skeleton("h-32") }
);
const DailyLoginSpinner = dynamic(
  () =>
    import("@/components/DailyLoginSpinner").then((m) => m.DailyLoginSpinner),
  { ssr: false }
);
const WeeklyRecap = dynamic(
  () => import("@/components/WeeklyRecap").then((m) => m.WeeklyRecap),
  { ssr: false }
);
const SeasonCountdown = dynamic(
  () => import("@/components/SeasonCountdown").then((m) => m.SeasonCountdown),
  { ssr: false }
);
const AnniversaryCard = dynamic(
  () => import("@/components/AnniversaryCard").then((m) => m.AnniversaryCard),
  { ssr: false }
);
const DailyPoll = dynamic(
  () => import("@/components/DailyPoll").then((m) => m.DailyPoll),
  { ssr: false, loading: () => <div className="glass h-24 animate-pulse rounded-2xl" /> }
);
const FriendActivity = dynamic(
  () => import("@/components/FriendActivity").then((m) => m.FriendActivity),
  { ssr: false }
);

export default function HomePage() {
  const { user, status, ready } = useUser();
  const [signInOpen, setSignInOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const router = useRouter();

  const openSignIn = () => setSignInOpen(true);

  // ─── Status chips for the secondary tiles ──────────────────────────
  function calibrateStatus() {
    if (!ready || status === "guest") return null;
    if (status === "auth-no-scan")
      return (
        <span className="inline-block rounded-md border border-edge-cyan/30 bg-edge-cyan/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-edge-cyan">
          Start scan
        </span>
      );
    if (status === "calibrating")
      return (
        <span className="inline-block rounded-md border border-edge-cyan/30 bg-edge-cyan/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-edge-cyan">
          {user.placementsLeft} placement{user.placementsLeft === 1 ? "" : "s"} left
        </span>
      );
    return (
      <span className="inline-block rounded-md border border-emerald-400/25 bg-emerald-500/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
        Re-scan available
      </span>
    );
  }

  return (
    <main className="min-h-screen pb-12">
      <GuestBanner onSignIn={openSignIn} />
      <SideRail />

      {/* ───── HERO ───── */}
      <section className="mx-auto max-w-[1400px] px-6 pt-12 sm:pt-20">
        <HeroBadge onSignIn={openSignIn} />
      </section>

      {/* ───── SUGGESTED ACTIONS (signed-in only) ───── */}
      <section className="mx-auto mt-6 max-w-[1400px] px-6">
        <SuggestedActions />
      </section>

      {/* ───── LIMITED-TIME EVENT (only when active) ───── */}
      <section className="mx-auto mt-6 max-w-[1400px] px-6">
        <EventBanner />
      </section>

      {/* ───── PRIMARY: Featured 1V1 Arena ───── */}
      <section className="mx-auto mt-10 max-w-[1400px] px-6 sm:mt-14">
        <FeaturedArenaCard onSignIn={openSignIn} />
      </section>

      {/* ───── ONBOARDING + DAILY SPIN + PROMO + DECAY ───── */}
      <section className="mx-auto mt-5 max-w-[1400px] space-y-3 px-6">
        <SeasonCountdown />
        <AnniversaryCard />
        <FriendActivity />
        <OnboardingChecklist />
        <DailyLoginSpinner />
        <PromoSeriesWidget />
        <RankDecayWidget />
      </section>

      {/* ───── SECONDARY: 3-up tiles (Calibrate / Leaderboard / Tournaments) ───── */}
      <section className="mx-auto mt-5 max-w-[1400px] px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <SecondaryTile
            index={0}
            href="/lab"
            icon={<PersonIcon className="h-6 w-6" />}
            title="Calibrate"
            subtitle="Solo face scan"
            accent="cyan"
            status={calibrateStatus()}
          />
          <SecondaryTile
            index={1}
            href="/leaderboard"
            icon={<TrophyIcon className="h-6 w-6" />}
            title="Leaderboard"
            subtitle="Top 100 ranked"
            accent="amber"
          />
          <SecondaryTile
            index={2}
            href="/private"
            icon={<LockIcon className="h-6 w-6" />}
            title="Tournaments"
            subtitle="Brackets & private rooms"
            accent="coral"
            status={
              <PrivateCodeInput
                value={joinCode}
                onChange={setJoinCode}
                onJoin={() => {
                  const code = joinCode.trim();
                  if (code.length === 6) {
                    router.push(`/private?code=${code.toUpperCase()}`);
                  }
                }}
              />
            }
          />
        </div>
      </section>

      {/* ───── ACTIVITY TICKER ───── */}
      <section className="mx-auto mt-5 max-w-[1400px] px-6">
        <ActivityTicker />
      </section>

      {/* ───── SEASON + RANK PROGRESS + STREAK ───── */}
      <section className="mx-auto mt-10 max-w-[1400px] px-6">
        <SeasonStrip />
      </section>
      <section className="mx-auto mt-3 grid max-w-[1400px] gap-3 px-6 lg:grid-cols-2">
        <RankProgressWidget />
        <StreakCalendar />
      </section>
      <section className="mx-auto mt-3 max-w-[1400px] px-6">
        <StreakLadder />
      </section>

      {/* ───── DAILY QUESTS + WEEKLY RECAP + DAILY POLL ───── */}
      <section className="mx-auto mt-3 max-w-[1400px] space-y-3 px-6">
        <DailyQuests />
        <WeeklyRecap />
        <DailyPoll />
      </section>

      {/* ───── EXTRA NAV (row 1: action) ───── */}
      <section className="mx-auto mt-5 max-w-[1400px] px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NavChip href="/daily" label="Daily Boss" hint="Today's shared opponent" accent="coral" />
          <NavChip href="/discover" label="Discover" hint="Swipe through players" accent="coral" />
          <NavChip href="/practice" label="Practice" hint="Solo training breakdown" />
          <NavChip href="/highlights" label="Highlights" hint="Your best moments" />
        </div>
      </section>

      {/* ───── EXTRA NAV (row 2: meta) ───── */}
      <section className="mx-auto mt-3 max-w-[1400px] px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NavChip href="/live" label="Live Feed" hint="Active players now" />
          <NavChip href="/today" label="The Edgify Times" hint="Today's daily digest" accent="coral" />
          <NavChip href="/clans" label="Clans" hint="Form a crew" />
          <NavChip href="/workshop" label="Workshop" hint="Alt scoring formulas" />
        </div>
      </section>

      {/* ───── EXTRA NAV (row 3: account + Pro) ───── */}
      <section className="mx-auto mt-3 max-w-[1400px] px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <NavChip href="/friends" label="Friends" hint="Add players, DM" />
          <NavChip href="/challenges" label="Challenges" hint="Incoming" accent="coral" />
          <NavChip href="/career" label="Career" hint="Lifetime + coach" />
          <NavChip href="/achievements" label="Unlocks" hint="Achievements" />
          <NavChip href="/pricing" label="Edgify Pro" hint="$4.99/mo · unlock all" accent="coral" />
          <NavChip href="/settings" label="Settings" hint="AR, mic, privacy" />
        </div>
      </section>

      {/* ───── SOCIAL STRIP ───── */}
      <section className="mx-auto mt-12 max-w-[1400px] px-6">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4 backdrop-blur">
          <SocialRow />
        </div>
      </section>

      <Footer />

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      <Tutorial />
      <RankUpModal />
    </main>
  );
}

// ─── Inline helpers ───────────────────────────────────────────────────

function NavChip({
  href,
  label,
  hint,
  accent = "cyan"
}: {
  href: string;
  label: string;
  hint: string;
  accent?: "cyan" | "coral";
}) {
  const hover =
    accent === "coral"
      ? "hover:border-edge-coral/30 group-hover:text-edge-coral"
      : "hover:border-white/15 group-hover:text-edge-cyan";
  return (
    <Link
      href={href}
      className={`group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 transition ${hover.split(" ")[0]} hover:bg-white/[0.04]`}
    >
      <div>
        <p
          className={
            "text-[11px] font-semibold uppercase tracking-[0.22em] " +
            (accent === "coral" ? "text-edge-coral" : "text-white/85")
          }
        >
          {label}
        </p>
        <p className="mt-0.5 text-[11px] text-white/40">{hint}</p>
      </div>
      <ArrowRightIcon
        className={`h-4 w-4 text-white/25 transition group-hover:translate-x-0.5 ${hover.split(" ")[1]}`}
      />
    </Link>
  );
}

function PrivateCodeInput({
  value,
  onChange,
  onJoin
}: {
  value: string;
  onChange: (s: string) => void;
  onJoin: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onJoin();
      }}
      onClick={(e) => e.stopPropagation()}
      className="relative z-10"
    >
      <div className="flex items-center gap-2 rounded-md border border-edge-coral/25 bg-edge-coral/[0.04] px-2 py-1.5 transition focus-within:border-edge-coral/60">
        <input
          value={value}
          onChange={(e) =>
            onChange(
              e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
            )
          }
          placeholder="CODE"
          className="w-20 bg-transparent text-center text-[11px] uppercase tracking-[0.22em] text-edge-coral outline-none placeholder:text-edge-coral/35"
        />
        <button
          type="submit"
          disabled={value.length !== 6}
          className="rounded-sm bg-edge-coral/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-edge-coral transition hover:bg-edge-coral/35 hover:text-white disabled:opacity-40"
        >
          Join
        </button>
      </div>
    </form>
  );
}
