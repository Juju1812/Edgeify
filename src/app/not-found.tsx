import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page flex flex-col items-center pt-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display mt-3 text-[40px]">This page doesn&apos;t exist.</h1>
      <p className="mt-2 text-[17px] text-ink-3">It may have moved in the redesign.</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center rounded-full bg-accent px-6 text-[15px] font-medium text-white hover:bg-accent-hover"
      >
        Go home
      </Link>
    </main>
  );
}
