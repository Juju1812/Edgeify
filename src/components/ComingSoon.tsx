import Link from "next/link";

export function ComingSoon({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="label-xs mb-4">In Development</p>
      <h1 className="heading-card mb-4 text-4xl">{title}</h1>
      <p className="mb-8 max-w-md text-sm text-white/60">{description}</p>
      <Link
        href="/"
        className="pill text-white/70 transition hover:border-mog-violet hover:text-white"
      >
        ← Back to Lobby
      </Link>
    </main>
  );
}
