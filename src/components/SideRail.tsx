"use client";

import Link from "next/link";
import { useUser } from "@/lib/user-context";
import { PersonIcon, TrophyIcon } from "./icons";

export function SideRail() {
  const { status } = useUser();
  const items = [
    {
      label: "Stats",
      href: "/profile",
      glyph: <PersonIcon className="h-4 w-4" />,
      hidden: status === "guest"
    },
    {
      label: "Leaderboard",
      href: "/leaderboard",
      glyph: <TrophyIcon className="h-4 w-4" />
    }
  ];

  return (
    <div className="pointer-events-auto fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
      {items
        .filter((i) => !i.hidden)
        .map((item, i) => (
          <Link
            key={i}
            href={item.href}
            aria-label={item.label}
            title={item.label}
            className="glass glass-hover relative flex h-11 w-11 items-center justify-center rounded-l-2xl rounded-r-md text-sm text-mog-violet"
            style={{
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 24px -8px rgba(168, 85, 247, 0.5)"
            }}
          >
            {item.glyph}
          </Link>
        ))}
    </div>
  );
}
