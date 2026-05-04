import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/[0.04] bg-black/30 py-8 backdrop-blur">
      <div className="mx-auto max-w-[1400px] space-y-3 px-6 text-center text-[11px] uppercase tracking-[0.24em] text-white/40">
        <p>
          EdgeScore is an entertainment metric based on geometric facial
          measurements. It is <span className="text-white/60">not</span> an
          objective beauty judgment.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-white/50">
          <Link href="/about" className="hover:text-white">
            About
          </Link>
          <Link href="/whats-new" className="hover:text-white">
            What&apos;s new
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
          <Link href="/profile" className="hover:text-white">
            Delete my data
          </Link>
          <Link href="/touch-grass" className="hover:text-edge-cyan">
            Touch grass →
          </Link>
        </div>
      </div>
    </footer>
  );
}
