"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useSession } from "@/lib/client/session";
import { Avatar, ButtonLink } from "./ui";

const LINKS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/play", label: "Play", icon: PlayIcon },
  { href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon },
  { href: "/friends", label: "Friends", icon: PeopleIcon }
];

function active(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export function Nav() {
  const path = usePathname();
  const { me, loading, faceVersion } = useSession();
  const inMatch = path.startsWith("/play/match/");

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/[0.04] bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-[22px] font-bold tracking-tighter text-ink">
            <Logo />
            Edgify
          </Link>

          {me && (
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={clsx(
                    "rounded-full px-4 py-1.5 text-[15px] transition-colors",
                    active(path, l.href) ? "bg-fill-2 text-ink" : "text-ink-2 hover:text-ink"
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2">
            {!loading && !me && (
              <>
                <ButtonLink href="/login" variant="plain" size="sm">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/signup" size="sm">
                  Get started
                </ButtonLink>
              </>
            )}
            {me && (
              <Link href="/settings" aria-label="Your profile and settings" className="rounded-full">
                <Avatar username={me.username} hasFace={me.hasFace} size={36} version={faceVersion} />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* iOS-style tab bar on phones */}
      {me && !inMatch && (
        <nav
          className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-[26px] border border-black/[0.05] bg-white/85 px-2 py-1.5 shadow-lift backdrop-blur-xl md:hidden"
          style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
          aria-label="Main"
        >
          {LINKS.map((l) => {
            const on = active(path, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "flex min-w-[64px] flex-col items-center gap-0.5 rounded-2xl px-2 py-1 text-[11px] font-medium",
                  on ? "text-accent" : "text-ink-3"
                )}
              >
                <l.icon />
                {l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8.5" fill="#1b1b1e" />
      <path
        d="M5.55 15.1A10.5 10.5 0 0 1 26.45 15.1M26.45 16.9A10.5 10.5 0 0 1 5.55 16.9"
        fill="none"
        stroke="#0a84ff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M12.4 12.7h7.4M12.4 16h5.4M12.4 19.3h3.2" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19v-8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="6" width="17" height="12" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10.5v3M6.5 12h3M15.5 11h.01M17.5 13h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 4.5h8v5a4 4 0 0 1-8 0v-5ZM8 6.5H5.5a2.5 2.5 0 0 0 2.6 3M16 6.5h2.5a2.5 2.5 0 0 1-2.6 3M12 13.5V17M8.5 19.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 5.6a3 3 0 0 1 0 5.8M17.5 14.6c1.7.6 2.7 2 3 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
