import Link from "next/link";

export default function TouchGrassPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl">🌱</div>
      <h1 className="heading-card mt-6 text-3xl">Go outside.</h1>
      <p className="mt-4 max-w-sm text-sm text-white/60">
        Your face is fine. The leaderboard will still be here when you get back.
      </p>
      <Link
        href="/"
        className="pill mt-10 text-white/60 hover:text-white"
      >
        ← I have touched grass, return me to the lobby
      </Link>
    </main>
  );
}
