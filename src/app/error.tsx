"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page flex flex-col items-center pt-24 text-center">
      <h1 className="display text-[36px]">Something went wrong.</h1>
      <p className="mt-2 text-[17px] text-ink-3">It&apos;s not you. Try again in a moment.</p>
      <button
        onClick={reset}
        className="mt-8 inline-flex h-11 items-center rounded-full bg-accent px-6 text-[15px] font-medium text-white hover:bg-accent-hover"
      >
        Try again
      </button>
    </main>
  );
}
