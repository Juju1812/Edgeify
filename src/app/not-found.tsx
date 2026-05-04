import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="label-xs text-edge-cyan">404</p>
      <h1 className="heading-display mt-3 text-6xl">
        Off the <span className="brand-edge">edge</span>.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55">
        That page isn&apos;t in the bracket. Maybe you got mogged off the URL.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl border border-edge-cyan/50 bg-edge-cyan/15 px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-cyan hover:bg-edge-cyan/25"
        >
          Back to lobby →
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
        >
          Leaderboard
        </Link>
      </div>
    </main>
  );
}
