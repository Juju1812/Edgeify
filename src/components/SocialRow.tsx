"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  DiscordIcon,
  InstagramIcon,
  RedditIcon,
  TikTokIcon,
  XIcon,
  YouTubeIcon
} from "./icons";

type SocialItem = {
  href: string;
  icon: ReactNode;
  label: string;
  iconColor?: string;
};

const items: SocialItem[] = [
  {
    href: "https://discord.gg/qSH5aYuTFY",
    icon: <DiscordIcon className="h-5 w-5" />,
    label: "Discord",
    iconColor: "text-[#5865F2]"
  },
  {
    href: "https://tiktok.com/",
    icon: <TikTokIcon className="h-5 w-5" />,
    label: "TikTok",
    iconColor: "text-white"
  },
  {
    href: "https://instagram.com/",
    icon: <InstagramIcon className="h-5 w-5" />,
    label: "Instagram",
    iconColor: "text-pink-400"
  },
  {
    href: "https://reddit.com/",
    icon: <RedditIcon className="h-5 w-5" />,
    label: "Reddit",
    iconColor: "text-orange-500"
  },
  {
    href: "https://youtube.com/",
    icon: <YouTubeIcon className="h-5 w-5" />,
    label: "YouTube",
    iconColor: "text-red-500"
  },
  {
    href: "https://x.com/",
    icon: <XIcon className="h-4 w-4" />,
    label: "X / Twitter",
    iconColor: "text-white"
  }
];

/**
 * Single horizontal strip of social links — replaces the previous
 * 6-card grid. Reads as a "follow us" footer accent rather than a
 * primary surface.
 */
export function SocialRow() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="label-xs">Follow Edgify</p>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            title={item.label}
            className={`group inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] transition hover:border-white/15 hover:bg-white/[0.06] ${
              item.iconColor ?? "text-white"
            }`}
          >
            <span className="opacity-80 transition group-hover:opacity-100">
              {item.icon}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
